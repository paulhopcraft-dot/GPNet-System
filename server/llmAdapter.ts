import OpenAI from "openai";
import { z } from "zod";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
// However, per specification we use gpt-4o-mini for chat and gpt-4.1 for reports
const MODEL_CHAT = "gpt-4o-mini";
const MODEL_REPORT = "gpt-4.1";

// Initialize OpenAI client with environment check
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// Audit log structure per specification
interface AuditLog {
  endpoint: string;
  model_used: string;
  templateId?: string;
  legislation_refs?: string[];
  source_version: string;
  checksum: string;
  timestamp: string;
  conversationId?: string;
  userId?: string;
}

// Schema definitions per specification
const ChatRequest = z.object({
  conversationId: z.string(),
  message: z.string(),
  userId: z.string().optional(),
});

const ReportRequest = z.object({
  templateId: z.enum(["injury_check", "prevention_check", "new_starter_check", "exit_check", "mental_health_check"]),
  inputData: z.object({
    worker: z.object({
      name: z.string(),
      id: z.string().optional(),
      position: z.string().optional(),
      employer: z.string().optional(),
      injuryDate: z.string().optional(),
      returnToWorkDate: z.string().optional(),
    }),
    case: z.object({
      id: z.string().optional(),
      type: z.string().optional(),
      status: z.string().optional(),
    }).optional(),
  }),
});

const ClassifyRequest = z.object({
  text: z.string(),
  hints: z.object({
    jobType: z.string().optional(),
    physicalDemands: z.string().optional(),
    currentSymptoms: z.string().optional(),
  }).optional(),
});

const LookupRequest = z.object({
  ids: z.array(z.string()),
});

// Response types per specification
interface ChatResponse {
  reply_text: string;
  next_questions: string[];
  extracted_fields: Record<string, any>;
  flags: {
    risk: string[];
    compliance: string[];
    escalation: string[];
  };
  legislation_refs: string[];
}

interface ReportResponse {
  meta: {
    templateId: string;
    generatedAt: string;
    disclaimer: string;
    fit_classification: "Fit" | "Fit with restrictions" | "Not fit";
    legislation_refs: string[];
  };
  body_markdown: string;
}

interface ClassifyResponse {
  fit_classification: "Fit" | "Fit with restrictions" | "Not fit";
  risk_flags: string[];
  suggested_restrictions: string[];
}

interface LookupResponse {
  resolved: Array<{ id: string; title: string; url: string }>;
  unresolved: string[];
}

// Legislation data (from existing JSON file)
let legislationData: any[] = [];
try {
  legislationData = require('../attached_assets/rtw_legislation_combined_1758297955072.json');
} catch (error) {
  console.warn('Legislation data not found, lookup functionality will be limited');
}

// Audit logging function
function logAudit(auditData: Partial<AuditLog>): void {
  const log: AuditLog = {
    endpoint: auditData.endpoint || '',
    model_used: auditData.model_used || '',
    templateId: auditData.templateId,
    legislation_refs: auditData.legislation_refs || [],
    source_version: new Date().toISOString().split('T')[0],
    checksum: generateChecksum(auditData),
    timestamp: new Date().toISOString(),
    conversationId: auditData.conversationId,
    userId: auditData.userId,
  };
  
  console.log('[AUDIT]', JSON.stringify(log));
}

function generateChecksum(data: any): string {
  return Buffer.from(JSON.stringify(data)).toString('base64').substring(0, 16);
}

// Fallback skeleton responses per specification
const SKELETON_RESPONSES = {
  chat: {
    reply_text: "I'm currently experiencing technical difficulties. Please try again in a moment, or contact your case manager for immediate assistance.",
    next_questions: [],
    extracted_fields: {},
    flags: { risk: [], compliance: [], escalation: ["technical_issue"] },
    legislation_refs: [],
  },
  
  report: (templateId: string) => ({
    meta: {
      templateId,
      generatedAt: new Date().toISOString(),
      disclaimer: "DISCLAIMER: This report was generated with limited functionality. Professional review required.",
      fit_classification: "Fit" as const,
      legislation_refs: [],
    },
    body_markdown: `# ${templateId.replace('_', ' ').toUpperCase()} - TECHNICAL ISSUE

## Disclaimer
${getDisclaimer()}

## Summary
Technical difficulties prevented full report generation. Manual review required.

## Fit Classification
**Fit** (default classification due to technical limitations)

## Recommendations
- Technical review required
- Manual assessment recommended
- Contact system administrator

## TODO Items
- [ ] Complete worker assessment
- [ ] Review relevant legislation
- [ ] Provide specific recommendations
- [ ] Generate final classification

---
*This is a fallback report. System functionality restoration required for complete assessment.*`
  }),
  
  classify: {
    fit_classification: "Fit" as const,
    risk_flags: ["technical_limitation"],
    suggested_restrictions: [],
  },
};

// Disclaimer per specification - must be inserted verbatim
function getDisclaimer(): string {
  return `**IMPORTANT DISCLAIMER**: This report is generated for administrative purposes only and does not constitute medical advice or diagnosis. All recommendations should be reviewed by qualified healthcare professionals and case managers. Compliance with Workplace Injury Rehabilitation and Compensation Act 2013 and WorkSafe Victoria guidelines is required. Individual circumstances may warrant different approaches than those suggested in this automated assessment.`;
}

// Main LLM functions per specification

export async function llmChat(request: z.infer<typeof ChatRequest>): Promise<ChatResponse> {
  const auditData = {
    endpoint: '/llm/chat',
    model_used: MODEL_CHAT,
    conversationId: request.conversationId,
  };

  try {
    if (!openai) {
      logAudit({ ...auditData, model_used: 'fallback' });
      return SKELETON_RESPONSES.chat;
    }

    const prompt = getMichellePrompt(request.message);
    
    const response = await openai.chat.completions.create({
      model: MODEL_CHAT,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: request.message }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    // Extract legislation references and validate
    const validRefs = result.legislation_refs?.filter((ref: string) => 
      legislationData.some(item => item.sectionId === ref)
    ) || [];

    logAudit({ ...auditData, legislation_refs: validRefs });
    
    return {
      reply_text: result.reply_text || "I understand. Can you tell me more about your situation?",
      next_questions: result.next_questions || [],
      extracted_fields: result.extracted_fields || {},
      flags: result.flags || { risk: [], compliance: [], escalation: [] },
      legislation_refs: validRefs,
    };

  } catch (error) {
    console.error('LLM Chat error:', error);
    logAudit({ ...auditData, model_used: 'fallback_error' });
    return SKELETON_RESPONSES.chat;
  }
}

export async function llmReport(request: z.infer<typeof ReportRequest>): Promise<ReportResponse> {
  const auditData = {
    endpoint: '/llm/report',
    model_used: MODEL_REPORT,
    templateId: request.templateId,
  };

  try {
    if (!openai) {
      logAudit({ ...auditData, model_used: 'fallback' });
      return SKELETON_RESPONSES.report(request.templateId);
    }

    const prompt = getReportPrompt(request.templateId, request.inputData);
    
    const response = await openai.chat.completions.create({
      model: MODEL_REPORT,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    // Validate legislation references
    const validRefs = result.meta?.legislation_refs?.filter((ref: string) => 
      legislationData.some(item => item.sectionId === ref)
    ) || [];

    // Ensure disclaimer is always included
    const disclaimer = getDisclaimer();
    
    logAudit({ ...auditData, legislation_refs: validRefs });
    
    return {
      meta: {
        templateId: request.templateId,
        generatedAt: new Date().toISOString(),
        disclaimer,
        fit_classification: result.meta?.fit_classification || "Fit",
        legislation_refs: validRefs,
      },
      body_markdown: result.body_markdown || SKELETON_RESPONSES.report(request.templateId).body_markdown,
    };

  } catch (error) {
    console.error('LLM Report error:', error);
    logAudit({ ...auditData, model_used: 'fallback_error' });
    return SKELETON_RESPONSES.report(request.templateId);
  }
}

export async function llmClassify(request: z.infer<typeof ClassifyRequest>): Promise<ClassifyResponse> {
  const auditData = {
    endpoint: '/llm/classify',
    model_used: MODEL_CHAT,
  };

  try {
    if (!openai) {
      logAudit({ ...auditData, model_used: 'fallback' });
      return SKELETON_RESPONSES.classify;
    }

    const prompt = getClassifyPrompt(request.text, request.hints);
    
    const response = await openai.chat.completions.create({
      model: MODEL_CHAT,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: request.text }
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    logAudit(auditData);
    
    return {
      fit_classification: result.fit_classification || "Fit",
      risk_flags: result.risk_flags || [],
      suggested_restrictions: result.suggested_restrictions || [],
    };

  } catch (error) {
    console.error('LLM Classify error:', error);
    logAudit({ ...auditData, model_used: 'fallback_error' });
    return SKELETON_RESPONSES.classify;
  }
}

export async function llmLookup(request: z.infer<typeof LookupRequest>): Promise<LookupResponse> {
  const auditData = {
    endpoint: '/llm/lookup',
    model_used: MODEL_CHAT,
  };

  logAudit(auditData);

  const resolved: Array<{ id: string; title: string; url: string }> = [];
  const unresolved: string[] = [];

  for (const id of request.ids) {
    const found = legislationData.find(item => item.sectionId === id);
    if (found) {
      resolved.push({
        id: found.sectionId,
        title: found.title,
        url: found.sourceUrl || '#',
      });
    } else {
      unresolved.push(id);
    }
  }

  return { resolved, unresolved };
}

// Prompt functions per specification

function getMichellePrompt(message: string): { system: string; user: string } {
  return {
    system: `You are "Michelle", a supportive conversational assistant for workplace injury and return-to-work assessments. 

RULES:
- Ask ONE question at a time
- Be supportive, empathetic, and professional
- Extract structured data fields when possible
- Flag psychosocial risks appropriately
- Escalate if self-harm or acute distress mentioned
- Cite only legislation IDs from the approved JSON database
- Always respond in JSON format

RESPONSE FORMAT:
{
  "reply_text": "Your supportive response here",
  "next_questions": ["Follow-up question 1", "Follow-up question 2"],
  "extracted_fields": {"symptom": "value", "duration": "value"},
  "flags": {
    "risk": ["physical_risk", "psychosocial_risk"],
    "compliance": ["rtw_timeline"],
    "escalation": ["self_harm", "acute_distress"]
  },
  "legislation_refs": ["WIRC s113", "CLAIMS_MANUAL 5.1.2"]
}`,
    user: message,
  };
}

function getReportPrompt(templateId: string, inputData: any): { system: string; user: string } {
  const prompts = {
    injury_check: {
      system: `Generate an Injury Check report. Use the template structure. Default fit classification is "Fit" unless evidence suggests otherwise. Cite only valid legislation IDs from the JSON database. Always insert the disclaimer verbatim. Use neutral, professional tone.

REQUIRED SECTIONS: Disclaimer, Summary, Fit Classification, Recommendations, Health Overview, Physical Health, Emotional Wellbeing, Work & Social Impacts, Lifestyle, Support Provided, Health Outlook, Appendix A.

RESPONSE FORMAT:
{
  "meta": {
    "fit_classification": "Fit",
    "legislation_refs": ["WIRC s113"]
  },
  "body_markdown": "# Report content here..."
}`,
      user: `Generate injury check report for: ${JSON.stringify(inputData)}`,
    },
    prevention_check: {
      system: `Generate a Prevention Check report. Same rules as injury check. Focus on preventive measures and risk mitigation.

REQUIRED SECTIONS: Disclaimer, Summary (concerns, risks, perceived capacity), Fit Classification, Recommendations (preventive/ergonomic), Health Overview, Physical Health, Emotional Wellbeing, Work & Social Impacts, Lifestyle, Support Provided, Health Outlook, Appendix A.`,
      user: `Generate prevention check report for: ${JSON.stringify(inputData)}`,
    },
    new_starter_check: {
      system: `Generate a New Starter Check report. Focus on onboarding and early risk identification.

REQUIRED SECTIONS: Disclaimer, Summary (role demands, capacity, red flags), Fit Classification, Recommendations (supports, micro-breaks), Health Overview, Work/Social Impacts, Outlook, Appendix A.`,
      user: `Generate new starter check report for: ${JSON.stringify(inputData)}`,
    },
    exit_check: {
      system: `Generate an Exit Check report. Summarize reasons for exit and provide insights for employer/recruiter.

REQUIRED SECTIONS: Disclaimer, Summary (issues, exit reasons), Supports Provided, Insights for employer/recruiter, Outlook, Appendix A.`,
      user: `Generate exit check report for: ${JSON.stringify(inputData)}`,
    },
    mental_health_check: {
      system: `Generate a Mental Health Check report. Insert URGENT FLAG if self-harm or acute risk detected. Use supportive, non-diagnostic language with "reported" phrasing.

REQUIRED SECTIONS: Disclaimer, Summary (psychosocial concerns), Fit Classification, Recommendations (EAP/GP), Psychosocial Factors, Work/Social Impacts, Support Provided, Outlook, Appendix A.`,
      user: `Generate mental health check report for: ${JSON.stringify(inputData)}`,
    },
  };

  return prompts[templateId] || prompts.injury_check;
}

function getClassifyPrompt(text: string, hints?: any): string {
  return `You are a conservative workplace fitness classifier. Analyze the text and hints to determine worker fitness classification.

CONSERVATIVE BIAS: Pain + load + repetition = "Fit with restrictions"

RESPONSE FORMAT (JSON only):
{
  "fit_classification": "Fit" | "Fit with restrictions" | "Not fit",
  "risk_flags": ["musculoskeletal", "repetitive_strain"],
  "suggested_restrictions": ["<15kg lifting", "no repetitive tasks"]
}

HINTS: ${JSON.stringify(hints || {})}
TEXT TO CLASSIFY: ${text}`;
}

// Export validation schemas
export { ChatRequest, ReportRequest, ClassifyRequest, LookupRequest };