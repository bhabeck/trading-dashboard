// ─────────────────────────────────────────────
// Dashboard Configuration
// ─────────────────────────────────────────────
// Set these as environment variables in Cloudflare Pages:
//   VITE_API_URL   = https://api.benhabeck.com
//   VITE_API_TOKEN = (your generated token)
//
// For local development, create a .env file:
//   VITE_API_URL=http://localhost:5000
//   VITE_API_TOKEN=your-dev-token
// ─────────────────────────────────────────────

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const API_TOKEN = import.meta.env.VITE_API_TOKEN || 'changeme';
export const POLL_INTERVAL = 60_000; // Refresh signals every 60 seconds
export const DASHBOARD_PASSWORD = import.meta.env.VITE_DASHBOARD_PASSWORD || '';
