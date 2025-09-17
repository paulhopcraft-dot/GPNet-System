# GPNet Pre-Employment Check System

## Overview

GPNet is a comprehensive pre-employment health check system designed to automate and streamline the process of medical assessments for job candidates. The system captures candidate health information through structured forms, performs automated risk analysis using RAG scoring (Red/Amber/Green), generates fit classification reports, and integrates with Freshdesk for case management. The primary goal is to help employers identify potential health risks before hiring to prevent costly WorkCover claims and ensure workplace safety.

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
- **Ticket System**: Each pre-employment check creates a tracked case with status progression
- **Status Flow**: NEW → ANALYSING → AWAITING_REVIEW → READY_TO_SEND → COMPLETE
- **Thread Management**: Email correspondence linked to tickets for audit trail
- **Dashboard Analytics**: Real-time statistics and case monitoring

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