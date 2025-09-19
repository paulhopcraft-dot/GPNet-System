import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Tickets table for case management
export const tickets = pgTable("tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workerId: varchar("worker_id").references(() => workers.id), // Direct link to worker
  caseType: text("case_type").notNull().default("pre_employment"), // "pre_employment", "injury"
  claimType: text("claim_type"), // "standard", "workcover" (for injury cases)
  status: text("status").notNull().default("NEW"),
  priority: text("priority").default("medium"), // "low", "medium", "high", "urgent"
  companyName: text("company_name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Workers table for candidate information
export const workers = pgTable("workers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  roleApplied: text("role_applied").notNull(),
  site: text("site"),
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
  createdAt: timestamp("created_at").defaultNow(),
});

// Emails table for thread management
export const emails = pgTable("emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  sentAt: timestamp("sent_at").defaultNow(),
});

// Attachments table
export const attachments = pgTable("attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => tickets.id).notNull(),
  filename: text("filename").notNull(),
  path: text("path").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
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

// Type definitions
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof tickets.$inferSelect;

export type InsertWorker = z.infer<typeof insertWorkerSchema>;
export type Worker = typeof workers.$inferSelect;

export type InsertFormSubmission = z.infer<typeof insertFormSubmissionSchema>;
export type FormSubmission = typeof formSubmissions.$inferSelect;

export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analyses.$inferSelect;

export type InsertInjury = z.infer<typeof insertInjurySchema>;
export type Injury = typeof injuries.$inferSelect;

export type InsertStakeholder = z.infer<typeof insertStakeholderSchema>;
export type Stakeholder = typeof stakeholders.$inferSelect;

export type InsertRtwPlan = z.infer<typeof insertRtwPlanSchema>;
export type RtwPlan = typeof rtwPlans.$inferSelect;

export type Email = typeof emails.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;

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