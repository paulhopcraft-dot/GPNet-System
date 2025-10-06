# GPNet Case Management System

## Overview

GPNet is a comprehensive occupational health case management system designed to automate and streamline various workplace health assessments and injury management processes. The system handles multiple case types including pre-employment checks, injury assessments, mental health evaluations, return-to-work planning, and exit health checks. It captures health information through structured forms, performs automated risk analysis using RAG scoring (Red/Amber/Green), generates assessment reports, and integrates with Freshdesk for comprehensive case management. The primary goal is to help employers manage workplace health risks, support injured workers, and ensure regulatory compliance.

## Recent Changes (October 6, 2025)

### Unresolved Tickets Only Filtering - COMPLETED ⚡
- **Feature**: Freshdesk import now filters to show only unresolved (active) tickets matching the Freshdesk UI's "unresolved" view
- **How It Works**:
  - Fetches tickets in 30-day historical windows going back 180 days (6 months)
  - Filters to only include unresolved ticket statuses: 2 (Open), 3 (Pending), 6 (Waiting on Customer), 7 (Waiting on Third Party)
  - Excludes resolved (4) and closed (5) tickets from import
  - Deduplicates tickets across multiple time windows
- **Benefits**:
  - **Clean dashboard** - Only shows active cases requiring attention
  - **Accurate counts** - Matches Freshdesk UI's unresolved ticket view
  - **Historical completeness** - Captures older unresolved tickets beyond 30-day API default
- **Technical Implementation**:
  - **Fetch Strategy**: 6 overlapping 30-day windows (0-30, 30-60, 60-90, 90-120, 120-150, 150-180 days ago)
  - **Status Filtering**: `unresolvedStatuses = [2, 3, 6, 7]` applied during fetch deduplication
  - **Status Mapping**: Added explicit mappings for status 6 (Waiting on Customer) → 'NEW' and status 7 (Waiting on Third Party) → 'NEW'
  - **API Limitation**: Freshdesk List API only returns tickets updated in last 30 days without `updated_since` parameter
- **Current Results**:
  - Importing 43 total unresolved tickets (down from 227 total when including resolved)
  - 19 unresolved Symmetry tickets (user expects 23 - 4-ticket gap likely due to tickets older than 180 days)
- **Operational Notes**:
  - Removed spam and deleted ticket imports to keep dashboard clean
  - Nightly sync at 2 AM continues to refresh unresolved tickets
  - Very old unresolved tickets (>180 days) may not be captured - extend window if needed

## Recent Changes (October 2, 2025)

### Automated Pre-Employment Report Generation with 1-Hour Delayed Email Delivery - COMPLETED ⚡
- **Feature**: Fully automated workflow for generating and emailing pre-employment health check reports with enforced 1-hour delay
- **How It Works**:
  1. Jotform webhook submission triggers automatic report generation
  2. Report data consolidated from ticket, worker, form submission, and risk analysis
  3. PDF generated using existing PDFService and pre-employment.hbs template
  4. PDF saved to object storage with unique storage key
  5. Report record created with status='generated' (NOT immediately emailed)
  6. Background scheduler runs every 15 minutes checking for eligible reports
  7. Reports older than 1 hour automatically queued for email delivery
  8. On success: status → 'sent', emailSentAt timestamp set
  9. On failure: status → 'failed', error details stored in metadata
- **Benefits**:
  - **Compliance buffer** - 1-hour delay allows for review/corrections before sending
  - **Reliable delivery** - Scheduler automatically retries processing every 15 minutes
  - **Audit trail** - Complete tracking of generation, delivery attempts, and outcomes
  - **Error resilience** - Failed reports marked with error details, no infinite retry loops
- **Technical Implementation**:
  - **Schema**: Added `reports` table with fields: id, ticketId, formSubmissionId, reportType, status, storageKey, emailSentAt, emailRecipient, metadata, createdAt, updatedAt
  - **Storage**: Added `createReport()`, `updateReport()`, `getReport()`, `getPendingReportsForEmail()` methods
  - **Service**: `ReportService` consolidates data and generates PDFs using existing templates
  - **Scheduler**: `ReportDeliveryScheduler` enforces 1-hour delay via SQL: `WHERE status='generated' AND emailSentAt IS NULL AND createdAt <= NOW() - INTERVAL '1 hour'`
  - **Security**: All `/api/reports/*` endpoints protected with requireAuth middleware
  - **Testing**: Manual trigger endpoint POST `/api/reports/scheduler/trigger` for admin/testing
- **API Endpoints**:
  - GET `/api/reports?ticketId=X` - Query reports by ticket (auth required)
  - GET `/api/reports/scheduler/status` - Check scheduler status (auth required)
  - POST `/api/reports/scheduler/trigger` - Manually trigger delivery check (auth required)
- **Operational Notes**:
  - Scheduler runs every 15 minutes starting immediately on server startup
  - Use `MANAGER_EMAIL` environment variable to configure recipient email
  - Failed reports remain in database with error metadata for debugging
  - Future enhancement: Add organization-specific manager emails to settings

### Real-Time Freshdesk Webhook Sync - COMPLETED ⚡
- **Feature**: Live webhook integration for instant ticket synchronization from Freshdesk to GPNet
- **How It Works**:
  - Freshdesk sends webhook to `/api/medical-documents/freshdesk-webhook` when tickets are created/updated
  - System immediately imports/updates the ticket using `freshdeskImportService.importSingleTicket()`
  - Auto-creates or updates organizations based on Freshdesk company data
  - Processes attachments in background queue for medical document analysis
- **Benefits**:
  - **Instant sync** - No more 24-hour wait for nightly batch import
  - **Cost efficient** - Webhooks are FREE, uses zero API calls for receiving data
  - **Automatic alerts** - New submissions appear in GPNet dashboard immediately
- **Technical Implementation**:
  - Added `FreshdeskService.getCompany()` method to fetch single company details
  - Added `FreshdeskImportService.importSingleTicket()` for real-time single-ticket imports
  - Enhanced webhook endpoint to trigger import before attachment processing
  - Maintains dual-sync: Real-time webhooks (primary) + Nightly sync at 2 AM (backup)

### Freshdesk Organization Integration - COMPLETED (October 1, 2025)
- **Schema Updates**: 
  - Added `freshdeskCompanyId` (BIGINT), `domains`, and `description` fields to organizations table
  - Added `fdCompanyId` (BIGINT) to tickets table for company linkage
  - Storage methods: `findTicketByFreshdeskId()` and `findOrganizationByFreshdeskId()`
- **Data Migration**: 
  - Successfully imported 30 Freshdesk companies as organizations
  - Linked 62 Freshdesk tickets to their respective organizations
  - Organization distribution: Lower Murray Water (12 tickets), Symmetry (9), Cobild (6), Marley Spoon (4), Norton Gates (2), Attard Group (1), Princes Group (1)
  - 26 tickets unmapped (personal/individual cases without company associations)
- **Import Service Updates**:
  - Auto-creates organizations from Freshdesk companies with unique slug generation
  - Updates existing tickets with organization linkage when company data changes
  - Populates `fdCompanyId` field for all Freshdesk-sourced tickets
- **API Integration**: 
  - POST `/api/freshdesk/import` successfully syncs companies and tickets
  - Automatic organization mapping based on Freshdesk company IDs
  - Nightly sync job (2 AM) keeps data current

### Case Card Eye Panel Feature - Live Freshdesk Integration
- **Completed**: 8-tab case drawer interface accessible via eye icon on case cards
- **Schema Updates**: Added `restrictions`, `treatmentPlans`, and `activityTimeline` tables for comprehensive case data
- **UI Components**: 
  - CaseDrawer sheet component with Summary, Restrictions, Treatment, Reports, Analysis, Emails, Michelle, and Actions tabs
  - Integrated with Dashboard page - opens via eye icon click
  - Worker header with avatar, role, employer, and risk badge
  - Timeline visualization showing case history
  - Next Steps checklist with toggle functionality
  - ML predictions display (claim progression risk, healing ETA)
- **Backend**: 
  - GET `/api/case-drawer/:ticketId` endpoint now fetches **only real Freshdesk data** from database
  - Added `storage.getEmailsByTicket()` method with DESC sorting by sentAt
  - All mock/test data removed - displays only live Freshdesk emails, restrictions, and treatment plans
  - Real Freshdesk data: 62 tickets synced, 7 emails stored for 3 tickets
- **Testing**: Playwright tests passing with real Freshdesk ticket cfdcfa6d (3 emails displayed)
- **Security Notes**:
  - ✅ XSS safe: Email bodies rendered as plain text (React auto-escapes)
  - ✅ Authentication: Route protected with requireAuth middleware
- **Follow-up Work Needed**:
  - Populate restrictions/treatment/timeline tables from Freshdesk sync (tables exist but not yet populated)
  - Implement PATCH `/api/case-drawer/:ticketId/steps/:stepId` endpoint
  - Add error UI for failed queries/mutations

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Components**: Shadcn/ui component library built on Radix UI primitives for accessibility
- **Styling**: Tailwind CSS with custom design system featuring professional navy blue theme
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation for type-safe form handling

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **API Design**: RESTful endpoints with JSON responses
- **Analysis Engine**: Custom risk assessment logic for RAG scoring and fit classifications
- **Error Handling**: Centralized error middleware with proper HTTP status codes

### Data Storage Architecture
- **Primary Database**: PostgreSQL using Neon serverless database
- **Schema Design**: Relational structure with tickets, workers, form submissions, analyses, emails, and attachments tables
- **Connection Management**: Connection pooling with `@neondatabase/serverless`
- **Migrations**: Drizzle Kit for database schema migrations
- **Data Validation**: Zod schemas shared between client and server for consistency

### Authentication & Authorization
- **Session Management**: Express sessions with PostgreSQL session store using `connect-pg-simple`
- **Security**: Currently implementing basic session-based authentication (full implementation pending)

### Risk Assessment System
- **RAG Scoring**: Automated Red/Amber/Green risk classification based on health responses
- **Fit Classification**: Three-tier system (Fit, Fit with Restrictions, Not Fit)
- **Analysis Logic**: 
  - Lifting capacity assessment (flags if <15kg capacity)
  - Musculoskeletal injury tracking and scoring
  - Repetitive task risk evaluation
  - Psychosocial screening integration
- **Recommendation Engine**: Contextual recommendations based on identified risks

### Case Management Integration
- **Ticket System**: Each health assessment (pre-employment, injury, mental health, RTW, etc.) creates a tracked case with status progression
- **Case Types**: Supports multiple assessment types including pre-employment checks, injury reports, mental health assessments, return-to-work planning, exit checks, and general health screenings
- **Status Flow**: NEW → ANALYSING → AWAITING_REVIEW → READY_TO_SEND → COMPLETE
- **Thread Management**: Email correspondence linked to tickets for complete audit trail
- **Dashboard Analytics**: Real-time statistics and case monitoring across all case types

## External Dependencies

### Database Services
- **Neon PostgreSQL**: Serverless PostgreSQL database for primary data storage
- **Connection Library**: `@neondatabase/serverless` for optimized serverless connections

### UI Component Libraries
- **Radix UI**: Comprehensive set of accessible UI primitives for complex components
- **Lucide React**: Icon library for consistent iconography
- **Tailwind CSS**: Utility-first CSS framework with custom theme configuration

### Form & Validation
- **React Hook Form**: Form state management and validation
- **Zod**: TypeScript-first schema validation for form data and API contracts
- **Date-fns**: Date utility library for consistent date handling

### Development Tools
- **Vite**: Fast development server and build tool with HMR support
- **TypeScript**: Type safety across the entire application
- **ESBuild**: Fast JavaScript bundler for production builds
- **Replit Integration**: Development environment integration with cartographer and error modal plugins

### Planned Integrations
- **Freshdesk API**: Ticket management and customer support integration
- **PDF Generation**: Professional report generation for employer distribution
- **Email Services**: Automated email notifications and report delivery
- **File Upload**: Document attachment system for medical certificates and additional documentation

### Design System Dependencies
- **Fonts**: Google Fonts integration (Inter, JetBrains Mono, DM Sans, Geist Mono, Architects Daughter, Fira Code)
- **Color System**: Custom HSL-based color palette with dark mode support
- **Component Variants**: Class Variance Authority for consistent component styling