# iTEKAD Mentor Reporting Tool

A comprehensive web-based application for mentors in the iTEKAD program to submit, track, and manage reports about their assigned mentees across multiple program types.

## Overview

The Mentor Reporting Tool streamlines reporting processes for iTEKAD program mentors, supporting both iTEKAD Bangkit and iTEKAD Maju programs with distinct workflows and requirements. It provides real-time visibility into mentee progress and enables data-driven program improvement decisions.

## Features

### Core Modules

- **Laporan Sesi iTEKAD Bangkit** - Session-based reporting with multi-session support (1-4), initiative tracking, and monthly sales data
- **Laporan Sesi iTEKAD Maju** - Enhanced progress reporting with advanced financial tracking and structured mentoring findings
- **Upward Mobility Form** - Specialized assessments for Sesi 2 and Sesi 4 measuring financial situations, digital adoption, and business improvements
- **GrowthWheel 360° Assessment** - Interactive business assessment with radar chart visualization covering 20 focus areas

### Key Capabilities

- Google OAuth authentication with role-based authorization
- Dynamic mentee management and historical data tracking
- Image upload with automatic compression and Google Drive integration
- Draft management with auto-save functionality
- Admin dashboard with system-wide analytics
- Personal statistics dashboard for individual mentor metrics

## Tech Stack

- **Frontend:** Next.js 13+ with React
- **Authentication:** NextAuth.js with Google OAuth
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Backend:** Next.js API Routes
- **Storage:** Google Sheets + Google Drive API
- **Deployment:** Vercel

## Prerequisites

- Node.js (v14 or higher)
- Google Cloud Platform account with OAuth credentials
- Google Sheets API access
- Google Drive API access

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Mnaimm/mentor-report-app.git
cd mentor-report-app
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables - Create a `.env.local` file:
```env
GOOGLE_CLIENT_ID=<Your Google OAuth Client ID>
GOOGLE_CLIENT_SECRET=<Your Google OAuth Client Secret>
NEXTAUTH_SECRET=<Your NextAuth encryption secret>
NEXTAUTH_URL=<Application base URL>
SHEET_ID_V8=<iTEKAD Bangkit sheet ID>
SHEET_ID_MAJU=<iTEKAD Maju sheet ID>
ADMIN_EMAILS=<Comma-separated admin email list>
APPS_SCRIPT_URL=<Google Apps Script deployment URL>
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
├── components/          # Reusable UI components
├── lib/                # Authentication & API utilities
├── pages/              # Next.js pages & API routes
│   ├── api/           # Backend API endpoints
│   └── admin/         # Admin-only pages
├── public/            # Static assets
└── styles/            # Global CSS styles
```

## Usage

### For Mentors

1. Sign in with your Google account
2. Select your assigned mentee from the dashboard
3. Choose the appropriate report type based on program requirements
4. Complete the required fields and upload necessary images
5. Submit the report or save as draft for later

### For Admins

1. Sign in with an admin-authorized Google account
2. Access the admin dashboard at `/admin`
3. View system-wide statistics and mentor activity
4. Monitor MIA mentees and report submission rates across all batches

## API Endpoints

### Core Data
- `/api/mapping` - Mentor-mentee relationships
- `/api/menteeData` - Historical mentee information
- `/api/submitReport` - Report submission (Bangkit)
- `/api/submitMajuReport` - Report submission (Maju)
- `/api/submit-upward-mobility` - Upward mobility assessments

### Analytics
- `/api/mentor-stats` - Individual mentor statistics
- `/api/admin/sales-status` - Administrative analytics

### Utilities
- `/api/upload-image` - Image processing and storage
- `/api/frameworkBank` - Structured response options

## Key Dependencies

- `next` - React framework for production
- `nextauth` - Authentication solution
- `recharts` - Chart visualization library
- `googleapis` - Google Sheets and Drive integration
- `html-to-image` - Chart export functionality
- `file-saver` - File download capabilities

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Security

- OAuth 2.0 authentication via Google
- Email-based admin authorization
- JWT-based session management
- Server-side validation for all submissions
- Mentor data isolation (access only to assigned mentees)

## Known Limitations

- Google Sheets API rate limits may affect concurrent users
- Client-side image processing may impact browser performance on older devices
- Sequential API calls in some data loading scenarios
- Storage quotas dependent on Google Drive limits

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary software developed for the iTEKAD program.

## Support

For issues and questions, please contact the iTEKAD program management team or create an issue in the repository.

## Version History

- **v1.0** (September 2025) - Initial production release
- Current Branch: `safe/push-aug21`

---

**Repository:** https://github.com/Mnaimm/mentor-report-app
**Last Updated:** September 2025
