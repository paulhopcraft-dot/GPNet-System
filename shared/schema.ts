import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, bigint, jsonb, boolean, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// GPNet2 Dashboard Types
export type CompanyName = "Symmetry" | "Allied Health" | "Apex Labour" | "SafeWorks" | "Core Industrial";
export type WorkStatus = "At work" | "Off work";
export type RiskLevel = "High" | "Medium" | "Low";
export type ComplianceIndicator = "Very High" | "High" | "Medium" | "Low" | "Very Low";

export interface CaseAttachment {
  id: string;
  name: string;
  type: string;
  url: string;
}

export interface WorkerCase {
  id: string;
  workerName: string;
  dateOfInjury?: string | null;
  company: CompanyName;
  riskLevel: RiskLevel;
  workStatus: WorkStatus;
  hasCertificate: boolean;
  certificateUrl?: string;
  complianceIndicator: ComplianceIndicator;
  nextStep: string;
  owner: string;
  dueDate: string;
  summary: string;
  attachments?: CaseAttachment[];
  clcLastFollowUp?: string;
  clcNextFollowUp?: string;
}



// Tickets table for case management - extended for Freshdesk integration
export const tickets = pgTable("tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id), // Keep existing reference
  workerId: varchar("worker_id").references(() => workers.id), // Keep existing reference
  caseType: text("case_type").notNull().default("pre_employment"), // "pre_employment", "injury"
  claimType: text("claim_type"), // "standard", "workcover" (for injury cases)
  status: text("status").notNull().default("NEW"),
  priority: text("priority").default("medium"), // "low", "medium", "high", "urgent"
  priorityLevel: text("priority_level").default("Low"), // "High", "Medium", "Low" - computed from priority_score
  priorityScore: integer("priority_score").default(0), // Numeric score for sorting (0-100+)
  flagRedCount: integer("flag_red_count").default(0), // Count of red flags
  flagAmberCount: integer("flag_amber_count").default(0), // Count of amber flags
  flagGreenCount: integer("flag_green_count").default(0), // Count of green flags
  slaDueAt: timestamp("sla_due_at"), // SLA deadline for response/resolution
  lastUpdateAt: timestamp("last_update_at").defaultNow(), // Last significant update to case
  assignedOwner: varchar("assigned_owner"), // User ID of case owner
  companyName: text("company_name"),
  
  // Freshdesk integration fields (new - nullable for incremental migration)
  fdId: integer("fd_id").unique(), // Freshdesk ticket ID
  fdCompanyId: bigint("fd_company_id", { mode: 'number' }), // Freshdesk company ID for linking to organizations
  subject: text("subject"), // Ticket subject from Freshdesk
  workCoverBool: boolean("workcover_bool").default(false),
  requesterId: varchar("requester_id"), // Freshdesk requester ID
  assigneeId: varchar("assignee_id"), // Freshdesk assignee ID
  ageDays: integer("age_days").default(0),
  lastUnseenActivityAt: timestamp("last_unseen_activity_at"),
  nextActionDueAt: timestamp("next_action_due_at"),
  requiresActionBool: boolean("requires_action_bool").default(false),
  tagsJson: jsonb("tags_json"), // Freshdesk tags array
  customJson: jsonb("custom_json"), // Custom fields from Freshdesk
  
  // STEP TRACKING FOR CASE MANAGEMENT (nextStep must ALWAYS be set to maintain workflow)
  nextStep: text("next_step").default("Initial case review and triage"), // What needs to be done next - ALWAYS required
  lastStep: text("last_step"), // What was the most recent completed action
  lastStepCompletedAt: timestamp("last_step_completed_at"), // When the last step was completed
  assignedTo: text("assigned_to"), // Who is responsible for the next step
  
  // RTW COMPLEX CLAIMS - WORKFLOW FIELDS
  rtwStep: text("rtw_step").default("eligibility_0_28"), // Current workflow position
  workplaceJurisdiction: text("workplace_jurisdiction").default("VIC"), // Australian state
  complianceStatus: text("compliance_status").default("compliant"), // "compliant", "at_risk", "non_compliant"
  lastParticipationDate: text("last_participation_date"), // Last worker participation
  nextDeadlineDate: text("next_deadline_date"), // Next critical deadline
  nextDeadlineType: text("next_deadline_type"), // "planning_meeting", "warning_expiry", "suspension_expiry"
  
  // Follow-up notification tracking
  followUp24hrSent: boolean("follow_up_24hr_sent").default(false), // Whether 24-hour follow-up has been sent
  followUpDay3Sent: boolean("follow_up_day3_sent").default(false), // Whether day 3 follow-up has been sent
  formType: text("form_type"), // Type of health check form for follow-ups
  
  // Case Console - Rule Engine fields (nullable for backward compatibility)
  riskLevel: text("risk_level"), // "Normal", "Medium", "High" - calculated from rules
  currentStatus: text("current_status"), // Auto-generated summary from recent emails
  nextStepsJson: jsonb("next_steps_json"), // Array of {text, priority, source} objects
  escalationLevel: integer("escalation_level").default(0), // For Worker Info Sheet escalation (0=Zora, 1=Wayne, 2=Michelle)
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Cases table for case management workflow
export const cases = pgTable("cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(),
  workerId: varchar("worker_id").references(() => workers.id),
  currentCapacity: integer("current_capacity"), // Worker's current lifting capacity in kg
  nextStepText: text("next_step_text"),
  nextStepDueAt: timestamp("next_step_due_at"),
  nextStepSetBy: varchar("next_step_set_by"), // User ID who set the next step
  nextStepSetAt: timestamp("next_step_set_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Workers table for candidate information - keep existing structure
export const workers = pgTable("workers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id), // Keep existing reference
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  roleApplied: text("role_applied").notNull(),
  site: text("site"),

  // New field for spec compatibility (nullable for incremental migration)
  roleTitle: text("role_title"), // Job title - maps to roleApplied

  // Case Console - Rule Engine fields (nullable for backward compatibility)
  managerName: text("manager_name"), // Worker's manager
  company: text("company"), // Company name

    // ✅ Real Date of Injury field (new)
  dateOfInjury: timestamp("date_of_injury"), // When injury occurred
  injuryDescription: text("injury_description"), // Optional injury notes/summary
  injurySeverity: text("injury_severity"), // e.g. "minor", "moderate", "serious", "major"


  expectedRecoveryDate: timestamp("expected_recovery_date"), // Expected recovery date
  statusOffWork: boolean("status_off_work").default(false), // Currently off work
  rtwPlanPresent: boolean("rtw_plan_present").default(false), // Has RTW plan
});

// Documents table for document management
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").references(() => cases.id).notNull(),
  kind: text("kind").notNull(), // "medical_certificate", "capacity_report", "rtw_plan", etc.
  filename: text("filename").notNull(),
  storageUrl: text("storage_url").notNull(), // Object storage URL
  expiresAt: timestamp("expires_at"),
  isCurrentBool: boolean("is_current_bool").default(true),
  uploadedBy: varchar("uploaded_by"), // User ID who uploaded
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Reports table for generated pre-employment and injury reports
export const reports = pgTable("reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(),
  reportType: text("report_type").notNull(), // "pre_employment", "injury_assessment"
  status: text("status").notNull().default("pending"), // "pending", "generated", "sent", "failed"
  storageKey: text("storage_key"), // Object storage key for the PDF
  dataVersion: text("data_version"), // Hash/version of source data to detect if regeneration needed
  emailSentAt: timestamp("email_sent_at"),
  emailRecipient: text("email_recipient"),
  metadata: jsonb("metadata"), // Additional report metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Events table for audit trail
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").references(() => cases.id),
  source: text("source").notNull(), // "freshdesk", "gpnet", "michelle", "system"
  kind: text("kind").notNull(), // "status_change", "note_added", "document_uploaded", etc.
  occurredAt: timestamp("occurred_at").defaultNow(),
  performedBy: varchar("performed_by"), // User ID who performed the action
  payloadJson: jsonb("payload_json"), // Event-specific data
});

// Form submissions table
export const formSubmissions = pgTable("form_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(),
  workerId: varchar("worker_id").references(() => workers.id).notNull(),
  rawData: jsonb("raw_data").notNull(),
  pdfPath: text("pdf_path"),
  receivedAt: timestamp("received_at").defaultNow(),
});

// Analysis table for storing automated assessments
export const analyses = pgTable("analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(),
  fitClassification: text("fit_classification"), // "fit", "fit_with_restrictions", "not_fit"
  ragScore: text("rag_score"), // "green", "amber", "red"
  recommendations: jsonb("recommendations"),
  notes: text("notes"),
  lastAssessedAt: timestamp("last_assessed_at").defaultNow(),
  nextReviewAt: timestamp("next_review_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Risk history table for audit trail of all risk level changes
export const riskHistory = pgTable("risk_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(),
  previousRagScore: text("previous_rag_score"), // Previous risk level
  newRagScore: text("new_rag_score").notNull(), // New risk level
  changeSource: text("change_source").notNull(), // "manual", "email", "form", "medical_record", "auto_reassessment"
  changeReason: text("change_reason"), // Reason for the change
  confidence: integer("confidence"), // Assessment confidence 0-100
  riskFactors: jsonb("risk_factors"), // Risk factors that triggered the change
  triggeredBy: text("triggered_by"), // Who/what triggered the change
  timestamp: timestamp("timestamp").defaultNow(),
});

// Emails table for thread management
export const emails = pgTable("emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  sentAt: timestamp("sent_at").defaultNow(),
  // Bidirectional sync fields
  source: text("source"), // 'freshdesk', 'gpnet', 'email'
  direction: text("direction"), // 'inbound', 'outbound'
  externalId: text("external_id"), // For deduplication
  senderName: text("sender_name"),
  senderEmail: text("sender_email"),
});

// Attachments table
export const attachments = pgTable("attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(),
  filename: text("filename").notNull(),
  path: text("path").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

// ===============================================
// FRESHDESK RAG SYSTEM TABLES
// ===============================================

// Ticket messages table for storing all conversation threads from Freshdesk
export const ticketMessages = pgTable("ticket_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(),
  freshdeskMessageId: varchar("freshdesk_message_id").unique(), // Freshdesk conversation/note ID
  authorId: varchar("author_id"), // Freshdesk user ID (agent/requester)
  authorRole: text("author_role").notNull(), // "requester", "agent", "system"
  authorName: text("author_name"),
  authorEmail: text("author_email"),
  isPrivate: boolean("is_private").default(false), // Private notes vs public replies
  bodyHtml: text("body_html"), // Original HTML content
  bodyText: text("body_text").notNull(), // Cleaned text for embeddings
  messageType: text("message_type").default("reply"), // "reply", "note", "forward"
  incomingOrOutgoing: text("incoming_or_outgoing"), // "incoming", "outgoing"
  createdAt: timestamp("created_at").defaultNow(),
  freshdeskCreatedAt: timestamp("freshdesk_created_at"), // Original timestamp from Freshdesk
}, (table) => ({
  ticketIdIdx: index("ticket_messages_ticket_id_idx").on(table.ticketId),
  freshdeskMessageIdIdx: index("ticket_messages_freshdesk_id_idx").on(table.freshdeskMessageId),
  authorRoleIdx: index("ticket_messages_author_role_idx").on(table.authorRole),
  freshdeskCreatedAtIdx: index("ticket_messages_freshdesk_created_at_idx").on(table.freshdeskCreatedAt),
}));

// Ticket message embeddings table for RAG vector search
export const ticketMessageEmbeddings = pgTable("ticket_message_embeddings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").references(() => ticketMessages.id).notNull(),
  vector: text("vector").notNull(), // JSON array of embedding vector (OpenAI ada-002 format)
  model: text("model").default("text-embedding-ada-002"), // Embedding model used
  chunkIndex: integer("chunk_index").default(0), // For long messages split into chunks
  content: text("content").notNull(), // Text content that was embedded
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  messageIdIdx: index("ticket_message_embeddings_message_id_idx").on(table.messageId),
  modelIdx: index("ticket_message_embeddings_model_idx").on(table.model),
}));

// Document embeddings table for RAG vector search of medical reports
export const documentEmbeddings = pgTable("document_embeddings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => medicalDocuments.id).notNull(),
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(), // For efficient ticket-scoped queries
  vector: text("vector").notNull(), // JSON array of embedding vector (OpenAI ada-002 format)
  model: text("model").default("text-embedding-ada-002"), // Embedding model used
  chunkIndex: integer("chunk_index").default(0), // For long documents split into chunks
  content: text("content").notNull(), // Text content that was embedded
  filename: text("filename").notNull(), // Document filename for context
  documentKind: text("document_kind").notNull(), // "medical_certificate", "diagnosis_report", etc.
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  documentIdIdx: index("document_embeddings_document_id_idx").on(table.documentId),
  ticketIdIdx: index("document_embeddings_ticket_id_idx").on(table.ticketId),
  modelIdx: index("document_embeddings_model_idx").on(table.model),
}));

// Type exports for document embeddings
export type DocumentEmbedding = typeof documentEmbeddings.$inferSelect;
export type InsertDocumentEmbedding = typeof documentEmbeddings.$inferInsert;

// ===============================================
// MULTI-TENANT ADMIN LAYER
// ===============================================

// Organizations table (legacy - keep for backward compatibility)
export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: text("status").notNull().default("active"),
  billingStatus: text("billing_status").default("current"),
  settings: jsonb("settings"),
  features: jsonb("features"),
  branding: jsonb("branding"),
  primaryContactName: text("primary_contact_name"),
  primaryContactEmail: text("primary_contact_email"),
  primaryContactPhone: text("primary_contact_phone"),
  freshdeskCompanyId: bigint("freshdesk_company_id", { mode: 'number' }).unique(),
  domains: jsonb("domains"),
  description: text("description"),
  isArchived: boolean("is_archived").default(false),
  archivedAt: timestamp("archived_at"),
  archivedBy: varchar("archived_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ===============================================
// WEBHOOK SECURITY TABLES  
// ===============================================

// Rate limiting tracking table for webhook security
export const webhookRateLimits = pgTable("webhook_rate_limits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(), // Support IPv6
  requestCount: integer("request_count").notNull().default(1),
  windowStart: timestamp("window_start").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  ipAddressIdx: index("webhook_rate_limits_ip_address_idx").on(table.ipAddress),
  expiresAtIdx: index("webhook_rate_limits_expires_at_idx").on(table.expiresAt),
}));

// Idempotency tracking table for webhook security  
export const webhookIdempotency = pgTable("webhook_idempotency", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").notNull(), // Removed .unique() for composite constraint
  endpoint: varchar("endpoint").notNull(), // e.g., "/api/webhook/pre-employment"
  processedAt: timestamp("processed_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(), 
  ipAddress: varchar("ip_address", { length: 45 }), // Track source IP
  userAgent: text("user_agent"), // Track user agent for debugging
}, (table) => ({
  // Composite unique constraint - each submission can be processed once per endpoint
  submissionEndpointUnique: unique("webhook_idempotency_submission_endpoint_unique")
    .on(table.submissionId, table.endpoint),
  submissionIdIdx: index("webhook_idempotency_submission_id_idx").on(table.submissionId),
  expiresAtIdx: index("webhook_idempotency_expires_at_idx").on(table.expiresAt),
  endpointIdx: index("webhook_idempotency_endpoint_idx").on(table.endpoint),
}));

export type InsertWebhookRateLimit = typeof webhookRateLimits.$inferInsert;
export type WebhookRateLimit = typeof webhookRateLimits.$inferSelect;

export type InsertWebhookIdempotency = typeof webhookIdempotency.$inferInsert;
export type WebhookIdempotency = typeof webhookIdempotency.$inferSelect;

// Client users table (legacy - keep for backward compatibility)
export const clientUsers = pgTable("client_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  passwordHash: text("password_hash"),
  lastLoginAt: timestamp("last_login_at"),
  loginCount: integer("login_count").default(0),
  role: text("role").notNull().default("user"),
  permissions: jsonb("permissions"),
  status: text("status").notNull().default("active"),
  isArchived: boolean("is_archived").default(false),
  archivedAt: timestamp("archived_at"),
  archivedBy: varchar("archived_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Admin users table for superusers
export const adminUsers = pgTable("admin_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Basic info
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  
  // Authentication
  passwordHash: text("password_hash").notNull(),
  mfaSecret: text("mfa_secret"), // TOTP secret for MFA
  mfaEnabled: boolean("mfa_enabled").default(false),
  
  // Session management
  lastLoginAt: timestamp("last_login_at"),
  loginCount: integer("login_count").default(0),
  currentImpersonationTarget: varchar("current_impersonation_target"), // Organization ID being impersonated
  impersonationStartedAt: timestamp("impersonation_started_at"),
  
  // Permissions
  permissions: jsonb("permissions"), // Admin-level permissions
  
  // Status
  status: text("status").notNull().default("active"), // "active", "suspended"
  isArchived: boolean("is_archived").default(false),
  archivedAt: timestamp("archived_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User sessions table for Express session management
export const userSessions = pgTable("user_sessions", {
  sid: varchar("sid").primaryKey(), // Session ID
  sess: jsonb("sess").notNull(), // Session data
  expire: timestamp("expire").notNull(), // Session expiration
});

// Invitation tokens table for secure worker links
export const invitationTokens = pgTable("invitation_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(),
  workerId: varchar("worker_id").references(() => workers.id).notNull(),
  token: varchar("token").notNull().unique(), // Secure random token
  expiresAt: timestamp("expires_at").notNull(), // Token expiration
  used: boolean("used").default(false), // Whether token has been used
  usedAt: timestamp("used_at"), // When token was used
  createdAt: timestamp("created_at").defaultNow(),
});

export type InsertInvitationToken = typeof invitationTokens.$inferInsert;
export type InvitationToken = typeof invitationTokens.$inferSelect;

// Pre-employment invitation schema for API validation
export const preEmploymentInvitationSchema = createInsertSchema(invitationTokens).pick({
  ticketId: true,
  workerId: true,
}).extend({
  workerName: z.string().min(2, "Worker name must be at least 2 characters"),
  workerEmail: z.string().email("Please enter a valid email address"),
  customMessage: z.string().min(10, "Message must be at least 10 characters"),
});

export type PreEmploymentInvitationData = z.infer<typeof preEmploymentInvitationSchema>;

// Audit events table for immutable audit log
export const auditEvents = pgTable("audit_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Event identification
  eventType: text("event_type").notNull(), // "ADMIN_LOGIN", "IMPERSONATE_START", "MICHELLE_GLOBAL_QUERY", etc.
  eventCategory: text("event_category").notNull(), // "auth", "admin", "michelle", "data"
  
  // Actor information
  actorId: varchar("actor_id").notNull(), // Admin or user ID
  actorType: text("actor_type").notNull(), // "admin", "client_user"
  actorEmail: text("actor_email"),
  
  // Target information
  targetType: text("target_type"), // "company", "ticket", "user"
  targetId: varchar("target_id"), // ID of affected entity
  organizationId: varchar("organization_id").references(() => organizations.id), // Affected company
  
  // Event details
  action: text("action").notNull(), // Human-readable action description
  details: jsonb("details"), // Structured event details
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  // Compliance fields
  result: text("result").notNull(), // "success", "failed", "denied"
  riskLevel: text("risk_level").default("low"), // "low", "medium", "high", "critical"
  
  // Immutable timestamp
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Archive index table for tracking archived entities
export const archiveIndex = pgTable("archive_index", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Entity identification
  entityType: text("entity_type").notNull(), // "company", "ticket", "user"
  entityId: varchar("entity_id").notNull(),
  organizationId: varchar("organization_id").references(() => organizations.id),
  
  // Archive metadata
  archivedBy: varchar("archived_by").notNull(), // Admin user ID
  archiveReason: text("archive_reason"),
  canRestore: boolean("can_restore").default(true),
  
  // Data references
  originalData: jsonb("original_data"), // Snapshot of entity at archive time
  relatedEntities: jsonb("related_entities"), // IDs of related archived entities
  
  // Timestamps
  archivedAt: timestamp("archived_at").defaultNow().notNull(),
  restoredAt: timestamp("restored_at"),
  restoredBy: varchar("restored_by"),
});

// ===============================================
// MANAGER-INITIATED CHECK SYSTEM
// ===============================================

// Health checks table for storing check types and JotForm URLs
export const checks = pgTable("checks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Check identification
  checkKey: text("check_key").notNull().unique(), // "pre_employment", "injury", "mental_health", "exit"
  displayName: text("display_name").notNull(), // "Pre-Employment Check", "Injury Assessment"
  description: text("description"), // Optional description of the check
  
  // JotForm integration
  checkUrl: text("check_url").notNull(), // Base JotForm URL
  requiresTicketId: boolean("requires_ticket_id").default(true), // Whether to append ticket_id to URL
  
  // Management
  active: boolean("active").default(true),
  sortOrder: integer("sort_order").default(0),
  
  // Audit
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by"), // Admin user who created
  updatedBy: varchar("updated_by"), // Admin user who last updated
});

// Company aliases table for fuzzy matching company names
export const companyAliases = pgTable("company_aliases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Company identification
  companyId: varchar("company_id").references(() => organizations.id).notNull(),
  aliasName: text("alias_name").notNull(), // Alternative company name
  normalizedName: text("normalized_name").notNull(), // Normalized version for matching
  
  // Matching configuration
  isPreferred: boolean("is_preferred").default(false), // Primary company name
  confidence: integer("confidence").default(100), // Matching confidence 0-100
  
  // Audit
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by"), // Admin user who created
}, (table) => ({
  // Unique constraint for normalized names per company
  uniqueNormalizedAlias: unique().on(table.companyId, table.normalizedName),
}));

// Email drafts table for manager review workflow
export const emailDrafts = pgTable("email_drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Context linking
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(),
  workerId: varchar("worker_id").references(() => workers.id).notNull(),
  checkId: varchar("check_id").references(() => checks.id).notNull(),
  managerId: varchar("manager_id"), // Manager who initiated the check
  
  // Email content
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  checkLink: text("check_link").notNull(), // Generated JotForm link with ticket_id
  
  // Manager workflow
  status: text("status").default("draft"), // "draft", "sent", "expired"
  managerEmail: text("manager_email").notNull(), // Where to send the draft
  sentToManagerAt: timestamp("sent_to_manager_at"),
  forwardedToWorkerAt: timestamp("forwarded_to_worker_at"),
  
  // Expiry and security
  expiresAt: timestamp("expires_at"), // Draft expiry
  linkToken: text("link_token"), // Signed token for secure links
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Check requests table for tracking manager-initiated check workflows
export const checkRequests = pgTable("check_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Request context
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(),
  workerId: varchar("worker_id").references(() => workers.id).notNull(),
  checkId: varchar("check_id").references(() => checks.id).notNull(),
  emailDraftId: varchar("email_draft_id").references(() => emailDrafts.id),
  
  // Manager context
  requestedBy: varchar("requested_by").notNull(), // Manager user ID
  requestReason: text("request_reason"), // Why this check was requested
  urgency: text("urgency").default("normal"), // "low", "normal", "high", "urgent"
  
  // Michelle dialogue context
  dialogueContext: jsonb("dialogue_context"), // Store Michelle conversation data
  
  // Workflow status
  status: text("status").default("initiated"), // "initiated", "draft_sent", "completed", "expired"
  completedAt: timestamp("completed_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ===============================================
// DOCTOR ESCALATION & MEDICAL OPINION SYSTEM  
// ===============================================

// Medical opinion requests table for doctor escalation workflow
export const medicalOpinionRequests = pgTable("medical_opinion_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Request context
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(),
  checkRequestId: varchar("check_request_id").references(() => checkRequests.id),
  managerId: varchar("manager_id").notNull(), // Manager who requested escalation
  
  // Michelle context
  dialogueTranscript: jsonb("dialogue_transcript"), // Michelle conversation that led to escalation
  michelleRecommendation: text("michelle_recommendation"), // Why Michelle recommended escalation
  
  // Request details  
  urgencyLevel: text("urgency_level").default("normal"), // "low", "normal", "high", "urgent"
  clinicalQuestions: text("clinical_questions").notNull(), // Specific questions for the doctor
  workerHealthSummary: text("worker_health_summary"), // Health context from form/Michelle
  
  // SLA tracking
  requestedAt: timestamp("requested_at").defaultNow(),
  slaDeadline: timestamp("sla_deadline").notNull(), // 30-minute SLA from request
  respondedAt: timestamp("responded_at"),
  slaBreached: boolean("sla_breached").default(false),
  
  // Medical opinion response
  doctorId: varchar("doctor_id"), // Which doctor responded
  medicalOpinion: text("medical_opinion"), // Doctor's detailed response
  recommendations: jsonb("recommendations"), // Structured recommendations
  preEmploymentDecision: text("preemployment_decision"), // "fit", "fit_with_restrictions", "not_fit"
  preventionCheckRecommended: boolean("prevention_check_recommended").default(false),
  
  // Workflow status
  status: text("status").default("pending"), // "pending", "assigned", "responded", "delivered", "acknowledged"
  deliveredToManagerAt: timestamp("delivered_to_manager_at"),
  managerAcknowledgedAt: timestamp("manager_acknowledged_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Organization settings for probation periods and policies
export const organizationSettings = pgTable("organization_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull().unique(),
  
  // Probation period settings
  probationPeriodDays: integer("probation_period_days"), // Required for pre-employment recommendations
  probationPolicyUrl: text("probation_policy_url"), // Link to probation policy document
  
  // Pre-employment settings
  preEmploymentEnabled: boolean("preemployment_enabled").default(true),
  preEmploymentRequiresProbation: boolean("preemployment_requires_probation").default(true),
  
  // Reminder settings
  reminderScheduleEnabled: boolean("reminder_schedule_enabled").default(true),
  preEmploymentReminderDays: jsonb("preemployment_reminder_days").default([1, 2, 3]), // Days 1, 2, 3
  exitCheckReminderDays: jsonb("exit_check_reminder_days").default([2, 4]), // Days 2, 4
  mentalHealthReminderDays: jsonb("mental_health_reminder_days").default([3, 5]), // Days 3, 5
  managerAlertDay: integer("manager_alert_day").default(5), // Default manager alert day
  
  // Michelle settings
  michelleEnabled: boolean("michelle_enabled").default(true),
  doctorEscalationEnabled: boolean("doctor_escalation_enabled").default(true),
  medicalOpinionSlaMins: integer("medical_opinion_sla_mins").default(30), // 30-minute SLA
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Reminder schedule tracking for automated reminders
export const reminderSchedule = pgTable("reminder_schedule", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Context
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(),
  checkType: text("check_type").notNull(), // "pre_employment", "exit", "mental_health", "injury"
  recipientEmail: text("recipient_email").notNull(),
  recipientName: text("recipient_name").notNull(),
  
  // Reminder tracking
  reminderNumber: integer("reminder_number").notNull(), // 1, 2, 3
  scheduledFor: timestamp("scheduled_for").notNull(), // When this reminder should be sent
  sentAt: timestamp("sent_at"), // When it was actually sent
  status: text("status").default("pending"), // "pending", "sent", "failed", "cancelled"
  
  // Manager alert tracking
  managerAlertRequired: boolean("manager_alert_required").default(false),
  managerAlertSentAt: timestamp("manager_alert_sent_at"),
  managerAlertStatus: text("manager_alert_status").default("pending"), // "pending", "sent", "failed"
  
  // Template information
  emailSubject: text("email_subject").notNull(),
  emailBody: text("email_body").notNull(),
  isManagerAlert: boolean("is_manager_alert").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ===============================================
// EXTERNAL EMAIL INTEGRATION SYSTEM
// ===============================================

// External emails table for managing forwarded emails from external parties
export const externalEmails = pgTable("external_emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Email identification
  ticketId: varchar("ticket_id").references(() => tickets.id), // Linked case (null if unmatched)
  organizationId: varchar("organization_id").references(() => organizations.id),
  messageId: text("message_id").notNull(), // Original email message ID for deduplication
  
  // Forwarding context
  forwardedBy: varchar("forwarded_by").notNull(), // Manager who forwarded the email
  forwardedAt: timestamp("forwarded_at").defaultNow(),
  
  // Original email metadata
  originalSender: text("original_sender").notNull(), // Original sender email
  originalSenderName: text("original_sender_name"),
  originalRecipient: text("original_recipient"),
  originalSubject: text("original_subject").notNull(),
  originalDate: timestamp("original_date"),
  
  // Email content
  subject: text("subject").notNull(), // Forwarded email subject
  body: text("body").notNull(), // Email body content
  htmlBody: text("html_body"), // HTML version if available
  threadHistory: jsonb("thread_history"), // Previous messages in thread
  
  // Case matching
  confidenceScore: integer("confidence_score"), // Matching confidence 0-100
  matchType: text("match_type"), // "worker_email", "worker_name", "treating_provider", "manager_context"
  matchReasoning: text("match_reasoning"), // Why this case was selected
  isManuallyLinked: boolean("is_manually_linked").default(false),
  
  // Processing status
  processingStatus: text("processing_status").default("pending"), // "pending", "processing", "matched", "unmatched", "error"
  errorMessage: text("error_message"),
  needsAdminReview: boolean("needs_admin_review").default(false), // Flag unmatched emails for admin attention
  
  // AI analysis
  aiSummary: text("ai_summary"), // Michelle's summary
  urgencyLevel: text("urgency_level"), // "low", "medium", "high", "critical"
  extractedEntities: jsonb("extracted_entities"), // Names, dates, medical terms, etc.
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint for idempotency - prevents duplicate processing
  uniqueOrgMessage: unique().on(table.organizationId, table.messageId),
}));

// Email attachments table for external email attachments
export const emailAttachments = pgTable("email_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Linking
  externalEmailId: varchar("external_email_id").references(() => externalEmails.id).notNull(),
  ticketId: varchar("ticket_id").references(() => tickets.id), // For easy case access
  
  // File metadata
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  filePath: text("file_path").notNull(), // Storage path
  fileSize: integer("file_size"), // Size in bytes
  mimeType: text("mime_type"),
  
  // Processing
  isProcessed: boolean("is_processed").default(false),
  extractedText: text("extracted_text"), // OCR/extracted content for PDFs
  
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

// Case providers table for enhanced provider contact management
export const caseProviders = pgTable("case_providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Relationships
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(),
  organizationId: varchar("organization_id").references(() => organizations.id),
  
  // Provider identification
  providerType: text("provider_type").notNull(), // "doctor", "physiotherapist", "insurer", "specialist", "employer_contact"
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  clinicName: text("clinic_name"),
  address: text("address"),
  
  // Provider relationship
  relationshipType: text("relationship_type"), // "treating", "consulting", "referring", "primary", "secondary"
  isPrimary: boolean("is_primary").default(false),
  isActive: boolean("is_active").default(true),
  
  // Communication tracking
  lastContactDate: timestamp("last_contact_date"),
  communicationPreference: text("communication_preference").default("email"), // "email", "phone", "fax"
  
  // Metadata
  providerNumber: text("provider_number"), // Medical provider number
  specialty: text("specialty"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// AI recommendations table for Michelle's email analysis and action suggestions
export const aiRecommendations = pgTable("ai_recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Context linking
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(),
  externalEmailId: varchar("external_email_id").references(() => externalEmails.id), // Email that triggered this
  conversationId: varchar("conversation_id").references(() => conversations.id), // Michelle conversation context
  
  // Recommendation details
  recommendationType: text("recommendation_type").notNull(), // "next_step", "follow_up", "escalation", "document_request"
  title: text("title").notNull(), // Short description
  description: text("description").notNull(), // Detailed recommendation
  priority: text("priority").default("medium"), // "low", "medium", "high", "urgent"
  
  // Action details
  suggestedAction: text("suggested_action").notNull(), // "contact_worker", "request_medical_cert", "follow_up_doctor", etc.
  actionDetails: jsonb("action_details"), // Structured action parameters
  estimatedTimeframe: text("estimated_timeframe"), // "immediate", "within_24h", "within_week"
  requiredResources: jsonb("required_resources"), // What's needed to complete
  
  // AI metadata
  confidenceScore: integer("confidence_score"), // AI confidence 0-100
  model: text("model").default("gpt-5"), // AI model used
  reasoning: text("reasoning"), // Why this recommendation was made
  
  // Manager interaction
  status: text("status").default("pending"), // "pending", "accepted", "modified", "rejected", "completed"
  managerDecision: text("manager_decision"), // Manager's chosen action
  managerNotes: text("manager_notes"),
  decidedBy: varchar("decided_by"), // Manager who made the decision
  decidedAt: timestamp("decided_at"),
  
  // Execution tracking
  executedAt: timestamp("executed_at"),
  executionResult: text("execution_result"), // "success", "failed", "partial"
  executionNotes: text("execution_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Michelle AI conversations table for tracking AI interactions
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Conversation identification  
  organizationId: varchar("organization_id").references(() => organizations.id), // Null for global/admin conversations
  ticketId: varchar("ticket_id").references(() => tickets.id), // Case-specific conversations
  workerId: varchar("worker_id").references(() => workers.id), // Worker conversations
  
  // Context and scoping
  conversationType: text("conversation_type").notNull(), // "client_scoped", "universal_admin", "case_specific"
  sessionId: varchar("session_id").notNull(), // Groups related messages in one conversation
  
  // Conversation metadata
  title: text("title"), // Auto-generated conversation title
  summary: text("summary"), // AI-generated conversation summary
  status: text("status").default("active"), // "active", "archived", "escalated"
  
  // Privacy and access control
  isPrivate: boolean("is_private").default(false), // For sensitive conversations
  accessLevel: text("access_level").default("standard"), // "standard", "restricted", "confidential"
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Conversation messages table for individual AI messages
export const conversationMessages = pgTable("conversation_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Message linking
  conversationId: varchar("conversation_id").references(() => conversations.id).notNull(),
  
  // Message content
  role: text("role").notNull(), // "user", "assistant", "system"
  content: text("content").notNull(),
  messageType: text("message_type").default("text"), // "text", "structured_response", "escalation"
  
  // AI context and processing
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  model: text("model").default("gpt-5"), // AI model used
  confidence: integer("confidence"), // AI confidence score 0-100
  
  // Case context
  caseContext: jsonb("case_context"), // Relevant case information at time of message
  nextStepSuggestion: text("next_step_suggestion"), // Michelle's recommended next action
  
  // Metadata
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// ===============================================
// MICHELLE AI ESCALATION SYSTEM
// ===============================================

// Specialists table for managing human experts who handle escalated cases
export const specialists = pgTable("specialists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Specialist identification
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull(), // "coordinator", "medical_reviewer", "legal_advisor", "senior_analyst"
  specialization: text("specialization"), // "occupational_health", "workers_compensation", "complex_claims", "legal_compliance"
  
  // Availability and routing
  isAvailable: boolean("is_available").default(true),
  currentCaseload: integer("current_caseload").default(0),
  maxCaseload: integer("max_caseload").default(10),
  
  // Contact and preferences
  phone: text("phone"),
  preferredContactMethod: text("preferred_contact_method").default("email"), // "email", "phone", "teams", "slack"
  workingHours: jsonb("working_hours"), // Schedule preferences
  timezone: text("timezone").default("Australia/Melbourne"),
  
  // Performance metrics
  averageResponseTime: integer("average_response_time"), // Minutes
  caseResolutionRate: integer("case_resolution_rate"), // Percentage
  expertiseRating: integer("expertise_rating").default(5), // 1-10 scale
  
  // Status and metadata
  status: text("status").default("active"), // "active", "busy", "unavailable", "offline"
  lastSeenAt: timestamp("last_seen_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Escalations table for tracking when cases are escalated from Michelle to specialists
export const escalations = pgTable("escalations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Escalation linking
  conversationId: varchar("conversation_id").references(() => conversations.id).notNull(),
  ticketId: varchar("ticket_id").references(() => tickets.id), // Optional case context
  assignedSpecialistId: varchar("assigned_specialist_id").references(() => specialists.id),
  
  // Escalation details
  escalationType: text("escalation_type").notNull(), // "safety_concern", "complex_case", "legal_issue", "medical_review", "compliance_risk"
  priority: text("priority").default("medium"), // "low", "medium", "high", "urgent"
  triggerReason: text("trigger_reason").notNull(), // What caused Michelle to escalate
  triggerFlags: jsonb("trigger_flags"), // Specific flags that triggered escalation
  
  // Context and handoff
  michelleContext: jsonb("michelle_context"), // AI context at time of escalation
  userContext: jsonb("user_context"), // User information and conversation history
  caseComplexity: integer("case_complexity").default(5), // 1-10 scale
  estimatedResolutionTime: integer("estimated_resolution_time"), // Minutes
  
  // Status and progress
  status: text("status").default("pending"), // "pending", "assigned", "in_progress", "resolved", "escalated_further"
  resolutionSummary: text("resolution_summary"), // Final outcome summary
  handoffNotes: text("handoff_notes"), // Notes from Michelle to specialist
  resolutionNotes: text("resolution_notes"), // Notes from specialist
  
  // Timing and metrics
  escalatedAt: timestamp("escalated_at").defaultNow(),
  assignedAt: timestamp("assigned_at"),
  firstResponseAt: timestamp("first_response_at"),
  resolvedAt: timestamp("resolved_at"),
  responseTimeMinutes: integer("response_time_minutes"),
  resolutionTimeMinutes: integer("resolution_time_minutes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Specialist assignments table for tracking current workload and routing decisions
export const specialistAssignments = pgTable("specialist_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Assignment linking
  specialistId: varchar("specialist_id").references(() => specialists.id).notNull(),
  escalationId: varchar("escalation_id").references(() => escalations.id).notNull(),
  conversationId: varchar("conversation_id").references(() => conversations.id).notNull(),
  
  // Assignment details
  assignmentType: text("assignment_type").notNull(), // "primary", "secondary", "consultant", "reviewer"
  assignmentReason: text("assignment_reason"), // Why this specialist was chosen
  routingScore: integer("routing_score"), // Algorithm confidence in this assignment (1-100)
  
  // Status and progress
  status: text("status").default("assigned"), // "assigned", "accepted", "declined", "completed", "transferred"
  acceptedAt: timestamp("accepted_at"),
  declinedAt: timestamp("declined_at"),
  declineReason: text("decline_reason"),
  completedAt: timestamp("completed_at"),
  
  // Workload tracking
  estimatedTimeRequired: integer("estimated_time_required"), // Minutes
  actualTimeSpent: integer("actual_time_spent"), // Minutes
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Injuries table for injury-specific information
export const injuries = pgTable("injuries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(),
  incidentDate: text("incident_date").notNull(), // ISO format YYYY-MM-DD
  incidentTime: text("incident_time"), // ISO format HH:MM
  location: text("location").notNull(),
  description: text("description").notNull(),
  bodyPartsAffected: jsonb("body_parts_affected"), // Array of affected body parts
  injuryType: text("injury_type"), // "strain", "cut", "fracture", "burn", etc.
  severity: text("severity"), // "minor", "moderate", "serious", "major"
  witnessDetails: text("witness_details"),
  immediateAction: text("immediate_action"),
  medicalTreatment: text("medical_treatment"),
  timeOffWork: boolean("time_off_work").default(false),
  estimatedRecovery: text("estimated_recovery"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Stakeholders table for managing external parties (doctors, insurers, etc.)
export const stakeholders = pgTable("stakeholders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(),
  role: text("role").notNull(), // "doctor", "insurer", "orc", "rehab_provider", "lawyer"
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  organization: text("organization"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// RTW Plans table for Return to Work planning
export const rtwPlans = pgTable("rtw_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(),
  doctorStakeholderId: varchar("doctor_stakeholder_id").references(() => stakeholders.id), // Link to approving doctor
  title: text("title").notNull(),
  restrictions: jsonb("restrictions"), // Array of work restrictions
  modifiedDuties: jsonb("modified_duties"), // Array of modified duties
  targetReturnDate: text("target_return_date"), // ISO format YYYY-MM-DD
  reviewDate: text("review_date"), // ISO format YYYY-MM-DD
  status: text("status").default("draft"), // "draft", "pending_approval", "approved", "active", "completed"
  doctorApproval: boolean("doctor_approval").default(false),
  doctorNotes: text("doctor_notes"),
  approvalAt: timestamp("approval_at"), // When doctor approved
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ===============================================
// CASE CONSOLE - RULE ENGINE & ML SYSTEM
// ===============================================

// Worker Info Sheet tracking with 14-day escalation chain (Zora → Wayne → Michelle)
export const workerInfoSheets = pgTable("worker_info_sheets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(), // CRITICAL: Multi-tenant partitioning
  workerId: varchar("worker_id").references(() => workers.id).notNull().unique(),
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(),
  requestedAt: timestamp("requested_at").notNull().defaultNow(),
  returnedAt: timestamp("returned_at"), // When worker returned the info sheet
  status: text("status").notNull().default("pending"), // "pending", "returned", "escalated", "expired"
  escalationLevel: integer("escalation_level").default(0), // 0=Zora, 1=Wayne, 2=Michelle
  lastEscalatedAt: timestamp("last_escalated_at"), // When last escalation occurred
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Case feedback for ML training - feedback loop to improve next-step suggestions
export const caseFeedback = pgTable("case_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id).notNull(), // CRITICAL: Multi-tenant partitioning
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(),
  userId: varchar("user_id"), // User who provided feedback
  feedbackType: text("feedback_type").notNull(), // Type of feedback given
  predictedRisk: varchar("predicted_risk"), // AI predicted risk level
  actualRisk: varchar("actual_risk"), // Actual risk level as confirmed by user
  predictedStatus: varchar("predicted_status"), // AI predicted status
  actualStatus: varchar("actual_status"), // Actual status as confirmed by user
  predictedNextSteps: jsonb("predicted_next_steps"), // AI predicted next steps
  betterNextSteps: jsonb("better_next_steps"), // User's better next steps
  comments: text("comments"), // Additional feedback comments
  createdAt: timestamp("created_at").defaultNow(),
});

// XGBoost model training runs tracking with SHAP explainability
export const modelTrainingRuns = pgTable("model_training_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").references(() => organizations.id), // OPTIONAL: For per-tenant models (null = global model)
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
  version: text("version").notNull(), // Model version identifier
  metrics: jsonb("metrics").notNull(), // {accuracy, precision, recall, f1_score}
  shapTopFeatures: jsonb("shap_top_features"), // Top 10 SHAP feature importances
  trainingDataCount: integer("training_data_count"), // Number of feedback samples used
  status: text("status").notNull().default("running"), // "running", "completed", "failed"
  errorMessage: text("error_message"), // Error details if failed
  createdAt: timestamp("created_at").defaultNow(),
});

// Schema definitions
export const insertTicketSchema = createInsertSchema(tickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkerSchema = createInsertSchema(workers).omit({
  id: true,
});

export const insertFormSubmissionSchema = createInsertSchema(formSubmissions).omit({
  id: true,
  receivedAt: true,
});

export const insertAnalysisSchema = createInsertSchema(analyses).omit({
  id: true,
  createdAt: true,
});

export const insertEmailSchema = createInsertSchema(emails).omit({
  id: true,
  sentAt: true,
});

export const insertInjurySchema = createInsertSchema(injuries).omit({
  id: true,
  createdAt: true,
});

export const insertStakeholderSchema = createInsertSchema(stakeholders).omit({
  id: true,
  createdAt: true,
});

export const insertRtwPlanSchema = createInsertSchema(rtwPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkerInfoSheetSchema = createInsertSchema(workerInfoSheets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCaseFeedbackSchema = createInsertSchema(caseFeedback).omit({
  id: true,
  createdAt: true,
});

export const insertModelTrainingRunSchema = createInsertSchema(modelTrainingRuns).omit({
  id: true,
  createdAt: true,
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConversationMessageSchema = createInsertSchema(conversationMessages).omit({
  id: true,
  timestamp: true,
});

// Type definitions
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof tickets.$inferSelect;

export type InsertWorker = z.infer<typeof insertWorkerSchema>;
export type Worker = typeof workers.$inferSelect;

export type InsertFormSubmission = z.infer<typeof insertFormSubmissionSchema>;
export type FormSubmission = typeof formSubmissions.$inferSelect;

export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analyses.$inferSelect;

export type InsertEmail = z.infer<typeof insertEmailSchema>;
export type Email = typeof emails.$inferSelect;

export type InsertInjury = z.infer<typeof insertInjurySchema>;
export type Injury = typeof injuries.$inferSelect;

export type InsertStakeholder = z.infer<typeof insertStakeholderSchema>;
export type Stakeholder = typeof stakeholders.$inferSelect;

export type InsertRtwPlan = z.infer<typeof insertRtwPlanSchema>;
export type RtwPlan = typeof rtwPlans.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;

export type InsertWorkerInfoSheet = z.infer<typeof insertWorkerInfoSheetSchema>;
export type WorkerInfoSheet = typeof workerInfoSheets.$inferSelect;

export type InsertCaseFeedback = z.infer<typeof insertCaseFeedbackSchema>;
export type CaseFeedback = typeof caseFeedback.$inferSelect;

export type InsertModelTrainingRun = z.infer<typeof insertModelTrainingRunSchema>;
export type ModelTrainingRun = typeof modelTrainingRuns.$inferSelect;

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

export type InsertConversationMessage = z.infer<typeof insertConversationMessageSchema>;
export type ConversationMessage = typeof conversationMessages.$inferSelect;

// Form validation schema for Pre-Employment Check
export const preEmploymentFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  phone: z.string().min(1, "Phone number is required"),
  email: z.string().email("Valid email is required"),
  roleApplied: z.string().min(1, "Role applied for is required"),
  site: z.string().optional(),
  
  // Medical History
  previousInjuries: z.string().optional(),
  conditions: z.array(z.string()).optional(),
  medications: z.string().optional(),
  allergies: z.string().optional(),
  
  // Musculoskeletal
  mskBack: z.enum(["none", "current", "past"]),
  mskBackDetails: z.string().optional(),
  mskNeck: z.enum(["none", "current", "past"]),
  mskNeckDetails: z.string().optional(),
  mskShoulders: z.enum(["none", "current", "past"]),
  mskShouldersDetails: z.string().optional(),
  mskElbows: z.enum(["none", "current", "past"]),
  mskElbowsDetails: z.string().optional(),
  mskWrists: z.enum(["none", "current", "past"]),
  mskWristsDetails: z.string().optional(),
  mskHips: z.enum(["none", "current", "past"]),
  mskHipsDetails: z.string().optional(),
  mskKnees: z.enum(["none", "current", "past"]),
  mskKneesDetails: z.string().optional(),
  mskAnkles: z.enum(["none", "current", "past"]),
  mskAnklesDetails: z.string().optional(),
  
  // Functional Capacity
  liftingKg: z.number().min(0),
  standingMins: z.number().min(0),
  walkingMins: z.number().min(0),
  repetitiveTasks: z.enum(["yes", "no"]),
  repetitiveTasksDetails: z.string().optional(),
  
  // Psychosocial Screening
  sleepRating: z.number().min(1).max(5),
  stressRating: z.number().min(1).max(5),
  supportRating: z.number().min(1).max(5),
  psychosocialComments: z.string().optional(),
  
  // Consent & Declaration
  consentToShare: z.boolean().refine(val => val === true, "Consent is required"),
  signature: z.string().min(1, "Signature is required"),
  signatureDate: z.string().min(1, "Signature date is required"),
});

export type PreEmploymentFormData = z.infer<typeof preEmploymentFormSchema>;

// Form validation schema for Injury Reports
export const injuryFormSchema = z.object({
  // Worker Information
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(1, "Phone number is required"),
  employeeId: z.string().optional(),
  department: z.string().min(1, "Department is required"),
  position: z.string().min(1, "Position is required"),
  supervisor: z.string().min(1, "Supervisor is required"),
  
  // Incident Details
  incidentDate: z.string().min(1, "Incident date is required"),
  incidentTime: z.string().min(1, "Incident time is required"),
  location: z.string().min(1, "Location is required"),
  description: z.string().min(10, "Please provide a detailed description"),
  
  // Injury Information
  bodyPartsAffected: z.array(z.string()).min(1, "Select at least one body part affected"),
  injuryType: z.string().min(1, "Injury type is required"),
  severity: z.enum(["minor", "moderate", "serious", "major"]),
  
  // Treatment and Recovery
  medicalTreatment: z.string().min(1, "Medical treatment details required"),
  timeOffWork: z.boolean(),
  estimatedRecovery: z.string().optional(),
  
  // Additional Information
  witnessDetails: z.string().optional(),
  immediateAction: z.string().optional(),
  
  // Work Capacity Assessment
  canReturnToWork: z.enum(["yes", "no", "with_restrictions"]),
  workRestrictions: z.array(z.string()).optional(),
  
  // Doctor Information (if applicable)
  doctorName: z.string().optional(),
  clinicName: z.string().optional(),
  clinicPhone: z.string().optional(),
  
  // Claim Information
  claimType: z.enum(["standard", "workcover"]).default("standard"),
  
  // Consent & Declaration
  consentToShare: z.boolean().refine(val => val === true, "Consent is required"),
  signature: z.string().min(1, "Signature is required"),
  signatureDate: z.string().min(1, "Signature date is required"),
});

export type InjuryFormData = z.infer<typeof injuryFormSchema>;

// Mental Health Check Form Schema
export const mentalHealthFormSchema = z.object({
  // Personal Information
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(1, "Phone number is required"),
  dateOfBirth: z.string().optional(),
  employeeId: z.string().optional(),
  department: z.string().optional(),
  position: z.string().optional(),
  
  // Mental Health Assessment
  mentalHealthConcerns: z.string().optional(),
  stressLevel: z.number().min(1).max(10).optional(),
  anxietyLevel: z.number().min(1).max(10).optional(),
  sleepQuality: z.number().min(1).max(5).optional(),
  workLifeBalance: z.number().min(1).max(5).optional(),
  supportNeeded: z.array(z.string()).optional(),
  previousMentalHealthTreatment: z.string().optional(),
  currentMedications: z.string().optional(),
  
  // Workplace Factors
  workplaceStressors: z.array(z.string()).optional(),
  workloadConcerns: z.string().optional(),
  relationshipIssues: z.string().optional(),
  
  // Support and Resources
  accessToSupport: z.enum(["yes", "no", "unsure"]).optional(),
  preferredSupportType: z.array(z.string()).optional(),
  urgencyLevel: z.enum(["low", "medium", "high", "immediate"]).optional(),
  
  // Additional Information
  additionalComments: z.string().optional(),
  
  // Consent & Declaration
  consentToShare: z.boolean().refine(val => val === true, "Consent is required"),
  signature: z.string().min(1, "Signature is required"),
  signatureDate: z.string().min(1, "Signature date is required"),
});

export type MentalHealthFormData = z.infer<typeof mentalHealthFormSchema>;

// Exit Check Form Schema  
export const exitCheckFormSchema = z.object({
  // Personal Information
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(1, "Phone number is required"),
  employeeId: z.string().optional(),
  department: z.string().min(1, "Department is required"),
  position: z.string().min(1, "Position is required"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  
  // Exit Details
  reasonForLeaving: z.string().min(1, "Reason for leaving is required"),
  voluntaryDeparture: z.boolean(),
  newEmployer: z.string().optional(),
  
  // Health Status at Exit
  currentHealthStatus: z.enum(["excellent", "good", "fair", "poor"]),
  healthConcerns: z.string().optional(),
  workRelatedInjuries: z.string().optional(),
  ongoingTreatment: z.string().optional(),
  
  // Workplace Assessment
  workplaceSafety: z.number().min(1).max(5),
  equipmentCondition: z.number().min(1).max(5),
  managementSupport: z.number().min(1).max(5),
  trainingAdequacy: z.number().min(1).max(5),
  
  // Recommendations
  improvementSuggestions: z.string().optional(),
  recommendCompany: z.enum(["yes", "no", "neutral"]).optional(),
  futureEmployabilityFactors: z.string().optional(),
  
  // Additional Information
  additionalComments: z.string().optional(),
  
  // Consent & Declaration
  consentToShare: z.boolean().refine(val => val === true, "Consent is required"),
  signature: z.string().min(1, "Signature is required"),
  signatureDate: z.string().min(1, "Signature date is required"),
});

export type ExitCheckFormData = z.infer<typeof exitCheckFormSchema>;

// General Health and Well-being Form Schema
export const generalHealthFormSchema = z.object({
  // Personal Information
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(1, "Phone number is required"),
  dateOfBirth: z.string().optional(),
  employeeId: z.string().optional(),
  department: z.string().optional(),
  position: z.string().optional(),
  
  // General Health Status
  overallHealthRating: z.enum(["excellent", "very_good", "good", "fair", "poor"]),
  currentHealthConditions: z.string().optional(),
  medications: z.string().optional(),
  allergies: z.string().optional(),
  
  // Physical Health
  physicalFitness: z.number().min(1).max(5).optional(),
  energyLevel: z.number().min(1).max(10).optional(),
  sleepQuality: z.number().min(1).max(5).optional(),
  exerciseFrequency: z.enum(["daily", "weekly", "monthly", "rarely", "never"]).optional(),
  
  // Mental and Emotional Well-being
  stressLevel: z.number().min(1).max(10).optional(),
  moodStability: z.number().min(1).max(5).optional(),
  workLifeBalance: z.number().min(1).max(5).optional(),
  socialSupport: z.enum(["excellent", "good", "adequate", "poor", "none"]).optional(),
  
  // Lifestyle Factors
  smokingStatus: z.enum(["never", "former", "current"]).optional(),
  alcoholConsumption: z.enum(["none", "occasional", "moderate", "frequent"]).optional(),
  dietQuality: z.number().min(1).max(5).optional(),
  
  // Work-Related Health
  workplaceStressors: z.array(z.string()).optional(),
  physicalDemands: z.number().min(1).max(5).optional(),
  workEnvironmentSatisfaction: z.number().min(1).max(5).optional(),
  occupationalHealthConcerns: z.string().optional(),
  
  // Support and Resources
  healthGoals: z.string().optional(),
  supportNeeded: z.array(z.string()).optional(),
  interestedPrograms: z.array(z.string()).optional(),
  
  // Additional Information
  additionalComments: z.string().optional(),
  
  // Consent & Declaration
  consentToShare: z.boolean().refine(val => val === true, "Consent is required"),
  signature: z.string().min(1, "Signature is required"),
  signatureDate: z.string().min(1, "Signature date is required"),
});

export type GeneralHealthFormData = z.infer<typeof generalHealthFormSchema>;

// Prevention Check Form Schema
export const preventionCheckFormSchema = z.object({
  // Personal Information
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(1, "Phone number is required"),
  dateOfBirth: z.string().optional(),
  employeeId: z.string().optional(),
  department: z.string().optional(),
  position: z.string().optional(),
  
  // Risk Assessment
  workEnvironmentRisks: z.array(z.string()).optional(),
  physicalDemands: z.string().optional(),
  ergonomicConcerns: z.string().optional(),
  hazardExposure: z.array(z.string()).optional(),
  
  // Health and Fitness
  currentHealthStatus: z.enum(["excellent", "good", "fair", "poor"]).optional(),
  fitnessLevel: z.number().min(1).max(5).optional(),
  previousInjuries: z.string().optional(),
  currentMedications: z.string().optional(),
  
  // Prevention Measures
  safetyTrainingCompleted: z.boolean().optional(),
  ppeUsage: z.string().optional(),
  workstationSetup: z.string().optional(),
  exerciseRoutine: z.string().optional(),
  
  // Recommendations
  recommendedPreventionMeasures: z.array(z.string()).optional(),
  additionalComments: z.string().optional(),
  
  // Consent & Declaration
  consentToShare: z.boolean().refine(val => val === true, "Consent is required"),
  signature: z.string().min(1, "Signature is required"),
  signatureDate: z.string().min(1, "Signature date is required"),
});

export type PreventionCheckFormData = z.infer<typeof preventionCheckFormSchema>;

// RTW Plan validation schema
export const rtwPlanSchema = z.object({
  ticketId: z.string().min(1, "Ticket ID is required"),
  doctorStakeholderId: z.string().optional(),
  title: z.string().min(1, "Plan title is required"),
  restrictions: z.array(z.string()).default([]),
  modifiedDuties: z.array(z.string()).default([]),
  targetReturnDate: z.string().min(1, "Target return date is required"),
  reviewDate: z.string().min(1, "Review date is required"),
  status: z.enum(["draft", "pending_approval", "approved", "active", "completed"]).default("draft"),
  doctorApproval: z.boolean().default(false),
  doctorNotes: z.string().optional(),
  createdBy: z.string().min(1, "Created by is required"),
});

export type RtwPlanFormData = z.infer<typeof rtwPlanSchema>;

// ===============================================
// RTW COMPLEX CLAIMS - LEGISLATION COMPLIANCE
// ===============================================

// Legislation documents storage (WIRC Act, Claims Manual, RTW Specifications)
export const legislationDocuments = pgTable("legislation_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  source: text("source").notNull(), // "WIRC", "CLAIMS_MANUAL", "RTW_SPEC"
  sectionId: text("section_id").notNull(), // "s104", "5.1.2", etc.
  title: text("title").notNull(),
  summary: text("summary"),
  content: text("content"),
  sourceUrl: text("source_url"),
  version: text("version").notNull(),
  checksum: text("checksum").notNull(),
  documentType: text("document_type").notNull(), // "act", "manual", "specification"
  jurisdiction: text("jurisdiction").notNull().default("VIC"), // "VIC", "NSW", etc.
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// RTW workflow step tracking
export const rtwWorkflowSteps = pgTable("rtw_workflow_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(),
  stepId: text("step_id").notNull(), // "eligibility_0_28", "month_2", "month_3", "non_compliance"
  status: text("status").default("pending"), // "pending", "in_progress", "completed", "escalated"
  startDate: text("start_date"),
  deadlineDate: text("deadline_date"),
  completedDate: text("completed_date"),
  legislationRefs: jsonb("legislation_refs"), // Array of {source, id, title}
  escalationReason: text("escalation_reason"),
  notes: text("notes"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Compliance audit trail (critical for legal defense)
export const complianceAudit = pgTable("compliance_audit", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(),
  action: text("action").notNull(), // "LETTER_SENT: warning_5_1_2", "STEP_ESCALATED", etc.
  actorId: text("actor_id").notNull(),
  actorName: text("actor_name").notNull(),
  legislationRefs: jsonb("legislation_refs"), // Persisted from template/action
  sourceVersion: text("source_version").notNull(),
  checksum: text("checksum").notNull(),
  templateUsed: text("template_used"), // Template name if letter sent
  payload: jsonb("payload"), // Token snapshot for forensic trace
  result: text("result"), // "sent", "failed", "scheduled"
  createdAt: timestamp("created_at").defaultNow(),
});

// Worker participation tracking (enhanced)
export const workerParticipationEvents = pgTable("worker_participation_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(),
  workflowStepId: varchar("workflow_step_id").references(() => rtwWorkflowSteps.id),
  eventType: text("event_type").notNull(), // "planning_meeting", "consultant_appointment", "interview", "assessment"
  eventDate: text("event_date").notNull(),
  scheduledDate: text("scheduled_date"), // When it was supposed to happen
  participationStatus: text("participation_status").notNull(), // "attended", "no_show", "refused", "rescheduled", "partial"
  legislationBasis: jsonb("legislation_basis"), // Which sections require this participation
  noticeGivenDate: text("notice_given_date"),
  noticePeriodDays: integer("notice_period_days"), // How many days notice given
  reasonForNonParticipation: text("reason_for_non_participation"),
  evidenceAttachmentId: varchar("evidence_attachment_id").references(() => attachments.id),
  stakeholderInvolved: varchar("stakeholder_involved").references(() => stakeholders.id), // Doctor, etc.
  complianceNotes: text("compliance_notes"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Letter templates with legislation references
export const letterTemplates = pgTable("letter_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // "invite_planning_meeting", "warning_5_1_2", etc.
  title: text("title").notNull(),
  content: text("content").notNull(), // Markdown content with tokens
  legislationRefs: jsonb("legislation_refs"), // Default legislation references
  defaultDeadlineDays: integer("default_deadline_days"),
  templateType: text("template_type").notNull(), // "invitation", "warning", "suspension", "notice"
  jurisdiction: text("jurisdiction").notNull().default("VIC"),
  isActive: boolean("is_active").default(true),
  version: text("version").default("1.0"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Generated letters tracking
export const generatedLetters = pgTable("generated_letters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(),
  templateId: varchar("template_id").references(() => letterTemplates.id).notNull(),
  workflowStepId: varchar("workflow_step_id").references(() => rtwWorkflowSteps.id),
  recipientType: text("recipient_type").notNull(), // "worker", "doctor", "insurer", "employer"
  recipientEmail: text("recipient_email"),
  recipientName: text("recipient_name"),
  subject: text("subject").notNull(),
  content: text("content").notNull(), // Final populated content
  tokens: jsonb("tokens"), // All tokens used for population
  legislationRefs: jsonb("legislation_refs"), // Legislation cited in this letter
  deadlineDate: text("deadline_date"), // If letter includes deadline
  status: text("status").default("draft"), // "draft", "sent", "failed", "scheduled"
  sentAt: timestamp("sent_at"),
  generatedBy: text("generated_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Freshdesk tickets tracking for bidirectional sync
export const freshdeskTickets = pgTable("freshdesk_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gpnetTicketId: varchar("gpnet_ticket_id").references(() => tickets.id).notNull(),
  freshdeskTicketId: integer("freshdesk_ticket_id").notNull().unique(), // Freshdesk's ID
  freshdeskUrl: text("freshdesk_url"),
  syncStatus: text("sync_status").default("synced"), // "synced", "pending", "failed", "disabled"
  lastSyncAt: timestamp("last_sync_at").defaultNow(),
  freshdeskData: jsonb("freshdesk_data"), // Store full Freshdesk ticket data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Freshdesk sync logs for tracking sync activities
export const freshdeskSyncLogs = pgTable("freshdesk_sync_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gpnetTicketId: varchar("gpnet_ticket_id").references(() => tickets.id),
  freshdeskTicketId: integer("freshdesk_ticket_id"),
  operation: text("operation").notNull(), // "create", "update", "sync_status", "sync_notes"
  direction: text("direction").notNull(), // "to_freshdesk", "from_freshdesk"
  status: text("status").notNull(), // "success", "failed", "skipped"
  details: jsonb("details"), // Request/response data
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Medical Documents for attachment processing per Roylett specification
export const medicalDocuments = pgTable("medical_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => tickets.id),
  workerId: varchar("worker_id").notNull().references(() => workers.id),
  sourceType: text("source_type").notNull(), // "freshdesk_attachment", "manual_upload", "email_attachment"
  sourceId: varchar("source_id"), // Freshdesk attachment ID, email ID, etc.
  
  // Document metadata
  kind: text("kind").notNull(), // "medical_certificate", "diagnosis_report", "fit_note", "specialist_letter", "radiology_report", "other"
  originalFilename: varchar("original_filename").notNull(),
  fileUrl: varchar("file_url").notNull(), // Object storage URL
  contentType: varchar("content_type").notNull(),
  fileSize: integer("file_size").notNull(),
  checksum: varchar("checksum").notNull(), // For idempotency
  
  // Extracted medical data
  patientName: varchar("patient_name"),
  doctorName: varchar("doctor_name"),
  providerNo: varchar("provider_no"),
  clinicName: varchar("clinic_name"),
  clinicPhone: varchar("clinic_phone"),
  issueDate: text("issue_date"), // Using text for date flexibility
  diagnosis: text("diagnosis"),
  restrictions: text("restrictions"),
  fitStatus: text("fit_status"), // "fit_unrestricted", "fit_with_restrictions", "unfit"
  validFrom: text("valid_from"), // Using text for date flexibility
  validTo: text("valid_to"),
  reviewOn: text("review_on"),
  capacityNotes: text("capacity_notes"),
  signatory: varchar("signatory"),
  signaturePresent: boolean("signature_present").default(false),
  
  // Additional fields for specialist reports
  icdCodes: text("icd_codes").array(),
  investigations: text("investigations"),
  treatmentPlan: text("treatment_plan"),
  followUpInterval: varchar("follow_up_interval"),
  redFlags: text("red_flags"),
  
  // Raw extracted text for RAG/embeddings
  extractedText: text("extracted_text"), // Full text content extracted from document
  
  // Processing metadata
  confidence: integer("confidence").default(0), // Overall confidence 0-100
  fieldConfidences: jsonb("field_confidences"), // Per-field confidence scores
  requiresReview: boolean("requires_review").default(false),
  isCurrentCertificate: boolean("is_current_certificate").default(false),
  
  // Status and tracking
  processingStatus: text("processing_status").default("pending").notNull(), // "pending", "processing", "completed", "failed", "requires_review"
  reviewedBy: varchar("reviewed_by").references(() => clientUsers.id),
  reviewedAt: timestamp("reviewed_at"),
  
  // Audit trail
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Document processing jobs queue
export const documentProcessingJobs = pgTable("document_processing_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => tickets.id),
  attachmentUrl: varchar("attachment_url").notNull(),
  organizationId: varchar("organization_id"),
  requesterEmail: varchar("requester_email"),
  
  // Job status
  status: text("status").default("pending").notNull(), // "pending", "processing", "completed", "failed", "retrying"
  priority: text("priority").default("normal").notNull(), // "low", "normal", "high", "urgent"
  
  // Processing metadata
  attempts: integer("attempts").default(0),
  maxRetries: integer("max_retries").default(3),
  errorMessage: text("error_message"),
  processingStartedAt: timestamp("processing_started_at"),
  processingCompletedAt: timestamp("processing_completed_at"),
  
  // Result reference
  documentId: varchar("document_id").references(() => medicalDocuments.id),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Document processing audit log
export const documentProcessingLogs = pgTable("document_processing_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => medicalDocuments.id),
  jobId: varchar("job_id").references(() => documentProcessingJobs.id),
  
  // Event details
  eventType: text("event_type").notNull(), // "download_started", "download_completed", "ocr_started", "ocr_completed", "validation_completed", "storage_completed", "case_updated", "review_required", "error"
  message: text("message").notNull(),
  details: jsonb("details"),
  
  // Context
  actorId: varchar("actor_id"),
  actorType: text("actor_type").default("system"), // "system", "user", "admin"
  
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Case restrictions (physical, functional, mental health)
export const restrictions = pgTable("restrictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => tickets.id),
  category: text("category").notNull(), // "physical", "functional", "mental_health"
  description: text("description").notNull(),
  sourceDocId: varchar("source_doc_id"), // Link to source document if applicable
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Treatment plans (care providers and schedules)
export const treatmentPlans = pgTable("treatment_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => tickets.id),
  providerType: text("provider_type").notNull(), // "GP", "Physio", "Psych", "Specialist"
  providerName: text("provider_name"),
  frequency: text("frequency"), // "2x/week", "weekly", "fortnightly"
  nextAppointment: timestamp("next_appointment"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Activity timeline (unified event log for case drawer)
export const activityTimeline = pgTable("activity_timeline", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => tickets.id),
  source: text("source").notNull(), // "michelle", "manual", "email", "system", "form"
  eventType: text("event_type").notNull(), // "note", "call", "certificate", "appointment", "status_change"
  summary: text("summary").notNull(),
  details: jsonb("details"),
  performedBy: varchar("performed_by"),
  timestamp: timestamp("timestamp").defaultNow().notNull()
}, (table) => ({
  ticketIdx: index("activity_timeline_ticket_idx").on(table.ticketId),
  timestampIdx: index("activity_timeline_timestamp_idx").on(table.timestamp)
}));

// Schema definitions for new tables
export const insertLegislationDocumentSchema = createInsertSchema(legislationDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRtwWorkflowStepSchema = createInsertSchema(rtwWorkflowSteps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertComplianceAuditSchema = createInsertSchema(complianceAudit).omit({
  id: true,
  createdAt: true,
});

export const insertWorkerParticipationEventSchema = createInsertSchema(workerParticipationEvents).omit({
  id: true,
  createdAt: true,
});

export const insertLetterTemplateSchema = createInsertSchema(letterTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGeneratedLetterSchema = createInsertSchema(generatedLetters).omit({
  id: true,
  createdAt: true,
});

export const insertFreshdeskTicketSchema = createInsertSchema(freshdeskTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFreshdeskSyncLogSchema = createInsertSchema(freshdeskSyncLogs).omit({
  id: true,
  createdAt: true,
});

export const insertRiskHistorySchema = createInsertSchema(riskHistory).omit({
  id: true,
  timestamp: true,
});

// Schema definitions for Freshdesk integration tables
export const insertCompanySchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(clientUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCaseSchema = createInsertSchema(cases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  occurredAt: true,
});

export const insertAdminUserSchema = createInsertSchema(adminUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAuditEventSchema = createInsertSchema(auditEvents).omit({
  id: true,
  timestamp: true,
});

export const insertArchiveIndexSchema = createInsertSchema(archiveIndex).omit({
  id: true,
  archivedAt: true,
});

// Schema definitions for escalation system tables
export const insertSpecialistSchema = createInsertSchema(specialists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEscalationSchema = createInsertSchema(escalations).omit({
  id: true,
  escalatedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSpecialistAssignmentSchema = createInsertSchema(specialistAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema definitions for external email integration tables
export const insertExternalEmailSchema = createInsertSchema(externalEmails).omit({
  id: true,
  forwardedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailAttachmentSchema = createInsertSchema(emailAttachments).omit({
  id: true,
  uploadedAt: true,
});

export const insertCaseProviderSchema = createInsertSchema(caseProviders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAiRecommendationSchema = createInsertSchema(aiRecommendations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type definitions for new tables
export type InsertLegislationDocument = z.infer<typeof insertLegislationDocumentSchema>;
export type LegislationDocument = typeof legislationDocuments.$inferSelect;

export type InsertRtwWorkflowStep = z.infer<typeof insertRtwWorkflowStepSchema>;
export type RtwWorkflowStep = typeof rtwWorkflowSteps.$inferSelect;

export type InsertComplianceAudit = z.infer<typeof insertComplianceAuditSchema>;
export type ComplianceAudit = typeof complianceAudit.$inferSelect;

export type InsertWorkerParticipationEvent = z.infer<typeof insertWorkerParticipationEventSchema>;
export type WorkerParticipationEvent = typeof workerParticipationEvents.$inferSelect;

export type InsertLetterTemplate = z.infer<typeof insertLetterTemplateSchema>;
export type LetterTemplate = typeof letterTemplates.$inferSelect;

export type InsertGeneratedLetter = z.infer<typeof insertGeneratedLetterSchema>;
export type GeneratedLetter = typeof generatedLetters.$inferSelect;

export type InsertFreshdeskTicket = z.infer<typeof insertFreshdeskTicketSchema>;
export type FreshdeskTicket = typeof freshdeskTickets.$inferSelect;

export type InsertFreshdeskSyncLog = z.infer<typeof insertFreshdeskSyncLogSchema>;
export type FreshdeskSyncLog = typeof freshdeskSyncLogs.$inferSelect;

export type InsertRiskHistory = z.infer<typeof insertRiskHistorySchema>;
export type RiskHistory = typeof riskHistory.$inferSelect;

// Type definitions for Freshdesk integration tables
// Type definitions for Freshdesk integration tables
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof organizations.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof clientUsers.$inferSelect;

export type InsertCase = z.infer<typeof insertCaseSchema>;
export type Case = typeof cases.$inferSelect;

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reports.$inferSelect;

export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

// Legacy type aliases for backward compatibility
export type InsertOrganization = InsertCompany;
export type Organization = Company;
export type InsertClientUser = InsertUser;
export type ClientUser = User;

export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;
export type AdminUser = typeof adminUsers.$inferSelect;

export type InsertAuditEvent = z.infer<typeof insertAuditEventSchema>;
export type AuditEvent = typeof auditEvents.$inferSelect;

export type InsertArchiveIndex = z.infer<typeof insertArchiveIndexSchema>;
export type ArchiveIndex = typeof archiveIndex.$inferSelect;

// Type definitions for escalation system tables
export type InsertSpecialist = z.infer<typeof insertSpecialistSchema>;
export type Specialist = typeof specialists.$inferSelect;

export type InsertEscalation = z.infer<typeof insertEscalationSchema>;
export type Escalation = typeof escalations.$inferSelect;

export type InsertSpecialistAssignment = z.infer<typeof insertSpecialistAssignmentSchema>;
export type SpecialistAssignment = typeof specialistAssignments.$inferSelect;

// Type definitions for external email integration tables
export type InsertExternalEmail = z.infer<typeof insertExternalEmailSchema>;
export type ExternalEmail = typeof externalEmails.$inferSelect;

export type InsertEmailAttachment = z.infer<typeof insertEmailAttachmentSchema>;
export type EmailAttachment = typeof emailAttachments.$inferSelect;

export type InsertCaseProvider = z.infer<typeof insertCaseProviderSchema>;
export type CaseProvider = typeof caseProviders.$inferSelect;

export type InsertAiRecommendation = z.infer<typeof insertAiRecommendationSchema>;
export type AiRecommendation = typeof aiRecommendations.$inferSelect;

// Authentication and session types
export const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
  mfaCode: z.string().optional(),
});

export const clientLoginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
  organizationSlug: z.string().min(1, "Organization is required"),
});

export type LoginRequest = z.infer<typeof loginSchema>;
export type ClientLoginRequest = z.infer<typeof clientLoginSchema>;

// Validation schemas for new API endpoints
export const emailRiskAssessmentSchema = z.object({
  emailContent: z.string().min(1, "Email content is required"),
  subject: z.string().min(1, "Subject is required"),
  sender: z.string().optional(),
});

export const manualRiskUpdateSchema = z.object({
  ragScore: z.enum(["green", "amber", "red"]),
  reason: z.string().optional(),
});

// Step tracking schemas
export const stepUpdateSchema = z.object({
  nextStep: z.string().min(1, "Next step is required"),
  assignedTo: z.string().optional(),
  completePreviousStep: z.boolean().optional().default(false),
  completionNotes: z.string().optional()
});

// RTW Workflow Types
export type RtwStepId = "eligibility_assessment" | "month_2_review" | "month_3_assessment" | "non_compliance_escalation";
export type RtwComplianceStatus = "compliant" | "non_compliant" | "pending";
export type RtwOutcome = "completed" | "escalated" | "terminated" | "withdrawn";

// Medical Document schemas and types per Roylett specification
export const insertMedicalDocumentSchema = createInsertSchema(medicalDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertDocumentProcessingJobSchema = createInsertSchema(documentProcessingJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertDocumentProcessingLogSchema = createInsertSchema(documentProcessingLogs).omit({
  id: true,
  createdAt: true
});

export type InsertMedicalDocument = z.infer<typeof insertMedicalDocumentSchema>;
export type MedicalDocument = typeof medicalDocuments.$inferSelect;

export type InsertDocumentProcessingJob = z.infer<typeof insertDocumentProcessingJobSchema>;
export type DocumentProcessingJob = typeof documentProcessingJobs.$inferSelect;

export type InsertDocumentProcessingLog = z.infer<typeof insertDocumentProcessingLogSchema>;
export type DocumentProcessingLog = typeof documentProcessingLogs.$inferSelect;

// Case drawer schemas
export const insertRestrictionSchema = createInsertSchema(restrictions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTreatmentPlanSchema = createInsertSchema(treatmentPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActivityTimelineSchema = createInsertSchema(activityTimeline).omit({
  id: true,
  timestamp: true,
});

export type InsertRestriction = z.infer<typeof insertRestrictionSchema>;
export type Restriction = typeof restrictions.$inferSelect;

export type InsertTreatmentPlan = z.infer<typeof insertTreatmentPlanSchema>;
export type TreatmentPlan = typeof treatmentPlans.$inferSelect;

export type InsertActivityTimeline = z.infer<typeof insertActivityTimelineSchema>;
export type ActivityTimeline = typeof activityTimeline.$inferSelect;

// Document kinds enumeration
export const DocumentKind = {
  MEDICAL_CERTIFICATE: "medical_certificate",
  DIAGNOSIS_REPORT: "diagnosis_report", 
  FIT_NOTE: "fit_note",
  SPECIALIST_LETTER: "specialist_letter",
  RADIOLOGY_REPORT: "radiology_report",
  OTHER: "other"
} as const;

export type DocumentKind = typeof DocumentKind[keyof typeof DocumentKind];

// Fit status enumeration  
export const FitStatus = {
  FIT_UNRESTRICTED: "fit_unrestricted",
  FIT_WITH_RESTRICTIONS: "fit_with_restrictions", 
  UNFIT: "unfit"
} as const;

export type FitStatus = typeof FitStatus[keyof typeof FitStatus];

// Processing status enumeration
export const ProcessingStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed", 
  FAILED: "failed",
  REQUIRES_REVIEW: "requires_review"
} as const;

export type ProcessingStatus = typeof ProcessingStatus[keyof typeof ProcessingStatus];

// OCR and validation schemas
export const ocrFieldExtractionSchema = z.object({
  patientName: z.string().optional(),
  doctorName: z.string().optional(),
  providerNo: z.string().optional(),
  clinicName: z.string().optional(),
  clinicPhone: z.string().optional(),
  issueDate: z.string().optional(),
  diagnosis: z.string().optional(),
  restrictions: z.string().optional(),
  fitStatus: z.enum(["fit_unrestricted", "fit_with_restrictions", "unfit"]).optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  reviewOn: z.string().optional(),
  capacityNotes: z.string().optional(),
  signatory: z.string().optional(),
  signaturePresent: z.boolean().optional(),
  icdCodes: z.array(z.string()).optional(),
  investigations: z.string().optional(),
  treatmentPlan: z.string().optional(),
  followUpInterval: z.string().optional(),
  redFlags: z.string().optional(),
  extractedText: z.string().optional(), // Full text content extracted from document
  confidence: z.number().min(0).max(100).optional(),
  fieldConfidences: z.record(z.number().min(0).max(100)).optional()
});

export type OcrFieldExtraction = z.infer<typeof ocrFieldExtractionSchema>;

// ===============================================
// MANAGER-INITIATED CHECK SYSTEM SCHEMAS
// ===============================================

// Insert schemas for new check management tables
export const insertCheckSchema = createInsertSchema(checks).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertCompanyAliasSchema = createInsertSchema(companyAliases).omit({
  id: true,
  createdAt: true
});

export const insertEmailDraftSchema = createInsertSchema(emailDrafts).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertCheckRequestSchema = createInsertSchema(checkRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// Type exports for new tables
export type InsertCheck = z.infer<typeof insertCheckSchema>;
export type Check = typeof checks.$inferSelect;

export type InsertCompanyAlias = z.infer<typeof insertCompanyAliasSchema>;
export type CompanyAlias = typeof companyAliases.$inferSelect;

export type InsertEmailDraft = z.infer<typeof insertEmailDraftSchema>;
export type EmailDraft = typeof emailDrafts.$inferSelect;

export type InsertCheckRequest = z.infer<typeof insertCheckRequestSchema>;
export type CheckRequest = typeof checkRequests.$inferSelect;

// Check status enums
export const CheckStatus = {
  INITIATED: "initiated",
  DRAFT_SENT: "draft_sent", 
  COMPLETED: "completed",
  EXPIRED: "expired"
} as const;

export type CheckStatus = typeof CheckStatus[keyof typeof CheckStatus];

// Email draft status enums
export const EmailDraftStatus = {
  DRAFT: "draft",
  SENT: "sent",
  EXPIRED: "expired"
} as const;

export type EmailDraftStatus = typeof EmailDraftStatus[keyof typeof EmailDraftStatus];

// ===============================================
// DOCTOR ESCALATION & MEDICAL OPINION SCHEMAS
// ===============================================

// Medical Opinion Request schemas
export const insertMedicalOpinionRequestSchema = createInsertSchema(medicalOpinionRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  requestedAt: true,
  slaDeadline: true
});

export type InsertMedicalOpinionRequest = z.infer<typeof insertMedicalOpinionRequestSchema>;
export type MedicalOpinionRequest = typeof medicalOpinionRequests.$inferSelect;

// Organization Settings schemas
export const insertOrganizationSettingsSchema = createInsertSchema(organizationSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type InsertOrganizationSettings = z.infer<typeof insertOrganizationSettingsSchema>;
export type OrganizationSettings = typeof organizationSettings.$inferSelect;

// Reminder Schedule schemas
export const insertReminderScheduleSchema = createInsertSchema(reminderSchedule).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type InsertReminderSchedule = z.infer<typeof insertReminderScheduleSchema>;
export type ReminderSchedule = typeof reminderSchedule.$inferSelect;

// Medical Opinion Request status enums
export const MedicalOpinionStatus = {
  PENDING: "pending",
  ASSIGNED: "assigned", 
  RESPONDED: "responded",
  DELIVERED: "delivered",
  ACKNOWLEDGED: "acknowledged"
} as const;

export type MedicalOpinionStatus = typeof MedicalOpinionStatus[keyof typeof MedicalOpinionStatus];

// ===============================================
// FRESHDESK RAG SYSTEM TYPE EXPORTS
// ===============================================

// Insert schemas for RAG tables
export const insertTicketMessageSchema = createInsertSchema(ticketMessages).omit({
  id: true,
  createdAt: true
});

export const insertTicketMessageEmbeddingSchema = createInsertSchema(ticketMessageEmbeddings).omit({
  id: true,
  createdAt: true
});

// Type exports for RAG tables
export type InsertTicketMessage = z.infer<typeof insertTicketMessageSchema>;
export type TicketMessage = typeof ticketMessages.$inferSelect;

export type InsertTicketMessageEmbedding = z.infer<typeof insertTicketMessageEmbeddingSchema>;
export type TicketMessageEmbedding = typeof ticketMessageEmbeddings.$inferSelect;

// Reminder Schedule status enums
export const ReminderStatus = {
  PENDING: "pending",
  SENT: "sent",
  FAILED: "failed", 
  CANCELLED: "cancelled"
} as const;

export type ReminderStatus = typeof ReminderStatus[keyof typeof ReminderStatus];