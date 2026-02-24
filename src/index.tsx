import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

// Route imports
import authRoutes from './routes/auth'
import customerRoutes from './routes/customers'
import employeeRoutes from './routes/employees'
import complaintRoutes from './routes/complaints'
import unitRoutes from './routes/units'
import kycRoutes from './routes/kyc'
import searchRoutes from './routes/search'
import notificationRoutes from './routes/notifications'
import dashboardRoutes from './routes/dashboard'
import calendarRoutes from './routes/calendar'
import vehicleRoutes from './routes/vehicles'
import internalComplaintRoutes from './routes/internal-complaints'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Static files
app.use('/static/*', serveStatic({ root: './public' }))

// API Routes
app.route('/api/auth', authRoutes)
app.route('/api/customers', customerRoutes)
app.route('/api/employees', employeeRoutes)
app.route('/api/complaints', complaintRoutes)
app.route('/api/units', unitRoutes)
app.route('/api/kyc', kycRoutes)
app.route('/api/search', searchRoutes)
app.route('/api/notifications', notificationRoutes)
app.route('/api/dashboard', dashboardRoutes)
app.route('/api/calendar', calendarRoutes)
app.route('/api/vehicles', vehicleRoutes)
app.route('/api/internal-complaints', internalComplaintRoutes)

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', app: 'Emperium City GRS' }))

// Serve the SPA for all other routes
app.get('*', (c) => {
  return c.html(getHTML())
})

function getHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Emperium City – Grievance Redressal System</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet"/>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet"/>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.10/dayjs.min.js"></script>
  <style>
    /* ═══════════════════════════════════════════════════════════
       EMPERIUM CITY GRS — DESIGN SYSTEM
       Brand: Deep Maroon + Warm Flame Orange + Gold
    ═══════════════════════════════════════════════════════════ */

    /* ─── CSS VARIABLES ─────────────────────────────────────── */
    :root {
      /* Brand Palette — from logo analysis */
      --ec-flame:    #E8431A;   /* Logo flame orange-red */
      --ec-orange:   #D03B14;   /* Mid tone */
      --ec-maroon:   #8B1A1A;   /* Rich maroon */
      --ec-deep:     #5C1010;   /* Deep maroon */
      --ec-darkest:  #2D0808;   /* Near-black sidebar */
      --ec-gold:     #C9853A;   /* Accent gold */
      --ec-cream:    #FFF7F5;   /* Warm cream bg */

      /* Semantic aliases */
      --primary:       var(--ec-maroon);
      --primary-light: #FEE2D5;
      --primary-dark:  var(--ec-deep);
      --accent-green:  #059669;
      --accent-blue:   #2563EB;
      --danger:        #DC2626;
      --warning:       #D97706;
      --info:          #0284C7;
      --success:       #059669;

      /* Sidebar dims */
      --sidebar-w: 248px;
    }

    /* ─── RESET & BASE ──────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { height: 100%; }
    body {
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
      background: #F5EDEB;
      color: #1F2937;
      font-size: 13.5px;
      line-height: 1.55;
      height: 100%;
    }

    /* ─── LAYOUT ────────────────────────────────────────────── */
    #app { height: 100%; }
    .app-shell { display: flex; height: 100vh; overflow: hidden; }

    /* ─── SIDEBAR ────────────────────────────────────────────── */
    .sidebar {
      width: var(--sidebar-w);
      min-width: var(--sidebar-w);
      background: linear-gradient(180deg, #1A0505 0%, #2A0808 40%, #3D0E0E 75%, #4A1010 100%);
      display: flex;
      flex-direction: column;
      box-shadow: 3px 0 24px rgba(0,0,0,0.4);
      position: relative;
      z-index: 50;
    }
    /* Subtle flame texture */
    .sidebar::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(ellipse at 120% 30%, rgba(232,67,26,0.12) 0%, transparent 60%),
        radial-gradient(ellipse at -20% 70%, rgba(201,133,58,0.08) 0%, transparent 60%);
      pointer-events: none;
    }

    /* Logo area */
    .sidebar-logo {
      padding: 20px 16px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      flex-shrink: 0;
      position: relative;
    }
    .sidebar-logo img { width: 140px; display: block; margin: 0 auto 10px; }
    .sidebar-logo .grs-label {
      text-align: center;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.35);
      background: rgba(255,255,255,0.06);
      border-radius: 20px;
      padding: 3px 12px;
      display: inline-block;
      width: 100%;
    }

    /* Nav sections */
    .sidebar-nav {
      flex: 1;
      overflow-y: auto;
      padding: 10px 10px;
    }
    .sidebar-nav::-webkit-scrollbar { width: 3px; }
    .sidebar-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
    .nav-section-label {
      font-size: 9.5px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.25);
      padding: 14px 10px 5px;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 12px;
      border-radius: 9px;
      margin-bottom: 2px;
      color: rgba(255,255,255,0.5);
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.18s;
      position: relative;
      cursor: pointer;
    }
    .nav-item:hover {
      color: rgba(255,255,255,0.9);
      background: rgba(232,67,26,0.15);
    }
    .nav-item.active {
      color: #fff;
      background: linear-gradient(90deg, rgba(232,67,26,0.9) 0%, rgba(160,41,26,0.85) 100%);
      box-shadow: 0 3px 14px rgba(232,67,26,0.38), inset 0 1px 0 rgba(255,255,255,0.12);
      font-weight: 600;
    }
    .nav-item.active::before {
      content: '';
      position: absolute;
      left: 0; top: 20%; bottom: 20%;
      width: 3px;
      background: #fff;
      border-radius: 0 3px 3px 0;
    }
    .nav-icon {
      width: 17px;
      text-align: center;
      font-size: 13px;
      flex-shrink: 0;
    }
    .nav-badge {
      margin-left: auto;
      background: var(--ec-flame);
      color: white;
      font-size: 10px;
      font-weight: 700;
      min-width: 18px;
      height: 18px;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
    }

    /* User panel */
    .sidebar-user {
      padding: 12px 10px;
      border-top: 1px solid rgba(255,255,255,0.07);
      flex-shrink: 0;
    }
    .user-card {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 10px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.08);
    }
    .user-avatar {
      width: 34px; height: 34px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--ec-flame), var(--ec-gold));
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 800;
      font-size: 13px;
      flex-shrink: 0;
    }
    .user-name { font-size: 12.5px; font-weight: 600; color: rgba(255,255,255,0.9); }
    .user-role { font-size: 10.5px; color: rgba(255,255,255,0.4); margin-top: 1px; }
    .logout-btn {
      margin-left: auto;
      color: rgba(255,255,255,0.3);
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 6px;
      font-size: 13px;
      transition: all 0.18s;
      flex-shrink: 0;
    }
    .logout-btn:hover { color: var(--ec-flame); background: rgba(232,67,26,0.12); }

    /* ─── MAIN AREA ──────────────────────────────────────────── */
    .main-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* ─── TOP BAR ────────────────────────────────────────────── */
    .topbar {
      background: white;
      border-bottom: 1px solid #EDEAE9;
      box-shadow: 0 1px 6px rgba(0,0,0,0.04);
      padding: 0 24px;
      height: 56px;
      display: flex;
      align-items: center;
      gap: 16px;
      flex-shrink: 0;
      z-index: 40;
    }
    .topbar-search {
      flex: 1;
      max-width: 420px;
      position: relative;
    }
    .topbar-search input {
      width: 100%;
      background: #F5EDEB;
      border: 1.5px solid #E8D8D5;
      border-radius: 10px;
      padding: 7px 14px 7px 36px;
      font-size: 13px;
      font-family: inherit;
      outline: none;
      transition: all 0.2s;
      color: #1F2937;
    }
    .topbar-search input:focus {
      border-color: var(--ec-flame);
      background: white;
      box-shadow: 0 0 0 3px rgba(232,67,26,0.1);
    }
    .topbar-search .search-icon {
      position: absolute;
      left: 11px;
      top: 50%;
      transform: translateY(-50%);
      color: #9CA3AF;
      font-size: 12px;
    }
    .topbar-right { margin-left: auto; display: flex; align-items: center; gap: 12px; }
    .topbar-date {
      font-size: 12px;
      color: #9CA3AF;
      font-weight: 500;
    }
    .notif-btn {
      position: relative;
      width: 36px; height: 36px;
      border-radius: 9px;
      border: 1.5px solid #E8D8D5;
      background: white;
      color: #6B7280;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.18s;
      font-size: 14px;
    }
    .notif-btn:hover { border-color: var(--ec-flame); color: var(--ec-flame); background: #FFF0EC; }
    .notif-dot {
      position: absolute;
      top: -4px; right: -5px;
      background: var(--ec-flame);
      color: white;
      font-size: 9px;
      font-weight: 700;
      min-width: 17px; height: 17px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 3px;
      border: 2px solid white;
    }

    /* ─── PAGE CONTENT ───────────────────────────────────────── */
    .page-wrap {
      flex: 1;
      overflow-y: auto;
      padding: 24px 28px;
      background: #F5EDEB;
    }
    .page-wrap::-webkit-scrollbar { width: 5px; }
    .page-wrap::-webkit-scrollbar-thumb { background: #D4C5C2; border-radius: 5px; }

    /* ─── PAGE HEADER ────────────────────────────────────────── */
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 22px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .page-title {
      font-size: 20px;
      font-weight: 800;
      color: #111827;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .page-title-icon {
      width: 38px; height: 38px;
      border-radius: 10px;
      background: linear-gradient(135deg, var(--ec-flame), var(--ec-maroon));
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 16px;
      box-shadow: 0 3px 10px rgba(232,67,26,0.3);
    }
    .page-subtitle { font-size: 12.5px; color: #9CA3AF; margin-top: 3px; }
    .page-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }

    /* ─── CARDS ──────────────────────────────────────────────── */
    .card {
      background: white;
      border-radius: 14px;
      border: 1px solid rgba(0,0,0,0.055);
      box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.04);
    }
    .card-hover { transition: all 0.2s; }
    .card-hover:hover {
      box-shadow: 0 6px 24px rgba(139,26,26,0.1);
      border-color: rgba(232,67,26,0.18);
      transform: translateY(-1px);
    }
    .card-header {
      padding: 16px 20px;
      border-bottom: 1px solid #F3F4F6;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .card-title { font-size: 14px; font-weight: 700; color: #111827; }
    .card-body { padding: 20px; }

    /* ─── STAT CARDS ─────────────────────────────────────────── */
    .stat-card {
      border-radius: 14px;
      padding: 18px 20px;
      color: white;
      position: relative;
      overflow: hidden;
    }
    .stat-card::after {
      content: '';
      position: absolute;
      right: -18px; bottom: -18px;
      width: 90px; height: 90px;
      border-radius: 50%;
      background: rgba(255,255,255,0.1);
    }
    .stat-card::before {
      content: '';
      position: absolute;
      right: 12px; top: -12px;
      width: 60px; height: 60px;
      border-radius: 50%;
      background: rgba(255,255,255,0.07);
    }
    .stat-number { font-size: 28px; font-weight: 800; line-height: 1; }
    .stat-label { font-size: 12px; margin-top: 5px; opacity: 0.85; font-weight: 500; }
    .stat-sub { font-size: 11px; margin-top: 6px; opacity: 0.65; }
    .stat-icon {
      position: absolute;
      right: 16px; top: 50%;
      transform: translateY(-50%);
      font-size: 28px;
      opacity: 0.25;
    }
    /* Card variants */
    .sc-flame  { background: linear-gradient(135deg, #E8431A 0%, #8B1A1A 100%); }
    .sc-gold   { background: linear-gradient(135deg, #C9853A 0%, #8B5E1A 100%); }
    .sc-green  { background: linear-gradient(135deg, #059669 0%, #047857 100%); }
    .sc-blue   { background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%); }
    .sc-purple { background: linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%); }
    .sc-teal   { background: linear-gradient(135deg, #0891B2 0%, #0E7490 100%); }
    .sc-rose   { background: linear-gradient(135deg, #E11D48 0%, #BE123C 100%); }

    /* ─── MINI STAT TILES ────────────────────────────────────── */
    .mini-stat {
      background: white;
      border-radius: 12px;
      padding: 14px 16px;
      border: 1px solid rgba(0,0,0,0.055);
      text-align: center;
    }
    .mini-stat-num { font-size: 22px; font-weight: 800; }
    .mini-stat-lbl { font-size: 11px; color: #6B7280; margin-top: 3px; font-weight: 500; }

    /* ─── PIPELINE PILL ──────────────────────────────────────── */
    .pipeline-pill {
      display: flex;
      align-items: center;
      background: white;
      border-radius: 12px;
      padding: 12px 16px;
      border: 1px solid rgba(0,0,0,0.055);
      gap: 12px;
    }
    .pipeline-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .pipeline-num { font-size: 20px; font-weight: 800; color: #111827; }
    .pipeline-lbl { font-size: 11px; color: #6B7280; font-weight: 500; }

    /* ─── BUTTONS ────────────────────────────────────────────── */
    button, .btn { cursor: pointer; border: none; font-family: inherit; }
    .btn-primary {
      background: linear-gradient(135deg, #E8431A 0%, #8B1A1A 100%);
      color: white;
      padding: 8px 18px;
      border-radius: 9px;
      font-weight: 600;
      font-size: 13px;
      transition: all 0.18s;
      box-shadow: 0 2px 8px rgba(232,67,26,0.32);
      display: inline-flex;
      align-items: center;
      gap: 7px;
      border: none;
      cursor: pointer;
    }
    .btn-primary:hover {
      background: linear-gradient(135deg, #CC3A15 0%, #6B1414 100%);
      box-shadow: 0 4px 14px rgba(232,67,26,0.42);
      transform: translateY(-1px);
    }
    .btn-primary:active { transform: translateY(0); }

    .btn-secondary {
      background: linear-gradient(135deg, #5C1010 0%, #3D0808 100%);
      color: white;
      padding: 8px 18px;
      border-radius: 9px;
      font-weight: 600;
      font-size: 13px;
      transition: all 0.18s;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      border: none;
      cursor: pointer;
    }
    .btn-secondary:hover { opacity: 0.88; transform: translateY(-1px); }

    .btn-outline {
      background: transparent;
      color: var(--ec-maroon);
      padding: 7px 16px;
      border-radius: 9px;
      border: 1.5px solid var(--ec-maroon);
      font-weight: 600;
      font-size: 13px;
      transition: all 0.18s;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      cursor: pointer;
    }
    .btn-outline:hover { background: #FEE2D5; }

    .btn-danger {
      background: linear-gradient(135deg, #DC2626, #B91C1C);
      color: white;
      padding: 8px 18px;
      border-radius: 9px;
      font-weight: 600;
      font-size: 13px;
      border: none;
      cursor: pointer;
      transition: all 0.18s;
      display: inline-flex;
      align-items: center;
      gap: 7px;
    }
    .btn-danger:hover { opacity: 0.88; transform: translateY(-1px); }

    .btn-success {
      background: linear-gradient(135deg, #059669, #047857);
      color: white;
      padding: 8px 18px;
      border-radius: 9px;
      font-weight: 600;
      font-size: 13px;
      border: none;
      cursor: pointer;
      transition: all 0.18s;
      display: inline-flex;
      align-items: center;
      gap: 7px;
    }
    .btn-ghost {
      background: transparent;
      color: #6B7280;
      padding: 7px 14px;
      border-radius: 9px;
      border: 1.5px solid #E5E7EB;
      font-weight: 500;
      font-size: 13px;
      transition: all 0.18s;
      cursor: pointer;
    }
    .btn-ghost:hover { background: #F9FAFB; color: #374151; }

    .btn-sm { padding: 5px 12px !important; font-size: 12px !important; border-radius: 7px !important; gap: 5px !important; }
    .btn-xs { padding: 3px 9px !important; font-size: 11px !important; border-radius: 6px !important; }
    .btn-icon {
      width: 32px; height: 32px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      transition: all 0.18s;
      cursor: pointer;
      border: none;
    }
    .btn-icon-ghost { background: transparent; color: #6B7280; border: 1.5px solid #E5E7EB; }
    .btn-icon-ghost:hover { background: #F3F4F6; color: #374151; }

    /* ─── FORMS ──────────────────────────────────────────────── */
    .form-group { margin-bottom: 14px; }
    .form-label {
      display: block;
      font-size: 12px;
      font-weight: 700;
      color: #374151;
      margin-bottom: 6px;
      letter-spacing: 0.01em;
    }
    .form-input {
      width: 100%;
      border: 1.5px solid #E5E7EB;
      border-radius: 9px;
      padding: 9px 13px;
      font-size: 13px;
      font-family: inherit;
      outline: none;
      transition: all 0.18s;
      background: #FAFAFA;
      color: #1F2937;
    }
    .form-input:focus {
      border-color: var(--ec-flame);
      background: white;
      box-shadow: 0 0 0 3px rgba(232,67,26,0.1);
    }
    select.form-input { cursor: pointer; }
    textarea.form-input { resize: vertical; }
    .form-hint { font-size: 11px; color: #9CA3AF; margin-top: 4px; }

    /* Filter bar */
    .filter-bar {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .filter-select {
      border: 1.5px solid #E5E7EB;
      border-radius: 9px;
      padding: 7px 12px;
      font-size: 12.5px;
      font-family: inherit;
      background: white;
      color: #374151;
      outline: none;
      cursor: pointer;
      transition: border-color 0.18s;
    }
    .filter-select:focus { border-color: var(--ec-flame); }

    /* ─── STATUS BADGES ──────────────────────────────────────── */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 9px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      border: 1px solid transparent;
      white-space: nowrap;
    }
    /* Complaint status */
    .badge-open        { background: #FFF3E0; color: #E65100; border-color: #FFCC80; }
    .badge-assigned    { background: #E3F2FD; color: #1565C0; border-color: #90CAF9; }
    .badge-scheduled   { background: #EDE7F6; color: #4527A0; border-color: #B39DDB; }
    .badge-in_progress { background: #FCE4EC; color: #880E4F; border-color: #F48FB1; }
    .badge-resolved    { background: #E8F5E9; color: #1B5E20; border-color: #A5D6A7; }
    .badge-closed      { background: #F5F5F5; color: #424242; border-color: #E0E0E0; }
    .badge-pending     { background: #FFFDE7; color: #E65100; border-color: #FFE082; }
    .badge-approved    { background: #E8F5E9; color: #1B5E20; border-color: #A5D6A7; }
    .badge-rejected    { background: #FCE4EC; color: #880E4F; border-color: #F48FB1; }
    /* Role */
    .badge-employee  { background: #E3F2FD; color: #1565C0; border-color: #90CAF9; }
    .badge-sub_admin { background: #EDE7F6; color: #4527A0; border-color: #B39DDB; }
    .badge-admin     { background: #FCE4EC; color: #B71C1C; border-color: #EF9A9A; }
    /* Occupancy */
    .badge-vacant      { background: #F5F5F5; color: #616161; border-color: #E0E0E0; }
    .badge-occupied    { background: #E8F5E9; color: #1B5E20; border-color: #A5D6A7; }
    .badge-construction{ background: #FFF3E0; color: #E65100; border-color: #FFCC80; }

    /* ─── PRIORITY ───────────────────────────────────────────── */
    .prio-low    { color: #6B7280; }
    .prio-normal { color: #2563EB; }
    .prio-high   { color: #D97706; font-weight: 600; }
    .prio-urgent { color: #DC2626; font-weight: 700; }

    /* ─── TABLE ──────────────────────────────────────────────── */
    .data-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    .data-table th {
      text-align: left;
      padding: 10px 14px;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      color: #9CA3AF;
      background: #F9FAFB;
      border-bottom: 2px solid #F0F0F0;
    }
    .data-table td {
      padding: 11px 14px;
      border-bottom: 1px solid #F3F4F6;
      vertical-align: middle;
    }
    .data-table tbody tr { transition: background 0.15s; }
    .data-table tbody tr:hover { background: #FFF5F3; }
    .data-table tbody tr:last-child td { border-bottom: none; }

    /* ─── COMPLAINT CARD STRIPS ──────────────────────────────── */
    .complaint-card {
      border-left: 3.5px solid transparent;
      transition: all 0.15s;
    }
    .complaint-open        { border-left-color: #F59E0B; }
    .complaint-assigned    { border-left-color: #3B82F6; }
    .complaint-scheduled   { border-left-color: #8B5CF6; }
    .complaint-in_progress { border-left-color: #EC4899; }
    .complaint-resolved    { border-left-color: #10B981; }
    .complaint-closed      { border-left-color: #9CA3AF; }

    /* ─── KYC ────────────────────────────────────────────────── */
    .kyc-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
    }
    .kyc-done    { background: #ECFDF5; color: #065F46; }
    .kyc-pending { background: #FEF2F2; color: #991B1B; }
    .kyc-doc-card {
      border-radius: 12px;
      border: 1.5px solid #E5E7EB;
      overflow: hidden;
      transition: all 0.2s;
    }
    .kyc-doc-card:hover {
      box-shadow: 0 4px 16px rgba(139,26,26,0.1);
      border-color: rgba(232,67,26,0.25);
    }
    .kyc-history-item {
      border-top: 1px solid #F3F4F6;
      padding: 10px 14px;
      display: flex;
      gap: 10px;
    }
    .kyc-history-item:hover { background: #FFF5F3; }

    /* ─── MODAL ──────────────────────────────────────────────── */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(26,5,5,0.65);
      backdrop-filter: blur(5px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      animation: fadeIn 0.18s ease;
    }
    .modal {
      background: white;
      border-radius: 18px;
      width: 90%;
      max-width: 640px;
      max-height: 92vh;
      overflow-y: auto;
      box-shadow: 0 28px 70px rgba(0,0,0,0.28);
      animation: slideUp 0.22s cubic-bezier(0.34,1.3,0.64,1);
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px 16px;
      border-bottom: 1px solid #F3F4F6;
    }
    .modal-title { font-size: 16px; font-weight: 700; color: #111827; }
    .modal-close {
      width: 30px; height: 30px;
      border-radius: 8px;
      border: 1.5px solid #E5E7EB;
      background: white;
      color: #9CA3AF;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      transition: all 0.18s;
    }
    .modal-close:hover { background: #FEF2F2; border-color: #FECACA; color: #DC2626; }
    .modal-body { padding: 20px 24px; }
    .modal-footer {
      padding: 14px 24px;
      border-top: 1px solid #F3F4F6;
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }

    @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { transform: translateY(24px) scale(0.97); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }

    /* ─── TOASTS ─────────────────────────────────────────────── */
    #toast-container {
      position: fixed;
      top: 18px; right: 18px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .toast {
      padding: 12px 18px;
      border-radius: 12px;
      color: white;
      font-weight: 600;
      font-size: 13px;
      animation: toastIn 0.3s cubic-bezier(0.34,1.4,0.64,1);
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 260px;
      max-width: 380px;
    }
    .toast-success { background: linear-gradient(135deg, #059669, #047857); }
    .toast-error   { background: linear-gradient(135deg, #DC2626, #B91C1C); }
    .toast-info    { background: linear-gradient(135deg, #E8431A, #8B1A1A); }
    @keyframes toastIn { from { transform: translateX(110%) scale(0.9); opacity: 0; } to { transform: translateX(0) scale(1); opacity: 1; } }

    /* ─── TIMELINE ───────────────────────────────────────────── */
    .timeline { border-left: 2px solid #FEE2D5; padding-left: 18px; }
    .timeline-item { position: relative; margin-bottom: 18px; }
    .timeline-item::before {
      content: '';
      position: absolute;
      left: -24px; top: 5px;
      width: 11px; height: 11px;
      border-radius: 50%;
      background: var(--ec-flame);
      border: 2px solid white;
      box-shadow: 0 0 0 2px var(--ec-flame);
    }

    /* ─── SEARCH DROPDOWN ────────────────────────────────────── */
    #searchDropdown {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      width: 100%;
      background: white;
      border: 1.5px solid #E8D8D5;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12);
      max-height: 320px;
      overflow-y: auto;
      z-index: 200;
    }
    #searchDropdown .dd-section { padding: 8px 12px 4px; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9CA3AF; }
    #searchDropdown .dd-item { padding: 9px 14px; cursor: pointer; border-bottom: 1px solid #F9F5F4; transition: background 0.15s; }
    #searchDropdown .dd-item:hover { background: #FFF5F3; }
    #searchDropdown .dd-item:last-child { border-bottom: none; }

    /* ─── LOADING ────────────────────────────────────────────── */
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 260px;
      flex-direction: column;
      gap: 14px;
    }
    .spinner {
      width: 36px; height: 36px;
      border: 3px solid #F0E8E6;
      border-top-color: var(--ec-flame);
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
    }
    .loading-text { font-size: 13px; color: #9CA3AF; font-weight: 500; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ─── EMPTY STATE ────────────────────────────────────────── */
    .empty-state {
      text-align: center;
      padding: 48px 24px;
      color: #9CA3AF;
    }
    .empty-state i { font-size: 42px; margin-bottom: 14px; opacity: 0.4; }
    .empty-state p { font-size: 14px; }

    /* ─── MISC ───────────────────────────────────────────────── */
    .divider { border: none; border-top: 1px solid #F3F4F6; margin: 16px 0; }
    .text-muted { color: #9CA3AF; }
    .text-brand { color: var(--ec-flame); }
    .text-maroon { color: var(--ec-maroon); }
    .bg-brand-light { background: #FFF0EC; }
    .border-brand { border-color: var(--ec-flame); }
    .photo-preview { width: 80px; height: 80px; object-fit: cover; border-radius: 10px; border: 2px solid #FEE2D5; }
    input[type=file] { font-size: 12.5px; }
    .notification-dot { min-width: 18px; height: 18px; }

    /* Section sub-heading */
    .section-title {
      font-size: 10.5px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #9CA3AF;
      margin-bottom: 10px;
    }

    /* Progress bar */
    .progress-bar { height: 6px; border-radius: 10px; background: #F3F4F6; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 10px; transition: width 0.4s; }
    .progress-brand { background: linear-gradient(90deg, var(--ec-flame), var(--ec-maroon)); }

    /* Tab pills */
    .tab-group {
      display: flex;
      background: #F3F4F6;
      border-radius: 12px;
      padding: 4px;
      gap: 2px;
    }
    .tab-pill {
      padding: 7px 16px;
      border-radius: 9px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      background: transparent;
      color: #6B7280;
      transition: all 0.18s;
    }
    .tab-pill.active {
      background: linear-gradient(135deg, var(--ec-flame), var(--ec-maroon));
      color: white;
      box-shadow: 0 2px 8px rgba(232,67,26,0.3);
    }
    .tab-pill:not(.active):hover { background: rgba(232,67,26,0.08); color: var(--ec-maroon); }

    /* Vehicle/complaint cards */
    .item-card {
      background: white;
      border-radius: 13px;
      border: 1.5px solid #F0ECE9;
      transition: all 0.2s;
    }
    .item-card:hover {
      border-color: rgba(232,67,26,0.22);
      box-shadow: 0 4px 18px rgba(139,26,26,0.1);
    }

    /* Notification item */
    .notif-item {
      padding: 14px 18px;
      border-bottom: 1px solid #F9F5F4;
      display: flex;
      gap: 14px;
      transition: background 0.15s;
    }
    .notif-item:hover { background: #FFF5F3; }
    .notif-item.unread { border-left: 3px solid var(--ec-flame); }

    /* ─── CALENDAR SPECIFIC ──────────────────────────────────── */
    .cal-day {
      border: 1.5px solid #F0ECE9;
      border-radius: 10px;
      min-height: 70px;
      padding: 6px;
      cursor: pointer;
      transition: all 0.15s;
      background: white;
    }
    .cal-day:hover { border-color: var(--ec-flame); background: #FFF5F3; }
    .cal-day.today { border-color: var(--ec-flame); background: #FFF0EC; }
    .cal-day.leave-day { border-color: #FECACA; background: #FEF2F2; }
    .cal-day.has-visits { border-color: #93C5FD; }
    .cal-day-num { font-size: 12px; font-weight: 600; color: #374151; }
    .cal-day.today .cal-day-num {
      color: white;
      background: var(--ec-flame);
      width: 22px; height: 22px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
    }
    .cal-visit-dot {
      font-size: 9.5px;
      padding: 1px 5px;
      border-radius: 4px;
      background: #DBEAFE;
      color: #1E40AF;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cal-leave-dot {
      font-size: 9.5px;
      padding: 1px 5px;
      border-radius: 4px;
      background: #FEE2E2;
      color: #991B1B;
      margin-top: 2px;
    }

    /* ─── SCROLLBAR ──────────────────────────────────────────── */
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #D4C5C2; border-radius: 5px; }
    ::-webkit-scrollbar-thumb:hover { background: #B8A9A5; }
  </style>
</head>
<body>
  <div id="app"></div>
  <div id="toast-container"></div>
  <script src="/static/app.js"></script>
</body>
</html>`
}

export default app
