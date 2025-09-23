# Product Requirements Document (PRD)
## Mentor Reporting Tool

**Version:** 1.0  
**Date:** September 22, 2025  
**Project:** iTEKAD Mentor Reporting System  
**Repository:** mentor-report-app  

---

## 1. Product Overview

### 1.1 Purpose
The Mentor Reporting Tool is a comprehensive web-based application designed for mentors in the iTEKAD program to submit, track, and manage reports about their assigned mentees. The system supports multiple program types including iTEKAD Bangkit and iTEKAD Maju, each with distinct reporting workflows and requirements.

### 1.2 Target Users
- **Primary Users:** iTEKAD Program Mentors
- **Secondary Users:** Program Administrators
- **Stakeholders:** iTEKAD Program Management Team

### 1.3 Key Objectives
- Streamline mentor reporting processes
- Standardize data collection across different program types
- Provide real-time visibility into mentee progress
- Enable data-driven program improvement decisions
- Maintain comprehensive historical records

---

## 2. Technical Architecture

### 2.1 Technology Stack
- **Frontend Framework:** Next.js 13+ with React
- **Authentication:** NextAuth.js with Google OAuth
- **Styling:** Tailwind CSS
- **Charts & Visualization:** Recharts (GrowthWheel assessments)
- **Backend:** Next.js API Routes
- **Data Storage:** Google Sheets integration
- **File Storage:** Google Drive API
- **Deployment:** Vercel (inferred from Next.js setup)

### 2.2 Key Dependencies
```json
{
  "nextauth": "Google OAuth integration",
  "recharts": "Data visualization",
  "html-to-image": "Chart export functionality", 
  "file-saver": "File download capabilities",
  "google-auth-library": "Google API authentication",
  "googleapis": "Google Sheets/Drive integration"
}
```

### 2.3 Project Structure
```
├── components/          # Reusable UI components
├── lib/                # Authentication & API utilities
├── pages/              # Next.js pages & API routes
│   ├── api/           # Backend API endpoints
│   └── admin/         # Admin-only pages
├── public/            # Static assets
└── styles/            # Global CSS styles
```

---

## 3. Core Features & Functionality

### 3.1 Authentication & Authorization

#### User Authentication
- **Method:** Google OAuth via NextAuth.js
- **Session Management:** JWT-based sessions
- **User Identification:** Email-based user matching

#### Authorization Levels
- **Mentors:** Access to assigned mentee reports only
- **Admins:** Full system access including analytics dashboard
- **Role Determination:** Email-based admin list configuration

### 3.2 Main Reporting Modules

#### 3.2.1 Laporan Sesi iTEKAD Bangkit (`/laporan-sesi`)
**Purpose:** Session-based reporting for Bangkit program mentees

**Key Features:**
- Multi-session support (Sessions 1-4)
- Comprehensive mentee profiling
- Initiative tracking with action plans
- Monthly sales data collection (12-month tracking)
- Image upload requirements:
  - Session photos
  - Premises photos  
  - Profile photos
- MIA (Missing in Action) status management
- Mentor reflection notes

**Data Fields:**
- Session metadata (date, time, platform, location)
- Mentee background information
- Business focus areas and initiatives
- Financial performance metrics
- Attendance and engagement tracking

#### 3.2.2 Laporan Sesi iTEKAD Maju (`/laporan-maju`)
**Purpose:** Enhanced progress reporting for Maju program participants

**Key Features:**
- Advanced financial data tracking
- Structured mentoring findings format
- Session-specific content requirements
- Background data (editable only in Session 1)
- Enhanced MIA reporting with proof uploads
- Progress comparison capabilities

**Unique Aspects:**
- More detailed financial metrics
- Structured framework-based responses
- Enhanced validation rules
- Program-specific KPIs

#### 3.2.3 Upward Mobility Form (`/upward-mobility`)
**Purpose:** Specialized reporting for Sesi 2 and Sesi 4 assessments

**Key Metrics:**
- Financial situation (before/after analysis)
- Digital adoption levels
- Banking facility utilization
- Employment opportunity tracking
- Asset valuation changes
- Zakat payment status
- Business improvement indicators

**Assessment Areas:**
- Revenue growth
- Digital transformation
- Financial inclusion
- Business sustainability

#### 3.2.4 GrowthWheel 360° Assessment (`/growthwheel`)
**Purpose:** Interactive business assessment tool

**Features:**
- 20 focus area evaluation
- Interactive radar chart visualization
- Downloadable chart images (PNG format)
- 5-point scoring system
- Visual progress tracking

**Focus Areas Include:**
- Business model components
- Market analysis
- Financial management
- Operations efficiency
- Leadership development

### 3.3 Data Management System

#### 3.3.1 Mentee Management
- **Dynamic Loading:** Mentee data loaded based on mentor assignments
- **Batch Organization:** Mentees organized by program rounds/batches
- **Status Tracking:** Active, MIA, Completed status management
- **Historical Data:** Previous session data retrieval and display
- **Contact Information:** Integrated phone/WhatsApp communication

#### 3.3.2 File Upload & Storage
- **Image Compression:** Automatic compression for large files
- **Google Drive Integration:** Organized folder structure per mentee
- **Multiple File Types:** Support for various image formats
- **Batch Upload:** Multiple files per session capability
- **Storage Organization:** Automatic folder creation and management

#### 3.3.3 Draft Management
- **Local Storage:** Browser-based draft saving
- **Auto-save:** Periodic automatic draft creation
- **Draft Recovery:** Restoration on page reload
- **Data Persistence:** Form state preservation across sessions

### 3.4 Administrative Features

#### 3.4.1 Admin Dashboard (`/admin`)
**Key Capabilities:**
- System-wide mentor activity overview
- Batch-wise reporting statistics
- Sales data completion tracking
- MIA mentee monitoring across all mentors
- Collapsible data organization interface

**Analytics Provided:**
- Report submission rates
- Mentee progress distributions
- Program completion statistics
- Mentor performance metrics

#### 3.4.2 Personal Statistics Dashboard (`/`)
**Mentor-Specific Metrics:**
- Current round vs all-time statistics
- Individual mentee progress tracking
- Personal report submission history
- MIA status summaries for assigned mentees
- Performance benchmarking

---

## 4. Data Integration & Storage

### 4.1 Google Sheets Integration

#### Primary Data Sheets
1. **V8 Sheet:** Main repository for iTEKAD Bangkit reports
2. **LaporanMaju Sheet:** Dedicated storage for Maju program data
3. **Mapping Sheet:** Mentor-mentee relationship management
4. **Batch Sheet:** Program round/period configuration
5. **Bank Sheet:** Framework data for structured responses

#### Data Flow Architecture
```
User Input → Form Validation → API Processing → Google Sheets Storage
     ↓
Google Drive ← File Upload ← Image Processing ← File Selection
```

### 4.2 API Endpoint Architecture

#### Core Data APIs
- **`/api/mapping`** - Mentor-mentee relationship data
- **`/api/menteeData`** - Historical mentee information retrieval
- **`/api/laporanMajuData`** - Maju program-specific data
- **`/api/submitReport`** - Report submission processing
- **`/api/submitMajuReport`** - Maju report-specific submission
- **`/api/submit-upward-mobility`** - Upward mobility form processing

#### Analytics & Statistics APIs
- **`/api/mentor-stats`** - Individual mentor statistics
- **`/api/admin/sales-status`** - Administrative analytics
- **`/api/debug-report-emails`** - System debugging utilities

#### Utility APIs
- **`/api/frameworkBank`** - Structured response options
- **`/api/upload-proxy`** - File upload proxy handling
- **`/api/upload-image`** - Image processing and storage
- **`/api/test-env`** - Environment configuration testing

---

## 5. User Interface Design

### 5.1 Component Library

#### Core Components
- **`Layout`** - Main application structure and navigation
- **`Section`** - Content organization and grouping
- **`InfoCard`** - Information display cards

#### Form Components
- **`InputField`** - Text input with validation
- **`SelectField`** - Dropdown selection menus
- **`TextArea`** - Multi-line text input
- **`FileInput`** - File upload interface with drag-and-drop

### 5.2 Design Principles
- **Mobile-First:** Responsive design optimized for mobile devices
- **Progressive Enhancement:** Core functionality works across all devices
- **Accessibility:** WCAG compliance for form interactions
- **Consistency:** Standardized component usage across all pages

### 5.3 User Experience Features
- **Loading States:** Progress indicators for data operations
- **Error Handling:** User-friendly error messages and recovery options
- **Validation Feedback:** Real-time form validation with clear messaging
- **Navigation:** Intuitive flow between different reporting modules

---

## 6. Business Logic & Rules

### 6.1 Program Type Handling
- **Dynamic Form Rendering:** Forms adapt based on iTEKAD program type
- **Validation Rules:** Program-specific validation requirements
- **Data Storage Logic:** Separate storage strategies per program type
- **Field Requirements:** Different mandatory fields per program

### 6.2 Session Management Rules
- **Sequential Tracking:** Sessions must follow numbered sequence (1-4)
- **Historical Preservation:** Previous session data remains immutable
- **Session Dependencies:** Later sessions may reference earlier session data
- **Validation Logic:** Session-specific validation requirements

### 6.3 Status Management
#### Status Types
- **Active:** Normal reporting status, full functionality available
- **MIA (Missing in Action):** Special status requiring reason documentation
- **Completed:** Program graduation status, historical access only

#### Status Transitions
- Active → MIA (with reason and proof requirements)
- MIA → Active (with return documentation)
- Active/MIA → Completed (program completion)

### 6.4 File Processing Rules
- **Image Compression:** Automatic compression for files >1MB
- **File Organization:** Structured folder hierarchy in Google Drive
- **Naming Conventions:** Standardized file naming for easy retrieval
- **Storage Quotas:** Reasonable limits to prevent storage abuse

---

## 7. Data Flow & Integration Patterns

### 7.1 Standard Data Flow
1. **Authentication:** User authenticates via Google OAuth
2. **Authorization:** System verifies mentor permissions
3. **Mentee Selection:** Load assigned mentees from mapping data
4. **Data Population:** Retrieve historical data for context
5. **Form Interaction:** User completes relevant reporting forms
6. **Validation:** Client and server-side validation
7. **File Processing:** Images compressed and uploaded to Google Drive
8. **Data Submission:** Information saved to appropriate Google Sheets
9. **Confirmation:** Success/error feedback provided to user

### 7.2 Error Handling Strategy
- **Client-Side Validation:** Immediate feedback for form errors
- **Server-Side Validation:** Backend validation for data integrity
- **Network Error Handling:** Graceful handling of connectivity issues
- **Recovery Mechanisms:** Draft saving and data recovery options

---

## 8. Configuration & Environment Management

### 8.1 Environment Variables
```
GOOGLE_CLIENT_ID=<Google OAuth Client ID>
GOOGLE_CLIENT_SECRET=<Google OAuth Client Secret>
NEXTAUTH_SECRET=<NextAuth encryption secret>
NEXTAUTH_URL=<Application base URL>
SHEET_ID_V8=<iTEKAD Bangkit sheet ID>
SHEET_ID_MAJU=<iTEKAD Maju sheet ID>
ADMIN_EMAILS=<Comma-separated admin email list>
APPS_SCRIPT_URL=<Google Apps Script deployment URL>
```

### 8.2 Configuration Management
- **Program Headers:** Customizable headers for different program types
- **Field Mappings:** Flexible form field to sheet column mappings
- **Validation Rules:** Configurable validation requirements
- **Admin Controls:** Environment-based admin access configuration

---

## 9. Performance & Scalability Considerations

### 9.1 Current Performance Characteristics
- **Client-Side Processing:** Image compression handled in browser
- **Multiple API Calls:** Sequential data loading for form population
- **Large Form State:** Complex state management in reporting components
- **Google API Rate Limits:** Dependent on Google Sheets/Drive API quotas

### 9.2 Scalability Factors
- **User Concurrency:** Limited by Google Sheets concurrent access
- **Data Volume:** Grows linearly with mentors and reporting frequency
- **File Storage:** Dependent on Google Drive storage quotas
- **API Performance:** Bottlenecked by Google API response times

---

## 10. Security & Compliance

### 10.1 Security Measures
- **OAuth Authentication:** Secure Google-based authentication
- **Email-Based Authorization:** Admin access controlled by email whitelist
- **Session Management:** Secure JWT-based session handling
- **API Security:** Server-side validation for all data submissions
- **File Upload Security:** Image validation and processing

### 10.2 Data Privacy
- **Mentor Isolation:** Mentors can only access assigned mentee data
- **Admin Oversight:** Administrators have read-only access to all data
- **Audit Trail:** Activity logging through Google Sheets timestamps
- **Data Retention:** Historical data preservation for program analysis

---

## 11. Known Technical Debt & Limitations

### 11.1 Current Technical Issues
- **File Path Inconsistencies:** Some duplicate files with "Copy" suffix
- **Mixed Validation Approaches:** Inconsistent validation patterns across forms
- **Complex State Management:** Large components with extensive state
- **Hardcoded Mappings:** Some column mappings are not configurable
- **Error Handling Variations:** Inconsistent error handling across modules

### 11.2 Performance Limitations
- **Client-Side Image Processing:** May cause browser performance issues
- **Sequential API Calls:** Could benefit from parallel data loading
- **Large Form Components:** Complex components may have rendering performance issues
- **Google Sheets Limitations:** Concurrent access and row limits

### 11.3 Scalability Concerns
- **Single Sheet Dependencies:** Heavy reliance on Google Sheets as primary database
- **File Storage Growth:** Unlimited file uploads could exceed storage quotas
- **API Rate Limiting:** Google API quotas may limit concurrent users
- **State Management Complexity:** Current approach may not scale to larger forms

---

## 12. Future Enhancement Opportunities

### 12.1 Technical Improvements
- **Database Migration:** Move from Google Sheets to dedicated database
- **Microservices Architecture:** Break down monolithic API structure
- **Caching Layer:** Implement Redis or similar for performance
- **Background Processing:** Async handling of file uploads and processing

### 12.2 Feature Enhancements
- **Notification System:** Email/SMS notifications for important events
- **Advanced Analytics:** Enhanced reporting and dashboard capabilities
- **Mobile App:** Native mobile application for field reporting
- **Integration APIs:** Connect with external program management systems

### 12.3 User Experience Improvements
- **Progressive Web App:** Offline capability and app-like experience
- **Advanced Search:** Enhanced filtering and search capabilities
- **Bulk Operations:** Batch processing for administrative tasks
- **Real-time Collaboration:** Live editing and collaboration features

---

## 13. Appendix

### 13.1 Glossary
- **iTEKAD:** Indonesian program for entrepreneurship development
- **Bangkit:** Specific iTEKAD program variant
- **Maju:** Advanced iTEKAD program for established businesses
- **MIA:** Missing in Action - mentee absence status
- **GrowthWheel:** Business assessment methodology
- **Upward Mobility:** Economic advancement measurement tool

### 13.2 Related Documentation
- Google Sheets API Documentation
- NextAuth.js Configuration Guide
- Tailwind CSS Documentation
- Recharts Visualization Library

### 13.3 Contact Information
- **Repository:** https://github.com/Mnaimm/mentor-report-app
- **Current Branch:** safe/push-aug21
- **Last Updated:** September 22, 2025

---

*This PRD documents the current state of the Mentor Reporting Tool as implemented in the existing codebase. It serves as a comprehensive reference for understanding the system's capabilities, architecture, and business requirements without recommending modifications to the existing implementation.*
