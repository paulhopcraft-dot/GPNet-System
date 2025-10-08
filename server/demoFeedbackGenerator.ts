import { storage } from './storage';

/**
 * Demo Feedback Generator
 * Generates realistic feedback data for testing ML training system
 */

const FEEDBACK_TYPES = ['correct', 'not_relevant', 'better_action'] as const;

const SAMPLE_SUGGESTIONS = [
  "Initial case review and triage",
  "Request medical certificate from worker",
  "Schedule RTW assessment meeting",
  "Update injury claim documentation",
  "Contact employer for workplace assessment",
  "Review current capacity report",
  "Escalate to WorkCover liaison",
  "Schedule follow-up consultation",
  "Request updated medical clearance",
  "Coordinate gradual RTW plan"
];

const BETTER_ACTIONS = [
  "Request urgent medical assessment before proceeding",
  "Contact employer first to verify workplace modifications",
  "Schedule immediate RTW planning meeting with stakeholders",
  "Obtain comprehensive capacity assessment from treating doctor",
  "Escalate to senior case manager due to complexity",
  "Coordinate multi-disciplinary team meeting",
  "Request independent medical examination",
  "Implement immediate workplace safety review",
  "Fast-track WorkCover claim submission",
  "Arrange telehealth consultation for remote worker"
];

const CASE_TYPES = ['injury', 'pre_employment', 'mental_health', 'rtw_planning'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const URGENCIES = ['routine', 'standard', 'priority', 'critical'];

/**
 * Generate sample features for a case
 */
function generateFeatures() {
  return {
    caseType: CASE_TYPES[Math.floor(Math.random() * CASE_TYPES.length)],
    priority: PRIORITIES[Math.floor(Math.random() * PRIORITIES.length)],
    urgency: URGENCIES[Math.floor(Math.random() * URGENCIES.length)],
    riskLevel: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low',
    daysOffWork: Math.floor(Math.random() * 90),
    hasRTWPlan: Math.random() > 0.5,
    medicalCertCurrent: Math.random() > 0.3,
    workplaceModsRequired: Math.random() > 0.6
  };
}

/**
 * Generate demo feedback for a ticket
 */
export async function generateDemoFeedback(
  organizationId: string,
  ticketId: string,
  count: number = 1
): Promise<string[]> {
  const feedbackIds: string[] = [];

  for (let i = 0; i < count; i++) {
    const feedbackType = FEEDBACK_TYPES[Math.floor(Math.random() * FEEDBACK_TYPES.length)];
    const suggestionText = SAMPLE_SUGGESTIONS[Math.floor(Math.random() * SAMPLE_SUGGESTIONS.length)];
    const features = generateFeatures();

    const feedback = await storage.createCaseFeedback({
      organizationId,
      ticketId,
      suggestionText,
      feedbackType,
      betterActionText: feedbackType === 'better_action' 
        ? BETTER_ACTIONS[Math.floor(Math.random() * BETTER_ACTIONS.length)]
        : undefined,
      features,
      givenBy: 'demo-generator'
    });

    feedbackIds.push(feedback.id);
  }

  return feedbackIds;
}

/**
 * Generate demo feedback across multiple tickets for an organization
 */
export async function generateBulkDemoFeedback(
  organizationId: string,
  ticketCount: number = 10,
  feedbackPerTicket: number = 5
): Promise<{ totalFeedback: number; ticketsProcessed: number }> {
  // Get tickets for this organization
  const allTickets = await storage.getAllTickets();
  const tickets = allTickets.filter(t => t.organizationId === organizationId);
  
  if (tickets.length === 0) {
    throw new Error(`No tickets found for organization ${organizationId}`);
  }

  let totalFeedback = 0;
  const ticketsToProcess = tickets.slice(0, Math.min(ticketCount, tickets.length));

  for (const ticket of ticketsToProcess) {
    const feedbackIds = await generateDemoFeedback(
      organizationId,
      ticket.id,
      feedbackPerTicket
    );
    totalFeedback += feedbackIds.length;
  }

  return {
    totalFeedback,
    ticketsProcessed: ticketsToProcess.length
  };
}

/**
 * Generate demo feedback for all organizations
 */
export async function generateDemoFeedbackForAllOrgs(
  feedbackPerOrg: number = 50
): Promise<Record<string, number>> {
  const results: Record<string, number> = {};

  // Get all organizations
  const organizations = await storage.getAllOrganizations();
  const allTickets = await storage.getAllTickets();

  for (const org of organizations) {
    const tickets = allTickets.filter(t => t.organizationId === org.id);
    
    if (tickets.length === 0) {
      console.log(`Skipping org ${org.name} - no tickets`);
      continue;
    }

    let feedbackCount = 0;
    const feedbacksNeeded = Math.ceil(feedbackPerOrg / tickets.length);

    for (const ticket of tickets.slice(0, Math.min(10, tickets.length))) {
      const feedbackIds = await generateDemoFeedback(
        org.id,
        ticket.id,
        feedbacksNeeded
      );
      feedbackCount += feedbackIds.length;

      if (feedbackCount >= feedbackPerOrg) break;
    }

    results[org.name] = feedbackCount;
  }

  return results;
}
