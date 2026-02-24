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
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet"/>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.10/dayjs.min.js"></script>
  <style>
    :root {
      --primary: #1e3a5f;
      --secondary: #c9a84c;
      --accent: #2ecc71;
      --danger: #e74c3c;
      --warning: #f39c12;
      --info: #3498db;
    }
    body { font-family: 'Segoe UI', sans-serif; background: #f0f4f8; }
    .sidebar { background: var(--primary); min-height: 100vh; }
    .sidebar a { color: #a0aec0; transition: all 0.2s; }
    .sidebar a:hover, .sidebar a.active { color: #fff; background: rgba(255,255,255,0.1); }
    .card { background: white; border-radius: 12px; box-shadow: 0 1px 6px rgba(0,0,0,0.08); }
    .badge-open { background:#fef3c7; color:#92400e; }
    .badge-assigned { background:#dbeafe; color:#1e40af; }
    .badge-scheduled { background:#e0e7ff; color:#3730a3; }
    .badge-resolved { background:#d1fae5; color:#065f46; }
    .badge-closed { background:#f3f4f6; color:#374151; }
    .badge-employee { background:#dbeafe; color:#1e40af; }
    .badge-sub_admin { background:#e0e7ff; color:#5b21b6; }
    .badge-admin { background:#fee2e2; color:#991b1b; }
    .badge-vacant { background:#f3f4f6; color:#374151; }
    .badge-occupied { background:#d1fae5; color:#065f46; }
    .badge-construction { background:#fef3c7; color:#92400e; }
    .btn-primary { background: var(--primary); color: white; padding: 8px 16px; border-radius: 8px; border:none; cursor:pointer; font-weight:500; transition: opacity 0.2s; }
    .btn-primary:hover { opacity:0.9; }
    .btn-secondary { background: var(--secondary); color: white; padding: 8px 16px; border-radius: 8px; border:none; cursor:pointer; font-weight:500; }
    .btn-danger { background: var(--danger); color: white; padding: 8px 16px; border-radius: 8px; border:none; cursor:pointer; font-weight:500; }
    .btn-success { background: var(--accent); color: white; padding: 8px 16px; border-radius: 8px; border:none; cursor:pointer; font-weight:500; }
    .btn-sm { padding: 4px 10px; font-size: 12px; border-radius:6px; }
    .form-input { width:100%; border:1px solid #e2e8f0; border-radius:8px; padding:8px 12px; font-size:14px; outline:none; transition: border 0.2s; }
    .form-input:focus { border-color: var(--primary); }
    .form-label { font-size:13px; font-weight:600; color:#374151; margin-bottom:4px; display:block; }
    .stat-card { border-radius:12px; padding:20px; color:white; }
    .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:1000; display:flex; align-items:center; justify-content:center; }
    .modal { background:white; border-radius:16px; padding:24px; width:90%; max-width:600px; max-height:90vh; overflow-y:auto; }
    .toast { position:fixed; top:20px; right:20px; z-index:9999; padding:12px 20px; border-radius:10px; color:white; font-weight:500; animation: slideIn 0.3s ease; }
    .toast-success { background:#10b981; }
    .toast-error { background:#ef4444; }
    .toast-info { background:#3b82f6; }
    @keyframes slideIn { from { transform:translateX(100%); opacity:0; } to { transform:translateX(0); opacity:1; } }
    .table-row:hover { background:#f8fafc; }
    .nav-icon { width:20px; text-align:center; margin-right:10px; }
    .kyc-chip { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; }
    .kyc-done { background:#d1fae5; color:#065f46; }
    .kyc-pending { background:#fee2e2; color:#991b1b; }
    .loading { display:flex; align-items:center; justify-content:center; padding:40px; }
    .spinner { width:32px; height:32px; border:3px solid #e2e8f0; border-top-color: var(--primary); border-radius:50%; animation:spin 0.8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .timeline { border-left:2px solid #e2e8f0; padding-left:16px; }
    .timeline-item { position:relative; margin-bottom:16px; }
    .timeline-item::before { content:''; position:absolute; left:-21px; top:4px; width:10px; height:10px; border-radius:50%; background:var(--primary); border:2px solid white; }
    .complaint-card { border-left:4px solid transparent; }
    .complaint-open { border-left-color:#f59e0b; }
    .complaint-assigned { border-left-color:#3b82f6; }
    .complaint-scheduled { border-left-color:#8b5cf6; }
    .complaint-resolved { border-left-color:#10b981; }
    input[type=file] { font-size:13px; }
    .photo-preview { width:80px; height:80px; object-fit:cover; border-radius:8px; border:1px solid #e2e8f0; cursor:pointer; }
    .kyc-version-badge { display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;font-size:10px;font-weight:700; }
    .kyc-doc-card { border-radius:12px; border:1px solid #e2e8f0; overflow:hidden; transition: box-shadow 0.2s; }
    .kyc-doc-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
    .kyc-history-item { border-top:1px solid #e2e8f0; padding:12px 16px; display:flex; gap:12px; }
    .kyc-history-item:hover { background:#f8fafc; }
    .sidebar-logo { padding:20px 16px 10px; border-bottom:1px solid rgba(255,255,255,0.1); margin-bottom:8px; }
    .notification-dot { width:8px; height:8px; background:#ef4444; border-radius:50%; position:absolute; top:4px; right:4px; }
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
