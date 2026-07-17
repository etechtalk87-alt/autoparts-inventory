# AutoParts Inventory Management System

A modern web application for managing automotive parts inventory across multiple branches, with real-time stock tracking, donor vehicle management, and comprehensive admin dashboards.

## Tech Stack

- **Frontend Framework**: React 18 with Hooks
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: React Context API (Authentication)
- **Backend Database**: Supabase (PostgreSQL)
- **Charts & Visualization**: Recharts
- **Routing**: React Router v6
- **Code Quality**: Oxlint

## Features

- **Multi-branch inventory management** - Track parts across multiple locations
- **Donor vehicle tracking** - Manage donor vehicles with VIN decoding via NHTSA API
- **Sales management** - Record and track part sales with currency support (AED/USD)
- **Role-based access control** - Company admin and branch staff roles
- **Soft-delete & audit logging** - Track part deletion history and changes
- **Aging stock detection** - Identify inventory that has been in stock too long
- **Admin dashboard** - Real-time metrics, branch analytics, inventory trends
- **Responsive design** - Works on desktop and tablet devices

## Project Setup

### Prerequisites

- Node.js 16+ and npm
- Supabase account and project
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd AutoPartsInventory
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

### Development

Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Building for Production

Build the project:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Environment Variables

Required environment variables (see `.env.example`):

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous API key |

Get these values from your Supabase project:
1. Go to https://supabase.com
2. Open your project settings
3. Navigate to "API" section
4. Copy the Project URL and Anon Key

## Deployment

### Deploying to Vercel

1. Push your repository to GitHub/GitLab/Bitbucket

2. Connect your repository to Vercel:
   - Go to https://vercel.com
   - Click "Import Project" and select your repository

3. Configure environment variables:
   - In Vercel dashboard, go to project Settings → Environment Variables
   - Add the required variables from `.env.example`:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`

4. Deploy:
   - Vercel will automatically build and deploy on every push to main branch
   - Build command: `npm run build`
   - Output directory: `dist`

## Project Structure

```
src/
├── pages/           # Route pages (Dashboard, DonorVehicles, etc.)
├── components/      # Reusable React components
├── lib/            # Utility functions and context (Auth, Supabase client)
├── App.jsx         # Main app component with routing
└── main.jsx        # Entry point

supabase/           # Database migrations and SQL scripts
```

## Contributing

When making changes:
- Run `npm run build` to verify no build errors
- Test locally with `npm run dev`
- Ensure `.env` is never committed (it's in `.gitignore`)

## License

Proprietary - All rights reserved
