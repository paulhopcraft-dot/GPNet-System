CREATE TABLE "activity_timeline" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"source" text NOT NULL,
	"event_type" text NOT NULL,
	"summary" text NOT NULL,
	"details" jsonb,
	"performed_by" varchar,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"mfa_secret" text,
	"mfa_enabled" boolean DEFAULT false,
	"last_login_at" timestamp,
	"login_count" integer DEFAULT 0,
	"current_impersonation_target" varchar,
	"impersonation_started_at" timestamp,
	"permissions" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"is_archived" boolean DEFAULT false,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "ai_recommendations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"external_email_id" varchar,
	"conversation_id" varchar,
	"recommendation_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"priority" text DEFAULT 'medium',
	"suggested_action" text NOT NULL,
	"action_details" jsonb,
	"estimated_timeframe" text,
	"required_resources" jsonb,
	"confidence_score" integer,
	"model" text DEFAULT 'gpt-5',
	"reasoning" text,
	"status" text DEFAULT 'pending',
	"manager_decision" text,
	"manager_notes" text,
	"decided_by" varchar,
	"decided_at" timestamp,
	"executed_at" timestamp,
	"execution_result" text,
	"execution_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "analyses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"fit_classification" text,
	"rag_score" text,
	"recommendations" jsonb,
	"notes" text,
	"last_assessed_at" timestamp DEFAULT now(),
	"next_review_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "archive_index" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"organization_id" varchar,
	"archived_by" varchar NOT NULL,
	"archive_reason" text,
	"can_restore" boolean DEFAULT true,
	"original_data" jsonb,
	"related_entities" jsonb,
	"archived_at" timestamp DEFAULT now() NOT NULL,
	"restored_at" timestamp,
	"restored_by" varchar
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"filename" text NOT NULL,
	"path" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"event_category" text NOT NULL,
	"actor_id" varchar NOT NULL,
	"actor_type" text NOT NULL,
	"actor_email" text,
	"target_type" text,
	"target_id" varchar,
	"organization_id" varchar,
	"action" text NOT NULL,
	"details" jsonb,
	"ip_address" text,
	"user_agent" text,
	"result" text NOT NULL,
	"risk_level" text DEFAULT 'low',
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_feedback" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"ticket_id" varchar NOT NULL,
	"user_id" varchar,
	"feedback_type" text NOT NULL,
	"predicted_risk" varchar,
	"actual_risk" varchar,
	"predicted_status" varchar,
	"actual_status" varchar,
	"predicted_next_steps" jsonb,
	"better_next_steps" jsonb,
	"comments" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "case_providers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"organization_id" varchar,
	"provider_type" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"clinic_name" text,
	"address" text,
	"relationship_type" text,
	"is_primary" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"last_contact_date" timestamp,
	"communication_preference" text DEFAULT 'email',
	"provider_number" text,
	"specialty" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"worker_id" varchar,
	"current_capacity" integer,
	"next_step_text" text,
	"next_step_due_at" timestamp,
	"next_step_set_by" varchar,
	"next_step_set_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "check_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"worker_id" varchar NOT NULL,
	"check_id" varchar NOT NULL,
	"email_draft_id" varchar,
	"requested_by" varchar NOT NULL,
	"request_reason" text,
	"urgency" text DEFAULT 'normal',
	"dialogue_context" jsonb,
	"status" text DEFAULT 'initiated',
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "checks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"check_key" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"check_url" text NOT NULL,
	"requires_ticket_id" boolean DEFAULT true,
	"active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" varchar,
	"updated_by" varchar,
	CONSTRAINT "checks_check_key_unique" UNIQUE("check_key")
);
--> statement-breakpoint
CREATE TABLE "client_users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"password_hash" text,
	"last_login_at" timestamp,
	"login_count" integer DEFAULT 0,
	"role" text DEFAULT 'user' NOT NULL,
	"permissions" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"is_archived" boolean DEFAULT false,
	"archived_at" timestamp,
	"archived_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "client_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "company_aliases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar NOT NULL,
	"alias_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"is_preferred" boolean DEFAULT false,
	"confidence" integer DEFAULT 100,
	"created_at" timestamp DEFAULT now(),
	"created_by" varchar,
	CONSTRAINT "company_aliases_company_id_normalized_name_unique" UNIQUE("company_id","normalized_name")
);
--> statement-breakpoint
CREATE TABLE "compliance_audit" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"action" text NOT NULL,
	"actor_id" text NOT NULL,
	"actor_name" text NOT NULL,
	"legislation_refs" jsonb,
	"source_version" text NOT NULL,
	"checksum" text NOT NULL,
	"template_used" text,
	"payload" jsonb,
	"result" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversation_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"message_type" text DEFAULT 'text',
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"model" text DEFAULT 'gpt-5',
	"confidence" integer,
	"case_context" jsonb,
	"next_step_suggestion" text,
	"ip_address" text,
	"user_agent" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar,
	"ticket_id" varchar,
	"worker_id" varchar,
	"conversation_type" text NOT NULL,
	"session_id" varchar NOT NULL,
	"title" text,
	"summary" text,
	"status" text DEFAULT 'active',
	"is_private" boolean DEFAULT false,
	"access_level" text DEFAULT 'standard',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_embeddings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"ticket_id" varchar NOT NULL,
	"vector" text NOT NULL,
	"model" text DEFAULT 'text-embedding-ada-002',
	"chunk_index" integer DEFAULT 0,
	"content" text NOT NULL,
	"filename" text NOT NULL,
	"document_kind" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_processing_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"attachment_url" varchar NOT NULL,
	"organization_id" varchar,
	"requester_email" varchar,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"attempts" integer DEFAULT 0,
	"max_retries" integer DEFAULT 3,
	"error_message" text,
	"processing_started_at" timestamp,
	"processing_completed_at" timestamp,
	"document_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_processing_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"job_id" varchar,
	"event_type" text NOT NULL,
	"message" text NOT NULL,
	"details" jsonb,
	"actor_id" varchar,
	"actor_type" text DEFAULT 'system',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" varchar NOT NULL,
	"kind" text NOT NULL,
	"filename" text NOT NULL,
	"storage_url" text NOT NULL,
	"expires_at" timestamp,
	"is_current_bool" boolean DEFAULT true,
	"uploaded_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_email_id" varchar NOT NULL,
	"ticket_id" varchar,
	"filename" text NOT NULL,
	"original_filename" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"is_processed" boolean DEFAULT false,
	"extracted_text" text,
	"uploaded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_drafts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"worker_id" varchar NOT NULL,
	"check_id" varchar NOT NULL,
	"manager_id" varchar,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"check_link" text NOT NULL,
	"status" text DEFAULT 'draft',
	"manager_email" text NOT NULL,
	"sent_to_manager_at" timestamp,
	"forwarded_to_worker_at" timestamp,
	"expires_at" timestamp,
	"link_token" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"sent_at" timestamp DEFAULT now(),
	"source" text,
	"direction" text,
	"external_id" text,
	"sender_name" text,
	"sender_email" text
);
--> statement-breakpoint
CREATE TABLE "escalations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar NOT NULL,
	"ticket_id" varchar,
	"assigned_specialist_id" varchar,
	"escalation_type" text NOT NULL,
	"priority" text DEFAULT 'medium',
	"trigger_reason" text NOT NULL,
	"trigger_flags" jsonb,
	"michelle_context" jsonb,
	"user_context" jsonb,
	"case_complexity" integer DEFAULT 5,
	"estimated_resolution_time" integer,
	"status" text DEFAULT 'pending',
	"resolution_summary" text,
	"handoff_notes" text,
	"resolution_notes" text,
	"escalated_at" timestamp DEFAULT now(),
	"assigned_at" timestamp,
	"first_response_at" timestamp,
	"resolved_at" timestamp,
	"response_time_minutes" integer,
	"resolution_time_minutes" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" varchar,
	"source" text NOT NULL,
	"kind" text NOT NULL,
	"occurred_at" timestamp DEFAULT now(),
	"performed_by" varchar,
	"payload_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "external_emails" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar,
	"organization_id" varchar,
	"message_id" text NOT NULL,
	"forwarded_by" varchar NOT NULL,
	"forwarded_at" timestamp DEFAULT now(),
	"original_sender" text NOT NULL,
	"original_sender_name" text,
	"original_recipient" text,
	"original_subject" text NOT NULL,
	"original_date" timestamp,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"html_body" text,
	"thread_history" jsonb,
	"confidence_score" integer,
	"match_type" text,
	"match_reasoning" text,
	"is_manually_linked" boolean DEFAULT false,
	"processing_status" text DEFAULT 'pending',
	"error_message" text,
	"needs_admin_review" boolean DEFAULT false,
	"ai_summary" text,
	"urgency_level" text,
	"extracted_entities" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "external_emails_organization_id_message_id_unique" UNIQUE("organization_id","message_id")
);
--> statement-breakpoint
CREATE TABLE "form_submissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"worker_id" varchar NOT NULL,
	"raw_data" jsonb NOT NULL,
	"pdf_path" text,
	"received_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "freshdesk_sync_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gpnet_ticket_id" varchar,
	"freshdesk_ticket_id" integer,
	"operation" text NOT NULL,
	"direction" text NOT NULL,
	"status" text NOT NULL,
	"details" jsonb,
	"error_message" text,
	"retry_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "freshdesk_tickets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gpnet_ticket_id" varchar NOT NULL,
	"freshdesk_ticket_id" integer NOT NULL,
	"freshdesk_url" text,
	"sync_status" text DEFAULT 'synced',
	"last_sync_at" timestamp DEFAULT now(),
	"freshdesk_data" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "freshdesk_tickets_freshdesk_ticket_id_unique" UNIQUE("freshdesk_ticket_id")
);
--> statement-breakpoint
CREATE TABLE "generated_letters" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"template_id" varchar NOT NULL,
	"workflow_step_id" varchar,
	"recipient_type" text NOT NULL,
	"recipient_email" text,
	"recipient_name" text,
	"subject" text NOT NULL,
	"content" text NOT NULL,
	"tokens" jsonb,
	"legislation_refs" jsonb,
	"deadline_date" text,
	"status" text DEFAULT 'draft',
	"sent_at" timestamp,
	"generated_by" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "injuries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"incident_date" text NOT NULL,
	"incident_time" text,
	"location" text NOT NULL,
	"description" text NOT NULL,
	"body_parts_affected" jsonb,
	"injury_type" text,
	"severity" text,
	"witness_details" text,
	"immediate_action" text,
	"medical_treatment" text,
	"time_off_work" boolean DEFAULT false,
	"estimated_recovery" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invitation_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"worker_id" varchar NOT NULL,
	"token" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "invitation_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "legislation_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"section_id" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"content" text,
	"source_url" text,
	"version" text NOT NULL,
	"checksum" text NOT NULL,
	"document_type" text NOT NULL,
	"jurisdiction" text DEFAULT 'VIC' NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "letter_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"legislation_refs" jsonb,
	"default_deadline_days" integer,
	"template_type" text NOT NULL,
	"jurisdiction" text DEFAULT 'VIC' NOT NULL,
	"is_active" boolean DEFAULT true,
	"version" text DEFAULT '1.0',
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "medical_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"worker_id" varchar NOT NULL,
	"source_type" text NOT NULL,
	"source_id" varchar,
	"kind" text NOT NULL,
	"original_filename" varchar NOT NULL,
	"file_url" varchar NOT NULL,
	"content_type" varchar NOT NULL,
	"file_size" integer NOT NULL,
	"checksum" varchar NOT NULL,
	"patient_name" varchar,
	"doctor_name" varchar,
	"provider_no" varchar,
	"clinic_name" varchar,
	"clinic_phone" varchar,
	"issue_date" text,
	"diagnosis" text,
	"restrictions" text,
	"fit_status" text,
	"valid_from" text,
	"valid_to" text,
	"review_on" text,
	"capacity_notes" text,
	"signatory" varchar,
	"signature_present" boolean DEFAULT false,
	"icd_codes" text[],
	"investigations" text,
	"treatment_plan" text,
	"follow_up_interval" varchar,
	"red_flags" text,
	"extracted_text" text,
	"confidence" integer DEFAULT 0,
	"field_confidences" jsonb,
	"requires_review" boolean DEFAULT false,
	"is_current_certificate" boolean DEFAULT false,
	"processing_status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medical_opinion_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"check_request_id" varchar,
	"manager_id" varchar NOT NULL,
	"dialogue_transcript" jsonb,
	"michelle_recommendation" text,
	"urgency_level" text DEFAULT 'normal',
	"clinical_questions" text NOT NULL,
	"worker_health_summary" text,
	"requested_at" timestamp DEFAULT now(),
	"sla_deadline" timestamp NOT NULL,
	"responded_at" timestamp,
	"sla_breached" boolean DEFAULT false,
	"doctor_id" varchar,
	"medical_opinion" text,
	"recommendations" jsonb,
	"preemployment_decision" text,
	"prevention_check_recommended" boolean DEFAULT false,
	"status" text DEFAULT 'pending',
	"delivered_to_manager_at" timestamp,
	"manager_acknowledged_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "model_training_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"version" text NOT NULL,
	"metrics" jsonb NOT NULL,
	"shap_top_features" jsonb,
	"training_data_count" integer,
	"status" text DEFAULT 'running' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organization_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"probation_period_days" integer,
	"probation_policy_url" text,
	"preemployment_enabled" boolean DEFAULT true,
	"preemployment_requires_probation" boolean DEFAULT true,
	"reminder_schedule_enabled" boolean DEFAULT true,
	"preemployment_reminder_days" jsonb DEFAULT '[1,2,3]'::jsonb,
	"exit_check_reminder_days" jsonb DEFAULT '[2,4]'::jsonb,
	"mental_health_reminder_days" jsonb DEFAULT '[3,5]'::jsonb,
	"manager_alert_day" integer DEFAULT 5,
	"michelle_enabled" boolean DEFAULT true,
	"doctor_escalation_enabled" boolean DEFAULT true,
	"medical_opinion_sla_mins" integer DEFAULT 30,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "organization_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"billing_status" text DEFAULT 'current',
	"settings" jsonb,
	"features" jsonb,
	"branding" jsonb,
	"primary_contact_name" text,
	"primary_contact_email" text,
	"primary_contact_phone" text,
	"freshdesk_company_id" bigint,
	"domains" jsonb,
	"description" text,
	"is_archived" boolean DEFAULT false,
	"archived_at" timestamp,
	"archived_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "organizations_freshdesk_company_id_unique" UNIQUE("freshdesk_company_id")
);
--> statement-breakpoint
CREATE TABLE "reminder_schedule" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"check_type" text NOT NULL,
	"recipient_email" text NOT NULL,
	"recipient_name" text NOT NULL,
	"reminder_number" integer NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"sent_at" timestamp,
	"status" text DEFAULT 'pending',
	"manager_alert_required" boolean DEFAULT false,
	"manager_alert_sent_at" timestamp,
	"manager_alert_status" text DEFAULT 'pending',
	"email_subject" text NOT NULL,
	"email_body" text NOT NULL,
	"is_manager_alert" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"report_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"storage_key" text,
	"data_version" text,
	"email_sent_at" timestamp,
	"email_recipient" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "restrictions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"source_doc_id" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"previous_rag_score" text,
	"new_rag_score" text NOT NULL,
	"change_source" text NOT NULL,
	"change_reason" text,
	"confidence" integer,
	"risk_factors" jsonb,
	"triggered_by" text,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rtw_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"doctor_stakeholder_id" varchar,
	"title" text NOT NULL,
	"restrictions" jsonb,
	"modified_duties" jsonb,
	"target_return_date" text,
	"review_date" text,
	"status" text DEFAULT 'draft',
	"doctor_approval" boolean DEFAULT false,
	"doctor_notes" text,
	"approval_at" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rtw_workflow_steps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"step_id" text NOT NULL,
	"status" text DEFAULT 'pending',
	"start_date" text,
	"deadline_date" text,
	"completed_date" text,
	"legislation_refs" jsonb,
	"escalation_reason" text,
	"notes" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "specialist_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"specialist_id" varchar NOT NULL,
	"escalation_id" varchar NOT NULL,
	"conversation_id" varchar NOT NULL,
	"assignment_type" text NOT NULL,
	"assignment_reason" text,
	"routing_score" integer,
	"status" text DEFAULT 'assigned',
	"accepted_at" timestamp,
	"declined_at" timestamp,
	"decline_reason" text,
	"completed_at" timestamp,
	"estimated_time_required" integer,
	"actual_time_spent" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "specialists" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"specialization" text,
	"is_available" boolean DEFAULT true,
	"current_caseload" integer DEFAULT 0,
	"max_caseload" integer DEFAULT 10,
	"phone" text,
	"preferred_contact_method" text DEFAULT 'email',
	"working_hours" jsonb,
	"timezone" text DEFAULT 'Australia/Melbourne',
	"average_response_time" integer,
	"case_resolution_rate" integer,
	"expertise_rating" integer DEFAULT 5,
	"status" text DEFAULT 'active',
	"last_seen_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "specialists_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "stakeholders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"role" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"organization" text,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ticket_message_embeddings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" varchar NOT NULL,
	"vector" text NOT NULL,
	"model" text DEFAULT 'text-embedding-ada-002',
	"chunk_index" integer DEFAULT 0,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ticket_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"freshdesk_message_id" varchar,
	"author_id" varchar,
	"author_role" text NOT NULL,
	"author_name" text,
	"author_email" text,
	"is_private" boolean DEFAULT false,
	"body_html" text,
	"body_text" text NOT NULL,
	"message_type" text DEFAULT 'reply',
	"incoming_or_outgoing" text,
	"created_at" timestamp DEFAULT now(),
	"freshdesk_created_at" timestamp,
	CONSTRAINT "ticket_messages_freshdesk_message_id_unique" UNIQUE("freshdesk_message_id")
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar,
	"worker_id" varchar,
	"case_type" text DEFAULT 'pre_employment' NOT NULL,
	"claim_type" text,
	"status" text DEFAULT 'NEW' NOT NULL,
	"priority" text DEFAULT 'medium',
	"priority_level" text DEFAULT 'Low',
	"priority_score" integer DEFAULT 0,
	"flag_red_count" integer DEFAULT 0,
	"flag_amber_count" integer DEFAULT 0,
	"flag_green_count" integer DEFAULT 0,
	"sla_due_at" timestamp,
	"last_update_at" timestamp DEFAULT now(),
	"assigned_owner" varchar,
	"company_name" text,
	"fd_id" integer,
	"fd_company_id" bigint,
	"subject" text,
	"workcover_bool" boolean DEFAULT false,
	"requester_id" varchar,
	"assignee_id" varchar,
	"age_days" integer DEFAULT 0,
	"last_unseen_activity_at" timestamp,
	"next_action_due_at" timestamp,
	"requires_action_bool" boolean DEFAULT false,
	"tags_json" jsonb,
	"custom_json" jsonb,
	"next_step" text DEFAULT 'Initial case review and triage',
	"last_step" text,
	"last_step_completed_at" timestamp,
	"assigned_to" text,
	"rtw_step" text DEFAULT 'eligibility_0_28',
	"workplace_jurisdiction" text DEFAULT 'VIC',
	"compliance_status" text DEFAULT 'compliant',
	"last_participation_date" text,
	"next_deadline_date" text,
	"next_deadline_type" text,
	"follow_up_24hr_sent" boolean DEFAULT false,
	"follow_up_day3_sent" boolean DEFAULT false,
	"form_type" text,
	"risk_level" text,
	"current_status" text,
	"next_steps_json" jsonb,
	"escalation_level" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tickets_fd_id_unique" UNIQUE("fd_id")
);
--> statement-breakpoint
CREATE TABLE "treatment_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"provider_type" text NOT NULL,
	"provider_name" text,
	"frequency" text,
	"next_appointment" timestamp,
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_idempotency" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" varchar NOT NULL,
	"endpoint" varchar NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	CONSTRAINT "webhook_idempotency_submission_endpoint_unique" UNIQUE("submission_id","endpoint")
);
--> statement-breakpoint
CREATE TABLE "webhook_rate_limits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"request_count" integer DEFAULT 1 NOT NULL,
	"window_start" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "worker_info_sheets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"worker_id" varchar NOT NULL,
	"ticket_id" varchar NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"returned_at" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"escalation_level" integer DEFAULT 0,
	"last_escalated_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "worker_info_sheets_worker_id_unique" UNIQUE("worker_id")
);
--> statement-breakpoint
CREATE TABLE "worker_participation_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" varchar NOT NULL,
	"workflow_step_id" varchar,
	"event_type" text NOT NULL,
	"event_date" text NOT NULL,
	"scheduled_date" text,
	"participation_status" text NOT NULL,
	"legislation_basis" jsonb,
	"notice_given_date" text,
	"notice_period_days" integer,
	"reason_for_non_participation" text,
	"evidence_attachment_id" varchar,
	"stakeholder_involved" varchar,
	"compliance_notes" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"date_of_birth" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"role_applied" text NOT NULL,
	"site" text,
	"role_title" text,
	"manager_name" text,
	"company" text,
	"date_of_injury" timestamp,
	"injury_description" text,
	"injury_severity" text,
	"expected_recovery_date" timestamp,
	"status_off_work" boolean DEFAULT false,
	"rtw_plan_present" boolean DEFAULT false
);
--> statement-breakpoint
ALTER TABLE "activity_timeline" ADD CONSTRAINT "activity_timeline_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_external_email_id_external_emails_id_fk" FOREIGN KEY ("external_email_id") REFERENCES "public"."external_emails"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archive_index" ADD CONSTRAINT "archive_index_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_feedback" ADD CONSTRAINT "case_feedback_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_feedback" ADD CONSTRAINT "case_feedback_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_providers" ADD CONSTRAINT "case_providers_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_providers" ADD CONSTRAINT "case_providers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_requests" ADD CONSTRAINT "check_requests_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_requests" ADD CONSTRAINT "check_requests_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_requests" ADD CONSTRAINT "check_requests_check_id_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."checks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_requests" ADD CONSTRAINT "check_requests_email_draft_id_email_drafts_id_fk" FOREIGN KEY ("email_draft_id") REFERENCES "public"."email_drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_users" ADD CONSTRAINT "client_users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_aliases" ADD CONSTRAINT "company_aliases_company_id_organizations_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_audit" ADD CONSTRAINT "compliance_audit_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_embeddings" ADD CONSTRAINT "document_embeddings_document_id_medical_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."medical_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_embeddings" ADD CONSTRAINT "document_embeddings_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_processing_jobs" ADD CONSTRAINT "document_processing_jobs_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_processing_jobs" ADD CONSTRAINT "document_processing_jobs_document_id_medical_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."medical_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_processing_logs" ADD CONSTRAINT "document_processing_logs_document_id_medical_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."medical_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_processing_logs" ADD CONSTRAINT "document_processing_logs_job_id_document_processing_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."document_processing_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_external_email_id_external_emails_id_fk" FOREIGN KEY ("external_email_id") REFERENCES "public"."external_emails"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_check_id_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."checks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_assigned_specialist_id_specialists_id_fk" FOREIGN KEY ("assigned_specialist_id") REFERENCES "public"."specialists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_emails" ADD CONSTRAINT "external_emails_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_emails" ADD CONSTRAINT "external_emails_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freshdesk_sync_logs" ADD CONSTRAINT "freshdesk_sync_logs_gpnet_ticket_id_tickets_id_fk" FOREIGN KEY ("gpnet_ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freshdesk_tickets" ADD CONSTRAINT "freshdesk_tickets_gpnet_ticket_id_tickets_id_fk" FOREIGN KEY ("gpnet_ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_letters" ADD CONSTRAINT "generated_letters_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_letters" ADD CONSTRAINT "generated_letters_template_id_letter_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."letter_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_letters" ADD CONSTRAINT "generated_letters_workflow_step_id_rtw_workflow_steps_id_fk" FOREIGN KEY ("workflow_step_id") REFERENCES "public"."rtw_workflow_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injuries" ADD CONSTRAINT "injuries_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_tokens" ADD CONSTRAINT "invitation_tokens_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_tokens" ADD CONSTRAINT "invitation_tokens_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_documents" ADD CONSTRAINT "medical_documents_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_documents" ADD CONSTRAINT "medical_documents_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_documents" ADD CONSTRAINT "medical_documents_reviewed_by_client_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."client_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_opinion_requests" ADD CONSTRAINT "medical_opinion_requests_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_opinion_requests" ADD CONSTRAINT "medical_opinion_requests_check_request_id_check_requests_id_fk" FOREIGN KEY ("check_request_id") REFERENCES "public"."check_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_training_runs" ADD CONSTRAINT "model_training_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_schedule" ADD CONSTRAINT "reminder_schedule_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restrictions" ADD CONSTRAINT "restrictions_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_history" ADD CONSTRAINT "risk_history_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rtw_plans" ADD CONSTRAINT "rtw_plans_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rtw_plans" ADD CONSTRAINT "rtw_plans_doctor_stakeholder_id_stakeholders_id_fk" FOREIGN KEY ("doctor_stakeholder_id") REFERENCES "public"."stakeholders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rtw_workflow_steps" ADD CONSTRAINT "rtw_workflow_steps_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "specialist_assignments" ADD CONSTRAINT "specialist_assignments_specialist_id_specialists_id_fk" FOREIGN KEY ("specialist_id") REFERENCES "public"."specialists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "specialist_assignments" ADD CONSTRAINT "specialist_assignments_escalation_id_escalations_id_fk" FOREIGN KEY ("escalation_id") REFERENCES "public"."escalations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "specialist_assignments" ADD CONSTRAINT "specialist_assignments_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stakeholders" ADD CONSTRAINT "stakeholders_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_message_embeddings" ADD CONSTRAINT "ticket_message_embeddings_message_id_ticket_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."ticket_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_info_sheets" ADD CONSTRAINT "worker_info_sheets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_info_sheets" ADD CONSTRAINT "worker_info_sheets_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_info_sheets" ADD CONSTRAINT "worker_info_sheets_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_participation_events" ADD CONSTRAINT "worker_participation_events_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_participation_events" ADD CONSTRAINT "worker_participation_events_workflow_step_id_rtw_workflow_steps_id_fk" FOREIGN KEY ("workflow_step_id") REFERENCES "public"."rtw_workflow_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_participation_events" ADD CONSTRAINT "worker_participation_events_evidence_attachment_id_attachments_id_fk" FOREIGN KEY ("evidence_attachment_id") REFERENCES "public"."attachments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_participation_events" ADD CONSTRAINT "worker_participation_events_stakeholder_involved_stakeholders_id_fk" FOREIGN KEY ("stakeholder_involved") REFERENCES "public"."stakeholders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workers" ADD CONSTRAINT "workers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_timeline_ticket_idx" ON "activity_timeline" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "activity_timeline_timestamp_idx" ON "activity_timeline" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "document_embeddings_document_id_idx" ON "document_embeddings" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_embeddings_ticket_id_idx" ON "document_embeddings" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "document_embeddings_model_idx" ON "document_embeddings" USING btree ("model");--> statement-breakpoint
CREATE INDEX "ticket_message_embeddings_message_id_idx" ON "ticket_message_embeddings" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "ticket_message_embeddings_model_idx" ON "ticket_message_embeddings" USING btree ("model");--> statement-breakpoint
CREATE INDEX "ticket_messages_ticket_id_idx" ON "ticket_messages" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_messages_freshdesk_id_idx" ON "ticket_messages" USING btree ("freshdesk_message_id");--> statement-breakpoint
CREATE INDEX "ticket_messages_author_role_idx" ON "ticket_messages" USING btree ("author_role");--> statement-breakpoint
CREATE INDEX "ticket_messages_freshdesk_created_at_idx" ON "ticket_messages" USING btree ("freshdesk_created_at");--> statement-breakpoint
CREATE INDEX "webhook_idempotency_submission_id_idx" ON "webhook_idempotency" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "webhook_idempotency_expires_at_idx" ON "webhook_idempotency" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "webhook_idempotency_endpoint_idx" ON "webhook_idempotency" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "webhook_rate_limits_ip_address_idx" ON "webhook_rate_limits" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "webhook_rate_limits_expires_at_idx" ON "webhook_rate_limits" USING btree ("expires_at");