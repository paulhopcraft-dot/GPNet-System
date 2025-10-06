# GPNet Case Management System

## Overview

GPNet is a comprehensive occupational health case management system designed to automate and streamline various workplace health assessments and injury management processes. It handles multiple case types including pre-employment checks, injury assessments, mental health evaluations, return-to-work planning, and exit health checks. The system captures health information, performs automated risk analysis using RAG scoring, generates assessment reports, and integrates with Freshdesk for case management. Its primary goal is to help employers manage workplace health risks, support injured workers, and ensure regulatory compliance.

## User Preferences

Preferred communication style: Simple, everyday language. Always default to admin view until further notice (impersonation disabled by default).

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite
- **UI Components**: Shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS with a custom navy blue theme
- **State Management**: TanStack Query (React Query)
- **Routing**: Wouter
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM
- **API Design**: RESTful JSON endpoints
- **Analysis Engine**: Custom risk assessment logic for RAG scoring and fit classifications
- **Error Handling**: Centralized middleware

### Data Storage Architecture
- **Primary Database**: PostgreSQL (Neon serverless)
- **Schema Design**: Relational (tickets, workers, form submissions, analyses, emails, attachments)
- **Connection Management**: `@neondatabase/serverless` connection pooling
- **Migrations**: Drizzle Kit
- **Data Validation**: Zod schemas (shared client/server)

### Authentication & Authorization
- **Session Management**: Express sessions with PostgreSQL store (`connect-pg-simple`)
- **Security**: Basic session-based authentication (under implementation)

### Risk Assessment System
- **RAG Scoring**: Automated Red/Amber/Green risk classification
- **Fit Classification**: Three-tier system (Fit, Fit with Restrictions, Not Fit)
- **Analysis Logic**: Includes lifting capacity, musculoskeletal injury tracking, repetitive task risk, and psychosocial screening.
- **Recommendation Engine**: Contextual recommendations based on identified risks.

### Case Management Integration
- **Ticket System**: Tracks health assessments with status progression (NEW → ANALYSING → AWAITING_REVIEW → READY_TO_SEND → COMPLETE)
- **Case Types**: Supports pre-employment checks, injury reports, mental health, return-to-work, exit checks, and general health screenings.
- **Thread Management**: Email correspondence linked to tickets.
- **Dashboard Analytics**: Real-time statistics and case monitoring.

## External Dependencies

### Database Services
- **Neon PostgreSQL**: Serverless PostgreSQL database.
- **Connection Library**: `@neondatabase/serverless`.

### UI Component Libraries
- **Radix UI**: Accessible UI primitives.
- **Lucide React**: Icon library.
- **Tailwind CSS**: Utility-first CSS framework.

### Form & Validation
- **React Hook Form**: Form state management.
- **Zod**: TypeScript-first schema validation.
- **Date-fns**: Date utility library.

### Development Tools
- **Vite**: Fast development server and build tool.
- **TypeScript**: Type safety.
- **ESBuild**: Fast JavaScript bundler.
- **Replit Integration**: Cartographer and error modal plugins.

### Integrations
- **Freshdesk API**: For ticket management and customer support.
- **PDF Generation**: For professional report generation.
- **Email Services**: For automated notifications and report delivery.
- **File Upload**: For document attachments.

### Design System Dependencies
- **Fonts**: Google Fonts (Inter, JetBrains Mono, DM Sans, Geist Mono, Architects Daughter, Fira Code).
- **Color System**: Custom HSL-based color palette with dark mode support.
- **Component Variants**: Class Variance Authority.