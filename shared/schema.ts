import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Tickets table for case management
export const tickets = pgTable("tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseType: text("case_type").notNull().default("pre_employment"),
  status: text("status").notNull().default("NEW"),
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

// Type definitions
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof tickets.$inferSelect;

export type InsertWorker = z.infer<typeof insertWorkerSchema>;
export type Worker = typeof workers.$inferSelect;

export type InsertFormSubmission = z.infer<typeof insertFormSubmissionSchema>;
export type FormSubmission = typeof formSubmissions.$inferSelect;

export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analyses.$inferSelect;

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