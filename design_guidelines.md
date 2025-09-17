# GPNet Pre-Employment Check System - Design Guidelines

## Design Approach
**System-Based Approach**: Using a professional, enterprise-focused design system (Material Design/Carbon inspired) given the utility-focused nature of HR/employment verification systems where efficiency, trust, and compliance are paramount.

## Design Principles
- **Trust & Professionalism**: Clean, authoritative design that instills confidence
- **Process Clarity**: Clear visual hierarchy showing multi-step verification flow
- **Data Integrity**: Emphasis on secure, accurate information handling
- **Accessibility**: WCAG compliant for diverse user base

## Core Design Elements

### A. Color Palette
**Light Mode:**
- Primary: 210 85% 25% (Professional navy blue)
- Secondary: 210 25% 45% (Muted blue-gray)
- Success: 120 65% 35% (Verification green)
- Warning: 40 85% 50% (Attention amber)
- Error: 5 75% 45% (Alert red)

**Dark Mode:**
- Primary: 210 75% 65% (Lighter navy)
- Secondary: 210 15% 65% (Light gray-blue)
- Background: 220 15% 12% (Dark professional)

### B. Typography
- **Primary**: Inter (clean, professional)
- **Secondary**: JetBrains Mono (for reference numbers, codes)
- Hierarchy: H1 (32px), H2 (24px), H3 (18px), Body (16px), Small (14px)

### C. Layout System
**Tailwind spacing units: 2, 4, 6, 8, 12, 16**
- Consistent 6-unit grid system
- Card-based layouts with 6-unit padding
- 8-unit gaps between major sections
- 4-unit spacing for form elements

### D. Component Library

**Navigation:**
- Top navigation bar with clear process steps
- Breadcrumb navigation for multi-step forms
- Progress indicators showing completion status

**Forms:**
- Clean input fields with clear labels
- Grouped sections for different verification types
- Upload areas for document submission
- Status indicators (pending, verified, failed)

**Data Display:**
- Structured cards for candidate information
- Timeline components for verification progress
- Status badges with appropriate colors
- Data tables for bulk processing

**Overlays:**
- Modal dialogs for document review
- Toast notifications for status updates
- Loading states for verification processes

## Key Features Emphasis

### Dashboard Design
- Clean overview with verification pipeline
- Quick stats cards (pending, completed, flagged)
- Recent activity feed
- Action-oriented CTAs

### Verification Flow
- Step-by-step wizard interface
- Clear progress indication
- Document upload with preview
- Real-time status updates

### Results Display
- Clear pass/fail indicators
- Detailed breakdown by verification type
- Exportable reports
- Audit trail visibility

## Images
**No large hero images** - this is a utility-focused application
- Small icons for verification types (education, employment, criminal)
- Document preview thumbnails
- Status indicator icons
- User avatar placeholders
- Company logo placement in header

The design should feel authoritative and trustworthy while remaining user-friendly for HR professionals managing multiple verification processes simultaneously.