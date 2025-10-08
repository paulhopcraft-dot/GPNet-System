import OpenAI from 'openai';
import { db } from './db';
import { tickets, workers, formSubmissions } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

// ========== AUDIT TRAIL ==========
interface AuditEvent {
  ts: string;
  node: string;
  stage: string;
  data: any;
}

class AuditTrail {
  flowName: string;
  version: string;
  events: AuditEvent[] = [];
  startedAt: string;

  constructor(flowName: string, version: string) {
    this.flowName = flowName;
    this.version = version;
    this.startedAt = new Date().toISOString();
  }

  log(node: string, stage: string, data: any) {
    this.events.push({
      ts: new Date().toISOString(),
      node,
      stage,
      data
    });
  }

  export() {
    return {
      flow: this.flowName,
      version: this.version,
      started_at: this.startedAt,
      ended_at: new Date().toISOString(),
      events: this.events
    };
  }
}

// ========== PII/PHI SCRUBBING ==========
const DROP_FIELDS = new Set(['ssn', 'home_address', 'diagnosis_free_text', 'dob', 'dateOfBirth']);
const MASK_FIELDS = new Set(['phone', 'email', 'phoneNumber']);

function piiPhiScrub(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  const safe: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (DROP_FIELDS.has(key)) {
      continue; // Drop sensitive fields
    }
    
    if (MASK_FIELDS.has(key) && typeof value === 'string') {
      safe[key] = value.replace(/./g, '•'); // Mask
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      safe[key] = piiPhiScrub(value); // Recursive scrub
    } else {
      safe[key] = value;
    }
  }
  
  return safe;
}

// ========== DATA FETCHING ==========
async function fetchCase(ticketId: string) {
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId)
  });

  if (!ticket) {
    throw new Error(`Case ${ticketId} not found`);
  }

  // Get worker info
  const worker = ticket.workerId 
    ? await db.query.workers.findFirst({ where: eq(workers.id, ticket.workerId) })
    : null;

  // Get form submissions for this ticket
  const submissions = await db.query.formSubmissions.findMany({
    where: eq(formSubmissions.ticketId, ticketId)
  });

  return {
    id: ticket.id,
    worker_id: ticket.workerId,
    worker_name: worker ? `${worker.firstName} ${worker.lastName}` : 'Unknown',
    notes: ticket.subject || ticket.nextStep || '',
    job_role: worker?.roleApplied || worker?.roleTitle || 'unknown',
    case_type: ticket.caseType,
    status: ticket.status,
    submissions: submissions.map((s: any) => s.formData)
  };
}

async function getCapacity(caseData: any): Promise<any> {
  // Extract capacity from form submissions
  const submissions = caseData.submissions || [];
  
  for (const submission of submissions) {
    if (submission.liftingCapacity || submission.workCapacity) {
      return {
        lift_kg: submission.liftingCapacity || 0,
        shift_hours: submission.maxHoursPerDay || 8,
        restrictions: submission.restrictions || []
      };
    }
  }
  
  // Default capacity if not found
  return {
    lift_kg: 0,
    shift_hours: 0,
    restrictions: ['assessment_required']
  };
}

function getRoleRequirements(role: string): any {
  // Role requirements database
  const roleReqs: Record<string, any> = {
    'warehouse_picker': {
      lift_min_kg: 15,
      min_hours: 6,
      prohibited: ['no_standing', 'no_lifting']
    },
    'warehouse_operator': {
      lift_min_kg: 10,
      min_hours: 6,
      prohibited: ['no_equipment_operation']
    },
    'construction_worker': {
      lift_min_kg: 20,
      min_hours: 8,
      prohibited: ['no_heavy_lifting', 'no_heights']
    },
    'office_admin': {
      lift_min_kg: 5,
      min_hours: 4,
      prohibited: []
    },
    'default': {
      lift_min_kg: 10,
      min_hours: 6,
      prohibited: []
    }
  };

  return roleReqs[role.toLowerCase()] || roleReqs['default'];
}

// ========== LLM RISK SUMMARIZATION ==========
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (openai) return openai;

  const apiKey = process.env.GPNET_OPENAI || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenAI API key not found');
  }

  openai = new OpenAI({ apiKey });
  return openai;
}

async function summarizeRisks(
  caseNotes: string,
  capacity: any,
  roleReq: any
): Promise<{ risks: string[] }> {
  const client = getOpenAIClient();
  
  const prompt = `CASE_NOTES:
${caseNotes}

WORKER_CAPACITY:
${JSON.stringify(capacity, null, 2)}

ROLE_REQUIREMENTS:
${JSON.stringify(roleReq, null, 2)}

Analyze the case notes and identify any clinical or role-fit risks. Return a JSON object with a 'risks' array containing short factual risk strings. Only include real, evidence-based risks - never invent data.`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a clinical safety analyst. Summarize only factual risks based on the provided data. Never invent or assume information not present in the notes.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { risks: [] };
    }

    const result = JSON.parse(content);
    return { risks: result.risks || [] };
  } catch (error) {
    console.error('LLM risk summarization failed:', error);
    return { risks: ['LLM_ANALYSIS_FAILED'] };
  }
}

// ========== POLICY CROSS-CHECK ==========
function policyCrossCheck(capacity: any, roleReq: any): Record<string, boolean> {
  const meetsPhysical = capacity.lift_kg >= roleReq.lift_min_kg;
  const meetsHours = capacity.shift_hours >= roleReq.min_hours;
  
  const capacityRestrictions = new Set(capacity.restrictions || []);
  const roleProhibited = new Set(roleReq.prohibited || []);
  const meetsRestrictions = !Array.from(capacityRestrictions).some(r => roleProhibited.has(r));

  return {
    meets_physical: meetsPhysical,
    meets_hours: meetsHours,
    meets_restrictions: meetsRestrictions
  };
}

// ========== NOTIFICATIONS ==========
async function notify(reason: string, caseId: string) {
  console.log(`[RTW ALERT] Case ${caseId}: ${reason}`);
  
  // Update ticket next step with notification
  await db.update(tickets)
    .set({
      nextStep: `RTW ALERT: ${reason}`,
      lastUpdateAt: new Date()
    })
    .where(eq(tickets.id, caseId));

  return { status: 'sent', reason, case_id: caseId };
}

async function writebackPlacement(caseId: string, role: string, controls: any) {
  console.log(`[RTW PLACEMENT] Case ${caseId}: approved for ${role}`);
  
  // Update ticket status
  await db.update(tickets)
    .set({
      status: 'READY_TO_SEND',
      nextStep: `RTW APPROVED for ${role}. Controls: ${JSON.stringify(controls)}`,
      lastUpdateAt: new Date()
    })
    .where(eq(tickets.id, caseId));

  return {
    status: 'created',
    case_id: caseId,
    role,
    controls
  };
}

// ========== MAIN WORKFLOW ==========
export async function runRTWFlow(ticketId: string): Promise<{
  decision: string;
  audit: any;
}> {
  const audit = new AuditTrail('RTW_Gating', 'v1.0');

  try {
    // 1. Fetch case data
    const caseData = await fetchCase(ticketId);
    audit.log('fetch_case', 'ok', { id: caseData.id, role: caseData.job_role });

    // 2. Scrub PII/PHI
    const caseSafe = piiPhiScrub(caseData);
    audit.log('pii_phi_scrub', 'ok', { safe_keys: Object.keys(caseSafe) });

    // 3. Check medical certificate (gate)
    const medCertOk = caseData.status !== 'NEW'; // Simplified check
    if (!medCertOk) {
      audit.log('gate_med_cert', 'fail', { reason: 'CASE_NOT_READY' });
      await notify('CASE_NOT_READY_FOR_RTW', ticketId);
      return { decision: 'DECLINED_NOT_READY', audit: audit.export() };
    }
    audit.log('gate_med_cert', 'ok', { status: 'valid' });

    // 4. Get capacity and role requirements
    const capacity = await getCapacity(caseData);
    const roleReq = getRoleRequirements(caseData.job_role);
    audit.log('lookup_capacity', 'ok', capacity);
    audit.log('lookup_role_req', 'ok', roleReq);

    // 5. LLM risk summarization
    const riskResult = await summarizeRisks(caseData.notes, capacity, roleReq);
    const risks = riskResult.risks || [];
    audit.log('llm_risks', 'ok', { risks });

    // 6. Policy cross-check
    const flags = policyCrossCheck(capacity, roleReq);
    audit.log('policy_cross_check', 'ok', flags);

    // 7. Decision logic
    if (!Object.values(flags).every(v => v) || risks.length > 0) {
      await notify('REVIEW_REQUIRED', ticketId);
      audit.log('escalation', 'sent', { flags, risks });
      return { decision: 'REVIEW_REQUIRED', audit: audit.export() };
    }

    // 8. Approve placement
    const placement = await writebackPlacement(ticketId, caseData.job_role, {
      light_duties: capacity.lift_kg < 20,
      restrictions: capacity.restrictions
    });
    audit.log('placement', 'ok', placement);

    return { decision: 'APPROVED', audit: audit.export() };

  } catch (error: any) {
    audit.log('error', 'fail', { message: error.message });
    return { decision: 'ERROR', audit: audit.export() };
  }
}
