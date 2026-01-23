# Appointment App 

Appointment management application for Malo Clinic to help fill empty spots in doctor schedules.


## Overview

This application helps clinic staff fill empty appointment slots (from rescheduled appointments or cancellations) by:
- Displaying a doctor's schedule for the next 7 days
- Showing scheduled appointments and available empty slots
- Finding potential replacement patients with future appointments of the same type
- Displaying patient contact information for easy outreach

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript (API routes) and JavaScript (client components)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui (built on Radix UI)
- **Icons**: Lucide React
- **Backend API**: Glintt HMS API integration

## Features

- 🔍 **Doctor Schedule View**: View appointments and availability for a specific doctor
- 📅 **7-Day Schedule**: See the next week's schedule at a glance
- ✅ **Empty Slot Detection**: Easily identify available appointment slots
- 📞 **Patient Replacement Finder**: Find patients with future appointments of the same type
- 👤 **Patient Contact Info**: Display phone numbers for quick contact
- 🎨 **Modern UI**: Clean, responsive interface built with shadcn/ui components

## Project Structure

```
appointment-app/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/                    # API routes (TypeScript)
│   │   │   │   └── glintt/
│   │   │   │       ├── schedule/       # Get doctor schedule
│   │   │   │       ├── appointments/   # Get future appointments
│   │   │   │       └── patients/      # Get patient details
│   │   │   ├── [...slug]/             # Main app page (catch-all)
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx               # Home redirect
│   │   ├── components/                # React components
│   │   │   └── ui/                    # shadcn/ui components
│   │   ├── lib/
│   │   │   └── glintt-api.ts         # Glintt API utilities
│   │   └── config/                    # App configuration
│   └── public/                        # Static assets
└── examples/                          # API integration examples
    └── Glintt/                        # Glintt HMS API examples
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Glintt HMS API credentials

### Installation

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment example file:
```bash
cp env.example .env.local
```

4. Update `.env.local` with your Glintt API credentials:
```env
GLINTT_URL=https://your-glintt-api-url.com
GLINTT_CLIENT_ID=your-client-id
GLINTT_CLIENT_SECRET=your-client-secret
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm start
```

## How It Works

1. **Enter Doctor Code**: Input the doctor's code to view their schedule
2. **View Schedule**: The app displays all appointments and available slots for the next 7 days
3. **Select Empty Slot**: Click on any empty slot to find replacement patients
4. **Find Replacements**: The app searches for patients with future appointments of the same type (service/medical act)
5. **Contact Patients**: View patient phone numbers for easy outreach

## API Integration

The application integrates with the Glintt HMS API:

- **Authentication**: OAuth token-based authentication
- **Schedule Endpoint**: Fetches doctor schedules and availability
- **Appointments Endpoint**: Retrieves future appointments filtered by type
- **Patient Endpoint**: Gets patient details including contact information

See `examples/Glintt/` for detailed API documentation and examples.

## Examples Folder

The `examples/` directory contains reference code and documentation for development context. It includes:
- **Glintt API examples**: Python scripts demonstrating how to interact with the Glintt HMS API
- **API documentation**: Detailed endpoint documentation and usage examples
- **Integration patterns**: Examples of authentication, scheduling, and data retrieval

These examples serve as reference material for understanding the Glintt API and are not part of the deployed application.

## Deployment

### Vercel Deployment

When deploying to Vercel:

1. **Select the frontend subfolder** as the root directory in your Vercel project settings
2. **Framework Preset**: Select "Next.js"
3. **Build Command**: `npm run build` (default)
4. **Output Directory**: `.next` (default)
5. **Install Command**: `npm install` (default)

The Vercel project should point to the `frontend/` directory, not the repository root.

## Architecture

- **Frontend**: Next.js client components using React hooks for state management
- **Backend**: Next.js API routes handling Glintt API communication
- **Code Organization**: Modular structure with separate API utilities and UI components
- **Type Safety**: TypeScript for API routes, JavaScript for client components (as per project requirements)

## Configuration

- `frontend/src/lib/glintt-api.ts` - Glintt API integration logic
- `frontend/src/config/app.js` - Application metadata
- `frontend/env.example` - Environment variable template

## Future Enhancements

- Reschedule functionality
- SMS/email notifications
- Appointment history tracking
- Multiple doctor support
- Advanced filtering and search

