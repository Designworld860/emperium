// ============================================================
// Emperium City – Grievance Redressal System
// Main Application JS
// ============================================================

const API = '/api'
let currentUser = null
let currentPage = 'dashboard'
let searchTimeout = null

// ── Utils ──────────────────────────────────────────────────
function getToken() { return localStorage.getItem('ec_token') }
function setToken(t) { localStorage.setItem('ec_token', t) }
function clearToken() { localStorage.removeItem('ec_token'); localStorage.removeItem('ec_user') }
function saveUser(u) { localStorage.setItem('ec_user', JSON.stringify(u)) }
function getStoredUser() { try { return JSON.parse(localStorage.getItem('ec_user') || 'null') } catch { return null } }

function authHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
}

let _loggingOut = false
async function api(method, path, data) {
  try {
    const opts = { method, headers: authHeaders() }
    if (data) opts.body = JSON.stringify(data)
    const r = await fetch(API + path, opts)
    let json = {}
    try { json = await r.json() } catch {}
    if (r.status === 401 && !path.includes('/auth/') && !_loggingOut) {
      _loggingOut = true
      logout()
      setTimeout(() => { _loggingOut = false }, 2000)
      return null
    }
    return { ok: r.ok, status: r.status, data: json }
  } catch (e) {
    toast('Network error: ' + e.message, 'error')
    return null
  }
}

function toast(msg, type = 'info') {
  const el = document.createElement('div')
  el.className = `toast toast-${type}`
  el.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':type==='error'?'times-circle':'info-circle'} mr-2"></i>${msg}`
  document.getElementById('toast-container').appendChild(el)
  setTimeout(() => el.remove(), 3500)
}

function formatDate(d) {
  if (!d) return '—'
  return dayjs(d).format('DD MMM YYYY')
}

function formatDateTime(d) {
  if (!d) return '—'
  return dayjs(d).format('DD MMM YYYY, h:mm A')
}

function statusBadge(status) {
  const s = (status || '').toLowerCase().replace(' ', '_')
  return `<span class="badge-${s} px-2 py-1 rounded-full text-xs font-semibold">${status}</span>`
}

function roleBadge(role) {
  const labels = { admin: 'Admin', sub_admin: 'Sub Admin', employee: 'Employee' }
  return `<span class="badge-${role} px-2 py-1 rounded-full text-xs font-semibold">${labels[role] || role}</span>`
}

const UNIT_STATUSES = ['Vacant','Occupied by Owner','Occupied by Tenant','Under Construction']
const UNIT_STATUS_STYLE = {
  'Vacant':              { bg:'#F0FDF4', color:'#15803D', border:'#86EFAC', icon:'fa-door-open' },
  'Occupied by Owner':   { bg:'#EFF6FF', color:'#1D4ED8', border:'#93C5FD', icon:'fa-home' },
  'Occupied by Tenant':  { bg:'#FFF7ED', color:'#C2410C', border:'#FDC99B', icon:'fa-user-friends' },
  'Under Construction':  { bg:'#FEFCE8', color:'#A16207', border:'#FDE047', icon:'fa-hard-hat' },
}
function unitStatusBadge(status) {
  const s = status || 'Vacant'
  const style = UNIT_STATUS_STYLE[s] || UNIT_STATUS_STYLE['Vacant']
  return `<span style="background:${style.bg};color:${style.color};border:1px solid ${style.border};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:5px;">
    <i class="fas ${style.icon}" style="font-size:10px;"></i>${s}
  </span>`
}
function particularsBadge(p) {
  // Try to map old particulars to new status style
  const s = p?.toLowerCase()
  let mapped = p || 'Vacant'
  if (s?.includes('owner'))        mapped = 'Occupied by Owner'
  else if (s?.includes('tenant'))  mapped = 'Occupied by Tenant'
  else if (s?.includes('occupied'))mapped = 'Occupied by Owner'
  else if (s?.includes('construction')) mapped = 'Under Construction'
  else if (s?.includes('vacant'))  mapped = 'Vacant'
  return unitStatusBadge(mapped)
}

function kycChip(done) {
  return done
    ? `<span class="kyc-chip kyc-done"><i class="fas fa-check"></i> Done</span>`
    : `<span class="kyc-chip kyc-pending"><i class="fas fa-times"></i> Pending</span>`
}

function priorityColor(p) {
  const m = { Low: 'text-gray-500', Normal: 'text-blue-600', High: 'text-orange-500', Urgent: 'text-red-600' }
  return m[p] || 'text-gray-500'
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

// ── Auth / Bootstrap ────────────────────────────────────────
async function boot() {
  currentUser = getStoredUser()
  const token = getToken()
  if (currentUser && token) {
    // Verify token is still valid (bypass the 401 auto-logout in api())
    try {
      const r = await fetch(API + '/auth/me', { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } })
      if (r.ok) {
        const json = await r.json()
        currentUser = json.user || currentUser
        saveUser(currentUser)
        showApp()
      } else {
        clearToken()
        showLogin()
      }
    } catch {
      // Offline or server error — still show app with cached user
      if (currentUser) showApp()
      else showLogin()
    }
  } else {
    showLogin()
  }
}

function showLogin() {
  document.getElementById('app').innerHTML = renderLoginPage()
}

function renderLoginPage() {
  return `
  <style>
    /* ══════════════════════════════════════════════════════════
       LOGIN PAGE — EMPERIUM CITY GRS v3
       Rich maroon-flame palette · Micro-animations · Modern UI
    ══════════════════════════════════════════════════════════ */
    @keyframes lp-fade-up    { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
    @keyframes lp-fade-right { from{opacity:0;transform:translateX(-24px)} to{opacity:1;transform:translateX(0)} }
    @keyframes lp-float      { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
    @keyframes lp-breathe    { 0%,100%{transform:scale(1)} 50%{transform:scale(1.07)} }
    @keyframes lp-ripple     { 0%{transform:scale(0.8);opacity:.7} 100%{transform:scale(1.7);opacity:0} }
    @keyframes lp-spin       { to{transform:rotate(360deg)} }
    @keyframes lp-spin-rev   { to{transform:rotate(-360deg)} }
    @keyframes lp-orbit      { from{transform:rotate(var(--start,0deg)) translateX(var(--r,120px)) rotate(calc(-1*var(--start,0deg)))}
                                to  {transform:rotate(calc(var(--start,0deg)+360deg)) translateX(var(--r,120px)) rotate(calc(-1*(var(--start,0deg)+360deg)))} }
    @keyframes lp-shimmer    { 0%{background-position:200% center} 100%{background-position:-200% center} }
    @keyframes lp-pulse-ring { 0%{box-shadow:0 0 0 0 rgba(232,67,26,0.4)} 70%{box-shadow:0 0 0 14px rgba(232,67,26,0)} 100%{box-shadow:0 0 0 0 rgba(232,67,26,0)} }
    @keyframes lp-bg-shift   { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
    @keyframes lp-dash-spin  { to{stroke-dashoffset:-100} }

    /* Root */
    .lp-root {
      min-height: 100vh;
      display: flex;
      font-family: 'Inter', system-ui, sans-serif;
      background: #0D0305;
    }

    /* ── LEFT BRAND PANEL ────────────────────────────────── */
    .lp-brand {
      display: none;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      flex: 1;
      position: relative;
      overflow: hidden;
      background: linear-gradient(145deg, #1A0508 0%, #2D0A10 30%, #3D1015 60%, #1A0508 100%);
      background-size: 400% 400%;
      animation: lp-bg-shift 12s ease infinite;
    }
    @media(min-width:1024px) { .lp-brand { display: flex; } }

    /* Noise texture overlay */
    .lp-brand::before {
      content:'';
      position:absolute; inset:0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.04'/%3E%3C/svg%3E");
      pointer-events: none;
      opacity: .6;
    }

    /* Glow blobs */
    .lp-blob {
      position: absolute;
      border-radius: 50%;
      filter: blur(60px);
      pointer-events: none;
      opacity: .18;
    }

    /* Stage */
    .lp-stage {
      position: relative;
      width: 320px; height: 320px;
      display: flex; align-items: center; justify-content: center;
      z-index: 2;
    }

    /* Orbit rings */
    .lp-ring {
      position: absolute;
      border-radius: 50%;
      border: 1px solid rgba(232,67,26,.2);
    }
    .lp-ring.dashed { border-style: dashed; border-color: rgba(201,133,58,.18); }

    /* Ripple pulses */
    .lp-pulse {
      position: absolute; border-radius: 50%;
      border: 1.5px solid rgba(232,67,26,.25);
      animation: lp-ripple 3.5s ease-out infinite;
    }

    /* Orbiting dot wrapper */
    .lp-orb-wrap {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .lp-orb {
      position: absolute;
      top: 50%; left: 50%;
      border-radius: 50%;
      animation: lp-orbit linear infinite;
      transform-origin: 0 0;
    }

    /* Logo card */
    .lp-logo-card {
      position: relative; z-index: 5;
      background: rgba(255,255,255,0.97);
      border-radius: 26px;
      padding: 24px 28px;
      box-shadow:
        0 0 0 1px rgba(232,67,26,0.12),
        0 8px 40px rgba(0,0,0,0.5),
        0 2px 8px rgba(0,0,0,0.2),
        inset 0 1px 0 rgba(255,255,255,0.9);
      animation: lp-float 5s ease-in-out infinite;
      display: flex; flex-direction: column; align-items: center; gap: 8px;
    }
    .lp-logo-img {
      width: 160px;
      animation: lp-breathe 4s ease-in-out infinite;
      display: block;
    }
    .lp-logo-badge {
      font-size: 9px; font-weight: 800; letter-spacing: .18em;
      text-transform: uppercase; color: #E8431A;
      background: rgba(232,67,26,.08); border-radius: 20px; padding: 3px 14px;
      border: 1px solid rgba(232,67,26,.15);
    }

    /* Brand text below stage */
    .lp-brand-text {
      position: relative; z-index: 2;
      text-align: center;
      margin-top: 32px;
    }
    .lp-brand-title {
      font-size: 26px; font-weight: 800; color: #fff;
      letter-spacing: -.02em; line-height: 1.2;
      background: linear-gradient(90deg, #fff 0%, rgba(255,255,255,.7) 50%, #fff 100%);
      background-size: 200% auto;
      -webkit-background-clip: text; background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: lp-shimmer 4s linear infinite;
    }
    .lp-brand-sub {
      font-size: 12px; color: rgba(255,255,255,.38); margin-top: 8px; letter-spacing: .04em;
    }

    /* Feature pills row */
    .lp-pills {
      position: relative; z-index: 2;
      display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;
      margin-top: 24px; padding: 0 20px;
    }
    .lp-pill {
      background: rgba(255,255,255,.07);
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 20px;
      padding: 5px 12px;
      font-size: 10.5px; font-weight: 600; color: rgba(255,255,255,.6);
      display: flex; align-items: center; gap: 6px;
      backdrop-filter: blur(6px);
      transition: all .2s;
    }
    .lp-pill:hover { background: rgba(232,67,26,.18); border-color: rgba(232,67,26,.3); color: rgba(255,255,255,.9); }
    .lp-pill i { color: #E8431A; font-size: 9px; }

    /* ── RIGHT FORM PANEL ────────────────────────────────── */
    .lp-form {
      width: min(100%, 480px);
      min-height: 100vh;
      background: #fff;
      display: flex; flex-direction: column;
      justify-content: center; align-items: center;
      padding: 40px 48px;
      position: relative; z-index: 2;
      box-shadow: -8px 0 60px rgba(0,0,0,0.14);
      animation: lp-fade-up .5s ease both;
    }
    @media(max-width:640px) { .lp-form { padding: 32px 24px; } }

    .lp-form-inner {
      width: 100%; max-width: 360px;
      display: flex; flex-direction: column; gap: 0;
    }

    /* Brand mark */
    .lp-brandmark {
      display: flex; align-items: center; gap: 11px;
      margin-bottom: 40px;
      animation: lp-fade-right .5s ease both;
    }
    .lp-brandmark-icon {
      width: 44px; height: 44px; border-radius: 13px; flex-shrink: 0;
      background: linear-gradient(135deg, #E8431A, #5C1010);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 6px 20px rgba(232,67,26,.35), 0 0 0 1px rgba(232,67,26,.2);
      animation: lp-pulse-ring 3s ease infinite;
    }
    .lp-brandmark-name { font-size: 16px; font-weight: 800; color: #111827; line-height: 1.15; letter-spacing: -.02em; }
    .lp-brandmark-sub  { font-size: 10px; color: #9CA3AF; font-weight: 600; text-transform: uppercase; letter-spacing: .1em; margin-top: 1px; }

    /* Heading */
    .lp-heading {
      margin-bottom: 28px;
      animation: lp-fade-up .55s .08s ease both;
    }
    .lp-heading h2 {
      font-size: 26px; font-weight: 800; color: #111827;
      letter-spacing: -.03em; line-height: 1.2; margin-bottom: 6px;
    }
    .lp-heading p { color: #9CA3AF; font-size: 13.5px; }

    /* Role tabs */
    .lp-tabs {
      display: flex;
      background: #F5EDEB;
      border-radius: 14px; padding: 4px;
      margin-bottom: 22px; gap: 4px;
      animation: lp-fade-up .55s .12s ease both;
    }
    .lp-tab {
      flex: 1; padding: 10px 14px; border-radius: 11px; border: none;
      font-size: 13px; font-weight: 600; cursor: pointer;
      transition: all .25s; display: flex; align-items: center; justify-content: center; gap: 7px;
      font-family: inherit;
    }
    .lp-tab.on {
      background: linear-gradient(135deg, #E8431A, #8B1A1A);
      color: #fff;
      box-shadow: 0 4px 16px rgba(232,67,26,.38), 0 1px 0 rgba(255,255,255,.1) inset;
    }
    .lp-tab.off { background: transparent; color: #9CA3AF; }
    .lp-tab.off:hover { background: rgba(232,67,26,.08); color: #E8431A; }

    /* Inputs */
    .lp-field {
      display: flex; flex-direction: column; gap: 5px;
      animation: lp-fade-up .55s ease both;
    }
    .lp-field-label {
      font-size: 11px; font-weight: 700; color: #374151;
      text-transform: uppercase; letter-spacing: .06em;
    }
    .lp-field-wrap { position: relative; }
    .lp-input {
      width: 100%; padding: 12px 14px 12px 42px;
      border: 1.5px solid #E5E7EB; border-radius: 12px;
      font-size: 13.5px; color: #111827; outline: none;
      transition: border-color .2s, box-shadow .2s, background .2s;
      font-family: inherit; background: #F9FAFB;
    }
    .lp-input:focus {
      border-color: #E8431A;
      box-shadow: 0 0 0 4px rgba(232,67,26,.1);
      background: #fff;
    }
    .lp-input::placeholder { color: #C4B5B0; }
    .lp-ficon {
      position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
      color: #C4B5B0; font-size: 13px; pointer-events: none;
      transition: color .2s;
    }
    .lp-field-wrap:focus-within .lp-ficon { color: #E8431A; }

    /* Submit button */
    .lp-btn {
      width: 100%; padding: 13px;
      border: none; border-radius: 13px;
      background: linear-gradient(135deg, #E8431A 0%, #C0341A 45%, #8B1A1A 100%);
      color: #fff; font-size: 14px; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 9px;
      transition: all .25s;
      box-shadow: 0 4px 24px rgba(232,67,26,.42), 0 1px 0 rgba(255,255,255,.15) inset;
      letter-spacing: .02em;
      font-family: inherit;
      position: relative; overflow: hidden;
    }
    .lp-btn::after {
      content: '';
      position: absolute; inset: 0;
      background: linear-gradient(135deg, rgba(255,255,255,.15), transparent);
      opacity: 0; transition: opacity .2s;
    }
    .lp-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 36px rgba(232,67,26,.52); }
    .lp-btn:hover::after { opacity: 1; }
    .lp-btn:active { transform: translateY(0); box-shadow: 0 2px 12px rgba(232,67,26,.38); }

    /* Divider */
    .lp-divider {
      display: flex; align-items: center; gap: 12px; color: #D1D5DB;
      font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase;
    }
    .lp-divider::before,.lp-divider::after {
      content: ''; flex: 1; height: 1px; background: #F3F4F6;
    }

    /* Demo rows */
    .lp-demo-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
      animation: lp-fade-up .55s .2s ease both;
    }
    .lp-demo-row {
      display: flex; align-items: center; gap: 8px; padding: 8px 10px;
      border-radius: 11px; cursor: pointer;
      transition: all .18s;
      border: 1.5px solid #F3F4F6;
      background: #FAFAFA;
    }
    .lp-demo-row:hover {
      background: #FFF5F3; border-color: rgba(232,67,26,.25);
      transform: translateY(-1px);
      box-shadow: 0 3px 10px rgba(232,67,26,.1);
    }
    .lp-demo-avatar {
      width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .lp-demo-name { font-size: 11.5px; font-weight: 700; color: #374151; line-height: 1.2; }
    .lp-demo-hint { font-size: 10px; color: #9CA3AF; }

    /* Footer */
    .lp-footer {
      text-align: center; font-size: 10.5px; color: #D1D5DB; margin-top: 24px;
      animation: lp-fade-up .55s .25s ease both;
    }
  </style>

  <div class="lp-root" id="loginPage">

    <!-- ══ LEFT: BRAND ════════════════════════════════════════ -->
    <div class="lp-brand">
      <!-- Blob glows -->
      <div class="lp-blob" style="width:420px;height:420px;background:radial-gradient(#E8431A,transparent);top:-60px;left:-80px;"></div>
      <div class="lp-blob" style="width:300px;height:300px;background:radial-gradient(#C9853A,transparent);bottom:60px;right:-40px;opacity:.12;"></div>
      <div class="lp-blob" style="width:200px;height:200px;background:radial-gradient(#8B1A1A,transparent);top:50%;left:60%;opacity:.2;"></div>

      <!-- Stage -->
      <div class="lp-stage">
        <!-- Pulse rings -->
        <div class="lp-pulse" style="width:220px;height:220px;animation-delay:0s;"></div>
        <div class="lp-pulse" style="width:220px;height:220px;animation-delay:1.2s;"></div>
        <div class="lp-pulse" style="width:220px;height:220px;animation-delay:2.4s;"></div>

        <!-- Static rings -->
        <div class="lp-ring" style="width:240px;height:240px;animation:lp-spin 22s linear infinite;"></div>
        <div class="lp-ring dashed" style="width:300px;height:300px;animation:lp-spin-rev 30s linear infinite;"></div>

        <!-- Orbiting dots -->
        <div class="lp-orb-wrap">
          <div class="lp-orb" style="width:10px;height:10px;background:#E8431A;border-radius:50%;--start:0deg;--r:120px;animation-duration:10s;margin:-5px 0 0 -5px;box-shadow:0 0 8px #E8431A;"></div>
        </div>
        <div class="lp-orb-wrap">
          <div class="lp-orb" style="width:7px;height:7px;background:#C9853A;border-radius:50%;--start:180deg;--r:150px;animation-duration:17s;margin:-3.5px 0 0 -3.5px;box-shadow:0 0 6px #C9853A;"></div>
        </div>
        <div class="lp-orb-wrap">
          <div class="lp-orb" style="width:5px;height:5px;background:#fff;border-radius:50%;--start:90deg;--r:150px;animation-duration:22s;margin:-2.5px 0 0 -2.5px;opacity:.4;"></div>
        </div>

        <!-- Logo Card -->
        <div class="lp-logo-card">
          <img src="/static/emperium-logo.png" alt="Emperium City" class="lp-logo-img"/>
          <div class="lp-logo-badge">Grievance Redressal System</div>
        </div>
      </div>

      <!-- Brand text -->
      <div class="lp-brand-text">
        <div class="lp-brand-title">Emperium City</div>
        <div class="lp-brand-sub">Smarter living · Faster resolutions</div>
      </div>

      <!-- Feature pills -->
      <div class="lp-pills">
        <div class="lp-pill"><i class="fas fa-bolt"></i>Real-time Tracking</div>
        <div class="lp-pill"><i class="fas fa-calendar-check"></i>Visit Scheduling</div>
        <div class="lp-pill"><i class="fas fa-car"></i>Vehicle Registry</div>
        <div class="lp-pill"><i class="fas fa-shield-alt"></i>Secure & Private</div>
      </div>
    </div>

    <!-- ══ RIGHT: FORM ════════════════════════════════════════ -->
    <div class="lp-form">
      <div class="lp-form-inner">

        <!-- Brand mark -->
        <div class="lp-brandmark">
          <div class="lp-brandmark-icon">
            <i class="fas fa-shield-alt" style="color:#fff;font-size:18px;"></i>
          </div>
          <div>
            <div class="lp-brandmark-name">Emperium City</div>
            <div class="lp-brandmark-sub">GRS Portal</div>
          </div>
        </div>

        <!-- Heading -->
        <div class="lp-heading">
          <h2>Welcome back 👋</h2>
          <p>Sign in to access the Grievance Redressal System</p>
        </div>

        <!-- Role Tabs -->
        <div class="lp-tabs">
          <button id="tabCust" onclick="switchLoginTab('customer')" class="lp-tab on">
            <i class="fas fa-home" style="font-size:12px;"></i>Resident
          </button>
          <button id="tabEmp" onclick="switchLoginTab('employee')" class="lp-tab off">
            <i class="fas fa-user-tie" style="font-size:12px;"></i>Staff / Admin
          </button>
        </div>
        <div id="loginType" style="display:none;">customer</div>

        <!-- Form -->
        <form onsubmit="doLogin(event)" style="display:flex;flex-direction:column;gap:14px;margin-bottom:22px;">
          <div class="lp-field" style="animation-delay:.14s;">
            <label class="lp-field-label">Email Address</label>
            <div class="lp-field-wrap">
              <i class="fas fa-envelope lp-ficon"></i>
              <input id="loginEmail" type="email" autocomplete="email" class="lp-input" placeholder="you@example.com" required/>
            </div>
          </div>

          <div class="lp-field" style="animation-delay:.18s;">
            <label class="lp-field-label">Password</label>
            <div class="lp-field-wrap">
              <i class="fas fa-lock lp-ficon"></i>
              <input id="loginPwd" type="password" autocomplete="current-password" class="lp-input" style="padding-right:46px;" placeholder="Enter your password" required/>
              <button type="button" onclick="togglePwd()" style="position:absolute;right:13px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#C4B5B0;font-size:13px;padding:0;transition:color .2s;"
                onmouseover="this.style.color='#E8431A'" onmouseout="this.style.color='#C4B5B0'">
                <i class="fas fa-eye" id="pwdIcon"></i>
              </button>
            </div>
          </div>

          <button type="submit" class="lp-btn" style="margin-top:6px;animation:lp-fade-up .55s .22s ease both;">
            <i class="fas fa-arrow-right-to-bracket" style="font-size:14px;"></i>
            Sign In Securely
          </button>
        </form>

        <!-- Demo credentials -->
        <div style="animation:lp-fade-up .55s .18s ease both;">
          <div class="lp-divider" style="margin-bottom:14px;">Quick Demo Access</div>
          <div class="lp-demo-grid">
            ${[
              ['Admin',     'admin@emperiumcity.com',      'Admin@123',    'fa-crown',       '#DC2626','#FEF2F2'],
              ['Sub-Admin', 'subadmin@emperiumcity.com',   'SubAdmin@123', 'fa-user-shield', '#7C3AED','#F5F3FF'],
              ['Employee',  'rajesh@emperiumcity.com',     'Emp@123',      'fa-hard-hat',    '#0284C7','#EFF6FF'],
              ['Resident',  'kapoorminakshi124@gmail.com', 'Customer@123', 'fa-home',        '#059669','#F0FDF4']
            ].map(([role,email,pwd,ic,color,bg])=>`
            <div class="lp-demo-row" onclick="document.getElementById('loginEmail').value='${email}';document.getElementById('loginPwd').value='${pwd}';" title="${email}">
              <div class="lp-demo-avatar" style="background:${bg};">
                <i class="fas ${ic}" style="color:${color};font-size:11px;"></i>
              </div>
              <div style="flex:1;min-width:0;">
                <div class="lp-demo-name">${role}</div>
                <div class="lp-demo-hint" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${email.split('@')[0]}@…</div>
              </div>
              <i class="fas fa-chevron-right" style="color:#E8431A;font-size:8px;opacity:.4;flex-shrink:0;"></i>
            </div>`).join('')}
          </div>
        </div>

        <!-- Footer -->
        <p class="lp-footer">&copy; 2026 Emperium City &nbsp;&bull;&nbsp; Grievance Redressal System &nbsp;&bull;&nbsp; v3.0</p>
      </div>
    </div>

  </div>`
}

function switchLoginTab(type) {
  document.getElementById('loginType').textContent = type
  const isCust = type === 'customer'
  const tabCust = document.getElementById('tabCust')
  const tabEmp  = document.getElementById('tabEmp')
  if (tabCust) { tabCust.className = 'lp-tab ' + (isCust  ? 'on' : 'off') }
  if (tabEmp)  { tabEmp.className  = 'lp-tab ' + (!isCust ? 'on' : 'off') }
}

function togglePwd() {
  const i = document.getElementById('loginPwd')
  const icon = document.getElementById('pwdIcon')
  if (i.type === 'password') { i.type = 'text'; icon.className = 'fas fa-eye-slash' }
  else { i.type = 'password'; icon.className = 'fas fa-eye' }
}

async function doLogin(e) {
  e.preventDefault()
  const type = document.getElementById('loginType').textContent.trim()
  const email = document.getElementById('loginEmail').value
  const password = document.getElementById('loginPwd').value
  const endpoint = type === 'customer' ? '/auth/customer/login' : '/auth/employee/login'
  const r = await api('POST', endpoint, { email, password })
  if (r?.ok) {
    setToken(r.data.token)
    currentUser = r.data.user
    saveUser(currentUser)
    toast('Welcome, ' + currentUser.name + '!', 'success')
    showApp()
  } else {
    toast(r?.data?.error || 'Login failed', 'error')
  }
}

function logout() {
  clearToken()
  currentUser = null
  showLogin()
}

// ── Main App Shell ───────────────────────────────────────────
function showApp() {
  const isEmp = currentUser.type === 'employee'
  const isAdmin = currentUser.role === 'admin'
  const isSubAdmin = currentUser.role === 'sub_admin'
  const isCust = currentUser.type === 'customer'
  const isStaff = isAdmin || isSubAdmin || isEmp

  const roleLabel = isAdmin ? 'Administrator' : isSubAdmin ? 'Sub Administrator' : isEmp ? 'Employee' : `Unit ${currentUser.unit_no}`
  const userInitial = (currentUser.name || 'U').charAt(0).toUpperCase()

  document.getElementById('app').innerHTML = `
  <!-- Sidebar backdrop for mobile -->
  <div class="sidebar-backdrop" id="sidebarBackdrop" onclick="closeSidebar()"></div>

  <div class="app-shell">
    <!-- ═══ SIDEBAR ══════════════════════════════════════════ -->
    <aside class="sidebar" id="sidebar">
      <!-- Logo -->
      <div class="sidebar-logo">
        <img src="/static/emperium-logo.png" alt="Emperium City" style="width:140px;margin:0 auto 10px;display:block;filter:brightness(1.05)"/>
        <div class="grs-label">Grievance Redressal System</div>
      </div>

      <!-- Navigation -->
      <nav class="sidebar-nav" id="mainNav">

        <!-- MAIN SECTION -->
        <div class="nav-section-label">Main</div>
        ${navItem('dashboard', 'Dashboard', 'fa-tachometer-alt')}
        ${navItem('complaints', 'Complaints', 'fa-exclamation-circle')}

        ${isStaff ? `<div class="nav-section-label" style="margin-top:4px;">Management</div>` : ''}
        ${isStaff ? navItem('units', 'Unit Registry', 'fa-building') : ''}
        ${isStaff ? navItem('customers', 'Customer Master', 'fa-users') : ''}
        ${isStaff ? navItem('kyc-tracker', 'KYC Tracker', 'fa-id-card') : ''}
        ${(isAdmin || isSubAdmin) ? navItem('employees', 'Employees', 'fa-user-tie') : ''}
        ${isStaff ? navItem('vehicles', 'Vehicle Registry', 'fa-car') : ''}

        ${isStaff ? `<div class="nav-section-label" style="margin-top:4px;">Scheduling</div>` : ''}
        ${isStaff ? navItem('calendar', 'My Calendar', 'fa-calendar-alt') : ''}
        ${isStaff ? navItem('leave-mgmt', 'Leave Management', 'fa-umbrella-beach') : ''}

        ${isStaff ? `<div class="nav-section-label" style="margin-top:4px;">Internal</div>` : ''}
        ${isStaff ? navItem('internal-complaints', 'Internal Complaints', 'fa-comment-dots') : ''}

        <div class="nav-section-label" style="margin-top:4px;">System</div>
        ${navItem('complaints-master', 'Complaints Master', 'fa-layer-group')}
        ${navItem('notifications', 'Notifications', 'fa-bell')}
        ${(isAdmin || isSubAdmin) ? navItem('audit', 'Audit Trail', 'fa-history') : ''}
      </nav>

      <!-- User panel -->
      <div class="sidebar-user">
        <div class="user-card">
          <div class="user-avatar">${userInitial}</div>
          <div style="flex:1;min-width:0;">
            <div class="user-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${currentUser.name}</div>
            <div class="user-role">${roleLabel}</div>
          </div>
          <button onclick="logout()" class="logout-btn" title="Sign Out">
            <i class="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </div>
    </aside>

    <!-- ═══ MAIN AREA ═════════════════════════════════════════ -->
    <div class="main-area">
      <!-- Top bar -->
      <header class="topbar">
        <!-- Hamburger (mobile) -->
        <button class="hamburger-btn" onclick="toggleSidebar()" aria-label="Open menu">
          <i class="fas fa-bars"></i>
        </button>

        <div class="topbar-search">
          <i class="fas fa-search search-icon"></i>
          <input type="text" id="globalSearch"
            placeholder="Search units, complaints..."
            oninput="onSearch(this.value)"/>
          <div id="searchDropdown" class="hidden"></div>
        </div>
        <div class="topbar-right">
          <div class="topbar-date">
            <i class="fas fa-calendar mr-1.5" style="color:#E8431A"></i>${dayjs().format('ddd, D MMM YYYY')}
          </div>
          <button onclick="navigate('notifications'); closeSidebar();" class="notif-btn" title="Notifications">
            <i class="fas fa-bell"></i>
            <span id="notifBadge" class="notif-dot hidden"></span>
          </button>
        </div>
      </header>

      <!-- Page content -->
      <div class="page-wrap" id="pageContent">
        <div class="loading"><div class="spinner"></div><span class="loading-text">Loading…</span></div>
      </div>
    </div>
  </div>

  <!-- ═══ MOBILE BOTTOM NAV ════════════════════════════════════ -->
  <nav class="mobile-bottom-nav" id="mobileBottomNav">
    <div class="mbn-inner">
      <button class="mbn-item" id="mbn-dashboard" onclick="mbnNav('dashboard')">
        <i class="fas fa-tachometer-alt mbn-icon"></i>
        <span class="mbn-label">Home</span>
      </button>
      <button class="mbn-item" id="mbn-complaints" onclick="mbnNav('complaints')">
        <i class="fas fa-exclamation-circle mbn-icon"></i>
        <span class="mbn-label">Complaints</span>
      </button>
      ${isStaff ? `
      <button class="mbn-item" id="mbn-units" onclick="mbnNav('units')">
        <i class="fas fa-building mbn-icon"></i>
        <span class="mbn-label">Units</span>
      </button>` : `
      <button class="mbn-item" id="mbn-notifications" onclick="mbnNav('notifications')">
        <i class="fas fa-bell mbn-icon"></i>
        <span class="mbn-label">Alerts</span>
      </button>`}
      <button class="mbn-item mbn-more" id="mbn-more" onclick="toggleSidebar()">
        <i class="fas fa-th-large mbn-icon"></i>
        <span class="mbn-label">More</span>
      </button>
    </div>
  </nav>`

  navigate('dashboard')
  loadNotifCount()
}

function navItem(page, label, icon) {
  return `<a href="#" onclick="navigate('${page}'); closeSidebar(); return false;" id="nav-${page}" class="nav-item">
    <i class="fas ${icon} nav-icon"></i><span>${label}</span>
  </a>`
}

function setActiveNav(page) {
  document.querySelectorAll('#mainNav .nav-item').forEach(a => a.classList.remove('active'))
  const el = document.getElementById('nav-' + page)
  if (el) el.classList.add('active')
  // Sync mobile bottom nav
  document.querySelectorAll('.mbn-item').forEach(b => b.classList.remove('active'))
  const mbnEl = document.getElementById('mbn-' + page)
  if (mbnEl) mbnEl.classList.add('active')
}

// ── Mobile Sidebar Controls ──────────────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar')
  const backdrop = document.getElementById('sidebarBackdrop')
  if (!sidebar) return
  const isOpen = sidebar.classList.contains('open')
  if (isOpen) {
    sidebar.classList.remove('open')
    backdrop?.classList.remove('active')
    document.body.style.overflow = ''
  } else {
    sidebar.classList.add('open')
    backdrop?.classList.add('active')
    document.body.style.overflow = 'hidden'
  }
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar')
  const backdrop = document.getElementById('sidebarBackdrop')
  if (sidebar) sidebar.classList.remove('open')
  if (backdrop) backdrop.classList.remove('active')
  document.body.style.overflow = ''
}

function mbnNav(page) {
  navigate(page)
  closeSidebar()
}

function navigate(page, params = {}) {
  currentPage = page
  setActiveNav(page)
  closeSidebar()
  const content = document.getElementById('pageContent')
  if (!content) return
  content.innerHTML = `<div class="loading"><div class="spinner"></div></div>`

  const pages = {
    dashboard: loadDashboard,
    complaints: loadComplaints,
    units: loadUnits,
    customers: loadCustomers,
    'kyc-tracker': loadKycTracker,
    employees: loadEmployees,
    notifications: loadNotifications,
    audit: loadAudit,
    calendar: loadCalendar,
    'leave-mgmt': loadLeaveManagement,
    vehicles: loadVehicles,
    'complaints-master': loadComplaintsMaster,
    'internal-complaints': loadInternalComplaints,
    'kyc-manage': (p) => {
      if (p && p.ownerEntityType) {
        openManageKyc(p.ownerEntityType, p.ownerEntityId, p.ownerName, p.unitNo, p.tenantEntityType, p.tenantEntityId, p.tenantName)
      } else {
        loadKycTracker()
      }
    }
  }
  if (pages[page]) pages[page](params)
  else content.innerHTML = `<div class="empty-state"><i class="fas fa-map-signs"></i><p>Page not found</p></div>`
}

// ── Search ───────────────────────────────────────────────────
function onSearch(val) {
  clearTimeout(searchTimeout)
  const dd = document.getElementById('searchDropdown')
  if (val.length < 2) { dd.classList.add('hidden'); return }
  searchTimeout = setTimeout(async () => {
    const r = await api('GET', `/search?q=${encodeURIComponent(val)}`)
    if (!r?.ok) return
    const { units = [], complaints = [] } = r.data
    if (!units.length && !complaints.length) {
      dd.innerHTML = `<div style="padding:16px;text-align:center;color:#9CA3AF;font-size:13px;"><i class="fas fa-search" style="margin-right:6px;"></i>No results found</div>`
    } else {
      dd.innerHTML = `
        ${units.length ? `<div class="dd-section"><i class="fas fa-building" style="margin-right:5px;color:#E8431A"></i>Units</div>` : ''}
        ${units.map(u => `<div class="dd-item" onclick="showUnitDetail('${u.unit_no}')">
          <div style="font-weight:600;font-size:13px;color:#111827;">Unit ${u.unit_no} – ${u.owner_name || 'Vacant'}</div>
          <div style="font-size:11.5px;color:#9CA3AF;margin-top:2px;">${u.particulars || ''} ${u.tenant_name ? '· Tenant: ' + u.tenant_name : ''}</div>
        </div>`).join('')}
        ${complaints.length ? `<div class="dd-section" style="margin-top:4px;"><i class="fas fa-exclamation-circle" style="margin-right:5px;color:#E8431A"></i>Complaints</div>` : ''}
        ${complaints.map(cp => `<div class="dd-item" onclick="showComplaintDetail(${cp.id})">
          <div style="font-weight:600;font-size:13px;color:#111827;">${cp.complaint_no} – Unit ${cp.unit_no}</div>
          <div style="font-size:11.5px;color:#9CA3AF;margin-top:2px;">${cp.category_name} · ${cp.status}</div>
        </div>`).join('')}
      `
    }
    dd.classList.remove('hidden')
  }, 300)
}

document.addEventListener('click', (e) => {
  const dd = document.getElementById('searchDropdown')
  if (dd && !dd.contains(e.target) && e.target.id !== 'globalSearch') {
    dd.classList.add('hidden')
  }
})

// ── Notifications ────────────────────────────────────────────
async function loadNotifCount() {
  const r = await api('GET', '/notifications')
  if (r?.ok) {
    const cnt = r.data.unread_count || 0
    const badge = document.getElementById('notifBadge')
    if (badge) {
      badge.textContent = cnt > 9 ? '9+' : cnt
      badge.classList.toggle('hidden', cnt === 0)
    }
  }
}

async function loadNotifications() {
  const r = await api('GET', '/notifications')
  if (!r?.ok) return
  const { notifications = [], unread_count = 0 } = r.data

  const typeIcon = { info: 'info-circle text-blue-500', success: 'check-circle text-green-500', warning: 'exclamation-circle text-yellow-500', alert: 'bell text-red-500' }

  document.getElementById('pageContent').innerHTML = `
  <div style="max-width:720px;margin:0 auto;">
    <div class="page-header">
      <div class="page-title">
        <div class="page-title-icon"><i class="fas fa-bell"></i></div>
        <div>
          <div>Notifications</div>
          <div class="page-subtitle">${unread_count} unread notification${unread_count !== 1 ? 's' : ''}</div>
        </div>
      </div>
      ${unread_count > 0 ? `<button onclick="markAllRead()" class="btn-outline btn-sm"><i class="fas fa-check-double"></i>Mark All Read</button>` : ''}
    </div>
    <div class="card" style="overflow:hidden;">
      ${notifications.length === 0 ? `<div class="empty-state"><i class="fas fa-bell-slash"></i><p>You're all caught up — no notifications</p></div>` :
        notifications.map(n => `
        <div class="notif-item ${!n.is_read ? 'unread' : ''}" style="${!n.is_read ? 'border-left-color:var(--ec-flame);' : ''}">
          <div style="width:36px;height:36px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;
            background:${n.type==='success'?'#ECFDF5':n.type==='warning'||n.type==='alert'?'#FFF7ED':'#FFF0EC'};">
            <i class="fas fa-${typeIcon[n.type]||typeIcon.info}" style="font-size:14px;"></i>
          </div>
          <div style="flex:1;">
            <div style="font-weight:600;font-size:13px;color:#111827;">${n.title}</div>
            <div style="font-size:12.5px;color:#6B7280;margin-top:3px;">${n.message}</div>
            <div style="font-size:11px;color:#9CA3AF;margin-top:5px;">${formatDateTime(n.created_at)}</div>
          </div>
          ${n.complaint_id ? `<button onclick="showComplaintDetail(${n.complaint_id})" class="btn-primary btn-xs">View</button>` : ''}
        </div>`).join('')}
    </div>
  </div>`

  await api('POST', '/notifications/read-all')
  loadNotifCount()
}

async function markAllRead() {
  await api('POST', '/notifications/read-all')
  navigate('notifications')
}

// ── Dashboard ────────────────────────────────────────────────
async function loadDashboard() {
  if (currentUser.type === 'customer') {
    loadCustomerDashboard()
  } else if (currentUser.role === 'employee') {
    loadEmployeeDashboard()
  } else {
    loadAdminDashboard()
  }
}

async function loadAdminDashboard() {
  const r = await api('GET', '/dashboard/admin')
  if (!r?.ok) return
  const d = r.data
  const us = d.unit_stats || {}
  const cs = d.complaint_stats || {}
  const cnt = d.counts || {}

  document.getElementById('pageContent').innerHTML = `
  <!-- Page Header -->
  <div class="page-header">
    <div>
      <div class="page-title">
        <div class="page-title-icon"><i class="fas fa-tachometer-alt"></i></div>
        <div>
          <div>Admin Dashboard</div>
          <div class="page-subtitle">Emperium City Grievance Redressal System</div>
        </div>
      </div>
    </div>
    <div class="page-actions">
      <button onclick="navigate('complaints')" class="btn-primary"><i class="fas fa-plus"></i>New Complaint</button>
      <button onclick="navigate('customers')" class="btn-ghost"><i class="fas fa-users"></i>Customers</button>
    </div>
  </div>

  <!-- KPI Row -->
  <div class="grid-4" style="margin-bottom:20px;">
    <div class="stat-card sc-flame">
      <i class="fas fa-building stat-icon"></i>
      <div class="stat-number">${us.total_units || 0}</div>
      <div class="stat-label">Total Units</div>
      <div class="stat-sub">${us.occupied || 0} Occupied &bull; ${us.vacant || 0} Vacant &bull; ${us.under_construction || 0} Under Const.</div>
    </div>
    <div class="stat-card sc-green">
      <i class="fas fa-users stat-icon"></i>
      <div class="stat-number">${cnt.customers || 0}</div>
      <div class="stat-label">Registered Owners</div>
      <div class="stat-sub">${cnt.tenants || 0} Active Tenants</div>
    </div>
    <div class="stat-card sc-purple">
      <i class="fas fa-exclamation-circle stat-icon"></i>
      <div class="stat-number">${cs.total || 0}</div>
      <div class="stat-label">Total Complaints</div>
      <div class="stat-sub">${cs.open_count || 0} Open Now</div>
    </div>
    <div class="stat-card sc-gold">
      <i class="fas fa-user-tie stat-icon"></i>
      <div class="stat-number">${cnt.employees || 0}</div>
      <div class="stat-label">Staff Members</div>
      <div class="stat-sub">${cnt.kyc_complete || 0} KYC Complete</div>
    </div>
  </div>

  <!-- Complaint Pipeline -->
  <div class="card" style="margin-bottom:20px;">
    <div class="card-header">
      <span class="card-title"><i class="fas fa-stream" style="color:#E8431A;margin-right:8px;"></i>Complaint Pipeline</span>
    </div>
    <div class="card-body" style="padding:16px 20px;">
      <div class="grid-5" style="gap:12px;">
        ${[['Open','open_count','#F59E0B','#FFF3E0'],['Assigned','assigned_count','#3B82F6','#EFF6FF'],['Scheduled','scheduled_count','#8B5CF6','#F5F3FF'],['Resolved','resolved_count','#10B981','#ECFDF5'],['Closed','closed_count','#6B7280','#F9FAFB']].map(([label,key,color,bg]) => `
        <div style="text-align:center;padding:14px 8px;border-radius:12px;background:${bg};border:1.5px solid ${color}22;">
          <div style="font-size:24px;font-weight:800;color:${color};">${cs[key] || 0}</div>
          <div style="font-size:11px;font-weight:600;color:${color};margin-top:4px;">${label}</div>
        </div>`).join('')}
      </div>
    </div>
  </div>

  <!-- Bottom Grid -->
  <div class="grid-2" style="gap:20px;">
    <!-- Recent Complaints -->
    <div class="card">
      <div class="card-header">
        <span class="card-title"><i class="fas fa-clock" style="color:#E8431A;margin-right:8px;"></i>Recent Complaints</span>
        <button onclick="navigate('complaints')" style="font-size:12px;color:#E8431A;background:none;border:none;cursor:pointer;font-weight:600;">View All &rarr;</button>
      </div>
      <div style="padding:0;">
        ${(d.recent_complaints || []).length === 0 ? `<div class="empty-state" style="padding:32px;"><i class="fas fa-inbox"></i><p>No complaints yet</p></div>` :
          (d.recent_complaints || []).map(c => `
        <div class="complaint-card complaint-${(c.status||'').toLowerCase()}" style="display:flex;align-items:center;gap:12px;padding:11px 18px;cursor:pointer;transition:background 0.15s;border-bottom:1px solid #F9F5F4;" onclick="showComplaintDetail(${c.id})" onmouseover="this.style.background='#FFF5F3'" onmouseout="this.style.background=''">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:13px;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.complaint_no} &ndash; Unit ${c.unit_no}</div>
            <div style="font-size:11.5px;color:#9CA3AF;margin-top:2px;">${c.category_name} &bull; ${formatDate(c.created_at)}</div>
          </div>
          ${statusBadge(c.status)}
        </div>`).join('')}
      </div>
    </div>

    <!-- Category + Workload -->
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div class="card">
        <div class="card-header">
          <span class="card-title"><i class="fas fa-chart-bar" style="color:#E8431A;margin-right:8px;"></i>Active by Category</span>
        </div>
        <div class="card-body">
          ${(d.by_category || []).length === 0 ? `<p style="color:#9CA3AF;font-size:13px;">No active complaints</p>` :
            (d.by_category || []).map(cat => `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
            <div style="width:100px;font-size:12.5px;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${cat.name}</div>
            <div class="progress-bar" style="flex:1;"><div class="progress-fill progress-brand" style="width:${Math.min(100,(cat.count/Math.max(1,cs.total||1))*100)}%"></div></div>
            <div style="font-size:12px;font-weight:700;color:#E8431A;min-width:24px;text-align:right;">${cat.count}</div>
          </div>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <span class="card-title"><i class="fas fa-hard-hat" style="color:#E8431A;margin-right:8px;"></i>Staff Workload</span>
        </div>
        <div class="card-body">
          ${(d.employee_workload || []).length === 0 ? `<p style="color:#9CA3AF;font-size:13px;">All staff available</p>` :
            (d.employee_workload || []).map(e => `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <div style="font-size:13px;color:#374151;">${e.name}</div>
            <div style="padding:3px 10px;background:#FFF0EC;color:#E8431A;border-radius:20px;font-size:11px;font-weight:700;border:1px solid #FDDDD4;">${e.count} active</div>
          </div>`).join('')}
        </div>
      </div>
    </div>
  </div>`
}

async function loadEmployeeDashboard() {
  const r = await api('GET', '/dashboard/employee')
  if (!r?.ok) return
  const d = r.data
  const stats = d.stats || {}

  document.getElementById('pageContent').innerHTML = `
  <div class="page-header">
    <div class="page-title">
      <div class="page-title-icon"><i class="fas fa-hard-hat"></i></div>
      <div>
        <div>My Dashboard</div>
        <div class="page-subtitle">Welcome back, ${d.employee?.name || currentUser.name}</div>
      </div>
    </div>
    <div class="page-actions">
      <button onclick="navigate('calendar')" class="btn-outline"><i class="fas fa-calendar-alt"></i>My Calendar</button>
      <button onclick="navigate('leave-mgmt')" class="btn-ghost"><i class="fas fa-umbrella-beach"></i>Apply Leave</button>
    </div>
  </div>

  <!-- Stats -->
  <div class="grid-4" style="margin-bottom:20px;">
    ${[['Assigned to Me','total_assigned','sc-flame','fa-tasks'],['Pending','pending','sc-gold','fa-hourglass-half'],['Scheduled','scheduled','sc-purple','fa-calendar-check'],['Resolved','resolved','sc-green','fa-check-circle']].map(([label,key,cls,ic]) => `
    <div class="stat-card ${cls}">
      <i class="fas ${ic} stat-icon"></i>
      <div class="stat-number">${stats[key] || 0}</div>
      <div class="stat-label">${label}</div>
    </div>`).join('')}
  </div>

  <!-- Today's Visits -->
  ${d.today_visits?.length ? `
  <div class="card" style="margin-bottom:20px;border-left:4px solid #8B5CF6;">
    <div class="card-header">
      <span class="card-title"><i class="fas fa-calendar-day" style="color:#8B5CF6;margin-right:8px;"></i>Today's Visits (${d.today_visits.length})</span>
      <button onclick="navigate('calendar')" style="font-size:12px;color:#8B5CF6;background:none;border:none;cursor:pointer;font-weight:600;">Full Calendar &rarr;</button>
    </div>
    <div class="card-body" style="padding:12px 20px;">
      <div style="display:grid;gap:8px;">
        ${d.today_visits.map(c => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#F5F3FF;border-radius:10px;border:1px solid #EDE9FE;">
          <div>
            <div style="font-weight:600;font-size:13px;">${c.complaint_no} &ndash; Unit ${c.unit_no}</div>
            <div style="font-size:11.5px;color:#6B7280;margin-top:2px;">${c.category_name} &bull; ${c.visit_time || 'Time TBD'}</div>
          </div>
          <button onclick="showComplaintDetail(${c.id})" class="btn-primary btn-sm">View</button>
        </div>`).join('')}
      </div>
    </div>
  </div>` : ''}

  <!-- Assigned Complaints -->
  <div class="card">
    <div class="card-header">
      <span class="card-title"><i class="fas fa-list-check" style="color:#E8431A;margin-right:8px;"></i>My Assigned Complaints</span>
    </div>
    <div style="padding:0;">
      ${(d.assigned_complaints || []).length === 0
        ? `<div class="empty-state"><i class="fas fa-check-double"></i><p>No complaints assigned — you\'re all caught up!</p></div>`
        : renderComplaintTable(d.assigned_complaints)}
    </div>
  </div>`
}

async function loadCustomerDashboard() {
  const r = await api('GET', '/dashboard/customer')
  if (!r?.ok) return
  const d = r.data
  const cust = d.customer || {}
  const stats = d.stats || {}
  const kyc = d.kyc_status || {}

  const kycComplete = Object.values(kyc).every(v => v)
  const kycDoneCount = Object.values(kyc).filter(v => v).length
  const kycTotal = Object.keys(kyc).length

  document.getElementById('pageContent').innerHTML = `
  <div class="page-header">
    <div class="page-title">
      <div class="page-title-icon"><i class="fas fa-home"></i></div>
      <div>
        <div>My Dashboard</div>
        <div class="page-subtitle">Unit ${cust.unit_no} &bull; ${cust.particulars}</div>
      </div>
    </div>
    <button onclick="showRegisterComplaint()" class="btn-primary"><i class="fas fa-plus"></i>Register Complaint</button>
  </div>

  <!-- Profile + Stats -->
  <div style="display:grid;grid-template-columns:300px 1fr;gap:20px;margin-bottom:20px;" class="form-2col">
    <!-- Profile card -->
    <div class="card">
      <div style="background:linear-gradient(135deg,#E8431A,#8B1A1A);height:60px;border-radius:14px 14px 0 0;"></div>
      <div style="padding:0 20px 20px;">
        <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#E8431A,#8B1A1A);display:flex;align-items:center;justify-content:center;color:white;font-size:20px;font-weight:800;margin-top:-26px;border:3px solid white;">${(cust.name||'U').charAt(0)}</div>
        <div style="font-size:16px;font-weight:700;color:#111827;margin-top:10px;">${cust.name}</div>
        <div style="font-size:13px;color:#E8431A;font-weight:600;">Unit ${cust.unit_no}</div>
        <hr style="margin:14px 0;border-color:#F3F4F6;">
        <div style="display:grid;gap:8px;font-size:12.5px;">
          <div style="display:flex;align-items:center;gap:8px;"><i class="fas fa-envelope" style="color:#C4B5B0;width:14px;"></i><span style="color:#4B5563;">${cust.email||'—'}</span></div>
          <div style="display:flex;align-items:center;gap:8px;"><i class="fas fa-phone" style="color:#C4B5B0;width:14px;"></i><span style="color:#4B5563;">${cust.mobile1||'—'}</span></div>
          <div style="display:flex;align-items:center;gap:8px;"><i class="fas fa-ruler" style="color:#C4B5B0;width:14px;"></i><span style="color:#4B5563;">${cust.billing_area||'—'} ${cust.area_unit||''}</span></div>
        </div>
      </div>
    </div>
    <!-- Stats -->
    <div style="display:flex;flex-direction:column;gap:14px;">
      <div class="grid-3" style="gap:12px;">
        ${[['Total Complaints','total','sc-flame','fa-exclamation-circle'],['Open','open_count','sc-gold','fa-clock'],['Resolved','resolved','sc-green','fa-check-circle']].map(([lbl,key,cls,ic])=>`
        <div class="stat-card ${cls}">
          <i class="fas ${ic} stat-icon"></i>
          <div class="stat-number">${stats[key]||0}</div>
          <div class="stat-label">${lbl}</div>
        </div>`).join('')}
      </div>
      <div class="card" style="padding:16px 18px;">
        <button onclick="showRegisterComplaint()" class="btn-primary" style="width:100%;justify-content:center;padding:12px;font-size:14px;">
          <i class="fas fa-plus"></i>Register New Complaint
        </button>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">
          <button onclick="navigate('complaints')" class="btn-ghost btn-sm" style="justify-content:center;"><i class="fas fa-list"></i>My Complaints</button>
          <button onclick="navigate('notifications')" class="btn-ghost btn-sm" style="justify-content:center;"><i class="fas fa-bell"></i>Notifications</button>
        </div>
      </div>
    </div>
  </div>

  <!-- KYC Status -->
  <div class="card p-5 mb-6">
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-bold text-gray-800"><i class="fas fa-id-card mr-2 text-blue-600"></i>My KYC Status</h3>
      <div class="${kycComplete ? 'text-green-600' : 'text-orange-500'} font-semibold text-sm">
        ${kycDoneCount}/${kycTotal} documents uploaded
      </div>
    </div>
    <div class="flex flex-wrap gap-3">
      ${[['aadhar','Aadhar'],['pan','PAN'],['photo','Photograph'],['sale_deed','Sale Deed'],['maintenance_agreement','Maintenance Agreement']].map(([key,label]) => `
      <div class="flex items-center gap-2 px-3 py-2 rounded-lg ${kyc[key] ? 'bg-green-50' : 'bg-red-50'}">
        <i class="fas ${kyc[key] ? 'fa-check-circle text-green-500' : 'fa-times-circle text-red-400'}"></i>
        <span class="text-xs font-medium ${kyc[key] ? 'text-green-700' : 'text-red-600'}">${label}</span>
      </div>`).join('')}
    </div>
    ${!kycComplete ? `<p class="text-xs text-orange-500 mt-3"><i class="fas fa-info-circle mr-1"></i>Please visit the facility office to complete your KYC documentation.</p>` : ''}
  </div>

  <!-- Recent Complaints -->
  <div class="card p-5">
    <div class="flex justify-between items-center mb-4">
      <h3 class="font-bold text-gray-800">My Complaints</h3>
      <button onclick="navigate('complaints')" class="text-blue-600 text-sm hover:underline">View All</button>
    </div>
    ${(d.complaints || []).length === 0 ? `<p class="text-gray-400 text-center py-8">No complaints yet</p>` :
      renderComplaintTable(d.complaints || [])}
  </div>`
}

// ── Complaints ────────────────────────────────────────────────
async function loadComplaints(params = {}) {
  const isCust = currentUser.type === 'customer'
  const isAdmin = ['admin', 'sub_admin'].includes(currentUser.role)

  let url = '/complaints?limit=50'
  if (params.status) url += `&status=${params.status}`

  const [compR, catR] = await Promise.all([
    api('GET', url),
    api('GET', '/complaints/categories/list')
  ])
  if (!compR?.ok) return

  const complaints = compR.data.complaints || []
  const categories = catR?.data?.categories || []

  document.getElementById('pageContent').innerHTML = `
  <div class="page-header">
    <div class="page-title">
      <div class="page-title-icon"><i class="fas fa-exclamation-circle"></i></div>
      <div>
        <div>Complaints</div>
        <div class="page-subtitle">${complaints.length} complaint(s) loaded</div>
      </div>
    </div>
    <div class="page-actions">
      <select id="filterStatus" onchange="filterComplaints()" class="filter-select">
        <option value="">All Status</option>
        <option value="Open">Open</option>
        <option value="Assigned">Assigned</option>
        <option value="Scheduled">Scheduled</option>
        <option value="Resolved">Resolved</option>
        <option value="Closed">Closed</option>
      </select>
      <select id="filterCat" onchange="filterComplaints()" class="filter-select">
        <option value="">All Categories</option>
        ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
      </select>
      <button onclick="showRegisterComplaint()" class="btn-primary"><i class="fas fa-plus"></i>New Complaint</button>
    </div>
  </div>

  <div id="complaintList">
    ${complaints.length === 0 ? `<div class="card p-12 text-center text-gray-400"><i class="fas fa-inbox text-4xl mb-3"></i><p>No complaints found</p></div>` :
      `<div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left font-semibold text-gray-600">ID</th>
                <th class="px-4 py-3 text-left font-semibold text-gray-600">Unit</th>
                <th class="px-4 py-3 text-left font-semibold text-gray-600">Category</th>
                <th class="px-4 py-3 text-left font-semibold text-gray-600 hidden md:table-cell">Description</th>
                <th class="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                <th class="px-4 py-3 text-left font-semibold text-gray-600 hidden md:table-cell">Date</th>
                <th class="px-4 py-3 text-left font-semibold text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              ${complaints.map(c => `
              <tr class="table-row border-t cursor-pointer" onclick="showComplaintDetail(${c.id})">
                <td class="px-4 py-3">
                  <div class="font-mono text-xs text-blue-700">${c.complaint_no}</div>
                  <div class="${priorityColor(c.priority)} text-xs font-semibold">${c.priority}</div>
                </td>
                <td class="px-4 py-3 font-semibold">Unit ${c.unit_no}</td>
                <td class="px-4 py-3">
                  <span class="text-gray-700">${c.category_name}</span>
                </td>
                <td class="px-4 py-3 text-gray-500 max-w-xs hidden md:table-cell">
                  <div class="truncate">${c.description}</div>
                </td>
                <td class="px-4 py-3">${statusBadge(c.status)}</td>
                <td class="px-4 py-3 text-gray-400 hidden md:table-cell">${formatDate(c.created_at)}</td>
                <td class="px-4 py-3">
                  <button onclick="event.stopPropagation();showComplaintDetail(${c.id})" class="text-blue-600 hover:text-blue-800">
                    <i class="fas fa-eye"></i>
                  </button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`}
  </div>`
}

function renderComplaintTable(complaints) {
  return `<div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="bg-gray-50">
        <tr>
          <th class="px-3 py-2 text-left text-gray-600">ID</th>
          <th class="px-3 py-2 text-left text-gray-600">Unit</th>
          <th class="px-3 py-2 text-left text-gray-600">Category</th>
          <th class="px-3 py-2 text-left text-gray-600">Status</th>
          <th class="px-3 py-2 text-left text-gray-600">Date</th>
          <th class="px-3 py-2"></th>
        </tr>
      </thead>
      <tbody>
        ${complaints.map(c => `<tr class="table-row border-t" onclick="showComplaintDetail(${c.id})" style="cursor:pointer">
          <td class="px-3 py-2 font-mono text-xs text-blue-700">${c.complaint_no}</td>
          <td class="px-3 py-2 font-semibold">Unit ${c.unit_no}</td>
          <td class="px-3 py-2">${c.category_name}</td>
          <td class="px-3 py-2">${statusBadge(c.status)}</td>
          <td class="px-3 py-2 text-gray-400">${formatDate(c.created_at)}</td>
          <td class="px-3 py-2"><button onclick="event.stopPropagation();showComplaintDetail(${c.id})" class="text-blue-600"><i class="fas fa-eye"></i></button></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`
}

async function filterComplaints() {
  const status = document.getElementById('filterStatus').value
  const category = document.getElementById('filterCat').value
  let url = '/complaints?limit=50'
  if (status) url += `&status=${status}`
  if (category) url += `&category=${category}`
  const r = await api('GET', url)
  if (!r?.ok) return
  const complaints = r.data.complaints || []
  const list = document.getElementById('complaintList')
  if (list) list.innerHTML = complaints.length === 0
    ? `<div class="card p-12 text-center text-gray-400"><i class="fas fa-inbox text-4xl mb-3"></i><p>No complaints found</p></div>`
    : `<div class="card overflow-hidden"><div class="overflow-x-auto"><table class="w-full text-sm"><thead class="bg-gray-50"><tr><th class="px-4 py-3 text-left">ID</th><th class="px-4 py-3 text-left">Unit</th><th class="px-4 py-3 text-left">Category</th><th class="px-4 py-3 text-left">Status</th><th class="px-4 py-3 text-left">Date</th><th class="px-4 py-3"></th></tr></thead><tbody>${complaints.map(c=>`<tr class="table-row border-t cursor-pointer" onclick="showComplaintDetail(${c.id})"><td class="px-4 py-3 font-mono text-xs text-blue-700">${c.complaint_no}</td><td class="px-4 py-3 font-semibold">Unit ${c.unit_no}</td><td class="px-4 py-3">${c.category_name}</td><td class="px-4 py-3">${statusBadge(c.status)}</td><td class="px-4 py-3 text-gray-400">${formatDate(c.created_at)}</td><td class="px-4 py-3"><button onclick="event.stopPropagation();showComplaintDetail(${c.id})" class="text-blue-600"><i class="fas fa-eye"></i></button></td></tr>`).join('')}</tbody></table></div></div>`
}

async function showComplaintDetail(id) {
  const r = await api('GET', `/complaints/${id}`)
  if (!r?.ok) { toast('Failed to load complaint', 'error'); return }
  const { complaint: c, audit_trail = [] } = r.data

  const isCust = currentUser.type === 'customer'
  const isAdmin = ['admin', 'sub_admin'].includes(currentUser.role)
  const isAssignedEmp = !isCust && currentUser.role === 'employee' && c.assigned_to_employee_id == currentUser.id

  // Load employees for assignment
  let employeeList = []
  if (isAdmin) {
    const empR = await api('GET', '/employees')
    employeeList = empR?.data?.employees?.filter(e => e.is_active && e.role === 'employee') || []
  }

  showModal(`
  <div class="modal-header">
    <div>
      <div class="modal-title">${c.complaint_no}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
        ${statusBadge(c.status)}
        <span style="font-size:12px;font-weight:700;" class="prio-${(c.priority||'normal').toLowerCase()}">${c.priority} Priority</span>
      </div>
    </div>
    <button onclick="closeModal()" class="modal-close"><i class="fas fa-times"></i></button>
  </div>
  <div class="modal-body">

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;" class="form-2col">
    <div style="background:#F9FAFB;border-radius:10px;padding:14px;font-size:12.5px;display:grid;gap:7px;">
      <div style="display:flex;gap:8px;"><span style="color:#9CA3AF;min-width:80px;">Unit</span><strong style="color:#111827;">Unit ${c.unit_no}</strong></div>
      <div style="display:flex;gap:8px;"><span style="color:#9CA3AF;min-width:80px;">Category</span><strong style="color:#111827;">${c.category_name}${c.sub_category_name ? ' &rarr; '+c.sub_category_name : ''}</strong></div>
      <div style="display:flex;gap:8px;"><span style="color:#9CA3AF;min-width:80px;">Resident</span><span style="color:#374151;">${c.customer_name||'&mdash;'}</span></div>
      <div style="display:flex;gap:8px;"><span style="color:#9CA3AF;min-width:80px;">Registered</span><span style="color:#374151;">${formatDateTime(c.created_at)}</span></div>
      ${c.assigned_to_name ? `<div style="display:flex;gap:8px;"><span style="color:#9CA3AF;min-width:80px;">Assigned To</span><strong style="color:#111827;">${c.assigned_to_name}</strong></div>` : ''}
      ${c.visit_date ? `<div style="display:flex;gap:8px;"><span style="color:#9CA3AF;min-width:80px;">Visit Date</span><span style="color:#374151;">${formatDate(c.visit_date)} ${c.visit_time||''}</span></div>` : ''}
      ${c.resolved_at ? `<div style="display:flex;gap:8px;"><span style="color:#9CA3AF;min-width:80px;">Resolved</span><span style="color:#374151;">${formatDateTime(c.resolved_at)}</span></div>` : ''}
    </div>
    <div>
      <div style="font-weight:700;font-size:12px;color:#374151;margin-bottom:6px;">Description</div>
      <p style="font-size:12.5px;color:#4B5563;background:#F9FAFB;border-radius:8px;padding:12px;line-height:1.6;">${c.description}</p>
      ${c.photo_data ? `<img src="${c.photo_data}" class="photo-preview" style="margin-top:10px;" onclick="window.open('${c.photo_data}')"/>` : ''}
    </div>
  </div>

  ${c.resolution_notes ? `
  <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:10px;padding:14px;margin-bottom:14px;">
    <div style="font-weight:700;color:#065F46;font-size:12.5px;margin-bottom:6px;"><i class="fas fa-check-circle" style="margin-right:6px;"></i>Resolution Notes</div>
    <p style="font-size:12.5px;color:#047857;">${c.resolution_notes}</p>
    ${c.resolution_photo_data ? `<img src="${c.resolution_photo_data}" class="photo-preview" style="margin-top:8px;" onclick="window.open('${c.resolution_photo_data}')"/>` : ''}
  </div>` : ''}

  <!-- Actions -->
  <div style="display:flex;flex-direction:column;gap:10px;">
    ${isAdmin && c.status === 'Open' ? `
    <div style="border:1.5px solid #E5E7EB;border-radius:10px;padding:14px;">
      <div style="font-weight:700;font-size:12.5px;margin-bottom:8px;color:#374151;"><i class="fas fa-user-check" style="color:#E8431A;margin-right:6px;"></i>Assign Complaint</div>
      <div style="display:flex;gap:8px;">
        <select id="assignEmpId" class="form-input" style="flex:1;">
          <option value="">Select Employee...</option>
          ${employeeList.map(e => `<option value="${e.id}">${e.name} (${e.department || e.role})</option>`).join('')}
        </select>
        <button onclick="assignComplaint(${c.id})" class="btn-primary btn-sm">Assign</button>
      </div>
    </div>` : ''}

    ${isAdmin && c.status === 'Assigned' ? `
    <div style="border:1.5px solid #E5E7EB;border-radius:10px;padding:14px;">
      <div style="font-weight:700;font-size:12.5px;margin-bottom:8px;color:#374151;"><i class="fas fa-sync" style="color:#E8431A;margin-right:6px;"></i>Re-Assign</div>
      <div style="display:flex;gap:8px;">
        <select id="assignEmpId" class="form-input" style="flex:1;">
          ${employeeList.map(e => `<option value="${e.id}" ${e.id == c.assigned_to_employee_id ? 'selected' : ''}>${e.name}</option>`).join('')}
        </select>
        <button onclick="assignComplaint(${c.id})" class="btn-primary btn-sm">Update</button>
      </div>
    </div>` : ''}

    ${isAssignedEmp && c.status === 'Assigned' ? `
    <div style="border:1.5px solid #E5E7EB;border-radius:10px;padding:14px;">
      <div style="font-weight:700;font-size:12.5px;margin-bottom:8px;color:#374151;"><i class="fas fa-calendar-plus" style="color:#E8431A;margin-right:6px;"></i>Schedule Visit</div>
      <div style="display:flex;gap:8px;">
        <input type="date" id="visitDate" class="form-input" value="${c.visit_date||''}"/>
        <input type="time" id="visitTime" class="form-input" value="${c.visit_time||''}"/>
        <button onclick="scheduleVisit(${c.id})" class="btn-primary btn-sm">Schedule</button>
      </div>
    </div>` : ''}

    ${isAssignedEmp && (c.status === 'Assigned' || c.status === 'Scheduled') ? `
    <div style="border:2px solid #A7F3D0;border-radius:10px;padding:14px;background:#FAFFFE;">
      <div style="font-weight:700;font-size:12.5px;margin-bottom:8px;color:#065F46;"><i class="fas fa-check-double" style="margin-right:6px;"></i>Mark as Resolved</div>
      <textarea id="resNotes" class="form-input" rows="2" placeholder="Resolution notes..." style="margin-bottom:8px;"></textarea>
      <label class="form-label">Upload Resolution Photo</label>
      <input type="file" id="resPhoto" accept="image/*" class="form-input" style="margin-bottom:8px;"/>
      <button onclick="resolveComplaint(${c.id})" class="btn-success" style="width:100%;justify-content:center;"><i class="fas fa-check"></i>Mark Resolved</button>
    </div>` : ''}

    ${isAdmin && c.status === 'Resolved' ? `
    <button onclick="closeComplaint(${c.id})" class="btn-secondary btn-sm" style="align-self:flex-start;"><i class="fas fa-lock"></i>Close Complaint</button>` : ''}
  </div>

  <!-- Activity Timeline -->
  ${audit_trail.length > 0 ? `
  <div style="margin-top:18px;">
    <div style="font-weight:700;font-size:12.5px;color:#374151;margin-bottom:10px;"><i class="fas fa-history" style="color:#E8431A;margin-right:6px;"></i>Activity Timeline</div>
    <div class="timeline">
      ${audit_trail.map(a => `
      <div class="timeline-item">
        <div style="font-size:12.5px;font-weight:600;color:#374151;">${a.description}</div>
        <div style="font-size:11px;color:#9CA3AF;margin-top:2px;">${formatDateTime(a.created_at)} &bull; ${a.actor_name || 'System'}</div>
      </div>`).join('')}
    </div>
  </div>` : ''}
  </div>
  `)
}

async function assignComplaint(id) {
  const empId = document.getElementById('assignEmpId').value
  if (!empId) { toast('Select an employee', 'error'); return }
  const r = await api('POST', `/complaints/${id}/assign`, { employee_id: parseInt(empId) })
  if (r?.ok) { toast(r.data.message, 'success'); closeModal(); navigate('complaints') }
  else toast(r?.data?.error || 'Failed', 'error')
}

async function scheduleVisit(id) {
  const visit_date = document.getElementById('visitDate').value
  const visit_time = document.getElementById('visitTime').value
  if (!visit_date) { toast('Select visit date', 'error'); return }
  const r = await api('POST', `/complaints/${id}/schedule`, { visit_date, visit_time })
  if (r?.ok) { toast(r.data.message, 'success'); closeModal(); navigate('complaints') }
  else toast(r?.data?.error || 'Failed', 'error')
}

async function resolveComplaint(id) {
  const resolution_notes = document.getElementById('resNotes').value
  const photoFile = document.getElementById('resPhoto').files[0]
  let resolution_photo_data = null
  if (photoFile) resolution_photo_data = await fileToBase64(photoFile)
  const r = await api('POST', `/complaints/${id}/resolve`, { resolution_notes, resolution_photo_data })
  if (r?.ok) { toast('Complaint resolved!', 'success'); closeModal(); navigate('complaints') }
  else toast(r?.data?.error || 'Failed', 'error')
}

async function closeComplaint(id) {
  if (!confirm('Close this complaint?')) return
  const r = await api('POST', `/complaints/${id}/close`)
  if (r?.ok) { toast('Complaint closed', 'success'); closeModal(); navigate('complaints') }
  else toast(r?.data?.error || 'Failed', 'error')
}

async function showRegisterComplaint() {
  const [catR, subCatR] = await Promise.all([
    api('GET', '/complaints/categories/list'),
    api('GET', '/complaints/sub-categories/list')
  ])
  const categories = catR?.data?.categories || []
  const allSubCats = subCatR?.data?.sub_categories || []
  const subByCat = {}
  allSubCats.forEach(sc => {
    if (!subByCat[sc.category_id]) subByCat[sc.category_id] = []
    subByCat[sc.category_id].push(sc)
  })
  window._subByCat = subByCat

  let unitSelector = ''
  if (currentUser.type === 'customer') {
    unitSelector = `<input type="hidden" id="compUnitId" value="${currentUser.unit_id}"/>
    <div class="mb-4"><label class="form-label">Unit</label>
    <input class="form-input bg-gray-50" value="Unit ${currentUser.unit_no}" disabled/></div>`
  } else {
    const unitsR = await api('GET', '/units?limit=300')
    const units = unitsR?.data?.units || []
    unitSelector = `<div class="mb-4"><label class="form-label">Select Unit *</label>
    <select id="compUnitId" class="form-input">
      <option value="">Choose Unit</option>
      ${units.map(u => `<option value="${u.id}">Unit ${u.unit_no} – ${u.owner_name || 'N/A'}</option>`).join('')}
    </select></div>`
  }

  const catIconMap = { Plumbing:'fa-tint', Electricity:'fa-bolt', Civil:'fa-hammer', Billing:'fa-receipt', Miscellaneous:'fa-ellipsis-h' }
  const catColorBg  = { Plumbing:'#EFF6FF', Electricity:'#FFFBEB', Civil:'#ECFDF5', Billing:'#F5F3FF', Miscellaneous:'#FFF5F3' }
  const catColorIcon= { Plumbing:'#2563EB', Electricity:'#D97706', Civil:'#059669', Billing:'#7C3AED', Miscellaneous:'#E8431A' }

  showModal(`
  <div class="modal-header">
    <div class="modal-title"><i class="fas fa-plus-circle" style="color:#E8431A;margin-right:8px;"></i>Register Complaint</div>
    <button onclick="closeModal()" class="modal-close"><i class="fas fa-times"></i></button>
  </div>
  <div class="modal-body">

  ${unitSelector}

  <div style="margin-bottom:16px;">
    <label class="form-label">Complaint Type *</label>
    <div class="grid-3" style="gap:8px;">
      ${categories.map(cat => {
        const ic = catIconMap[cat.name] || 'fa-tools'
        const bg = catColorBg[cat.name] || '#F9FAFB'
        const iconColor = catColorIcon[cat.name] || '#6B7280'
        return `<label style="cursor:pointer;">
        <input type="radio" name="catId" value="${cat.id}" style="display:none;" onchange="onCategoryChange(${cat.id})"/>
        <div onclick="this.previousElementSibling.click();this.previousElementSibling.dispatchEvent(new Event('change'));"
          style="background:${bg};border:2px solid transparent;border-radius:10px;padding:12px 8px;text-align:center;
          cursor:pointer;transition:all 0.18s;" id="catCard${cat.id}"
          onmouseover="this.style.borderColor='${iconColor}40'"
          onmouseout="if(!document.querySelector('input[name=catId]:checked')?.value==${cat.id})this.style.borderColor='transparent'">
          <i class="fas ${ic}" style="color:${iconColor};font-size:18px;margin-bottom:6px;display:block;"></i>
          <div style="font-size:11.5px;font-weight:600;color:#374151;">${cat.name}</div>
        </div>
      </label>`}).join('')}
    </div>
  </div>

  <div id="subCatSection" style="display:none;margin-bottom:16px;">
    <label class="form-label">Sub-Complaint Type</label>
    <select id="compSubCatId" class="form-input"><option value="">Select sub-type (optional)...</option></select>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;" class="form-2col">
    <div>
      <label class="form-label">Priority</label>
      <select id="compPriority" class="form-input">
        <option value="Normal">Normal</option>
        <option value="Low">Low</option>
        <option value="High">High</option>
        <option value="Urgent">Urgent</option>
      </select>
    </div>
    <div>
      <label class="form-label">Photo (Optional)</label>
      <input type="file" id="compPhoto" accept="image/*" class="form-input" style="padding:6px;"/>
    </div>
  </div>

  <div id="photoPreviewCont" style="display:none;margin-bottom:12px;">
    <img id="photoPreview" class="photo-preview"/>
  </div>

  <div style="margin-bottom:4px;">
    <label class="form-label">Description *</label>
    <textarea id="compDesc" class="form-input" rows="4" placeholder="Describe the issue in detail including location, severity, and any previous attempts to resolve..."></textarea>
  </div>

  </div>
  <div class="modal-footer">
    <button onclick="closeModal()" class="btn-ghost">Cancel</button>
    <button onclick="submitComplaint()" class="btn-primary"><i class="fas fa-paper-plane"></i>Submit Complaint</button>
  </div>`)

  document.getElementById('compPhoto')?.addEventListener('change', async (e) => {
    const f = e.target.files[0]
    if (f) {
      const data = await fileToBase64(f)
      document.getElementById('photoPreview').src = data
      document.getElementById('photoPreviewCont').classList.remove('hidden')
    }
  })
}

function onCategoryChange(catId) {
  // Visual highlight
  document.querySelectorAll('[id^="catCard"]').forEach(el => {
    el.style.borderColor = 'transparent'
    el.style.boxShadow = 'none'
    el.style.transform = ''
  })
  const selected = document.getElementById('catCard' + catId)
  if (selected) {
    selected.style.borderColor = '#E8431A'
    selected.style.boxShadow = '0 0 0 3px rgba(232,67,26,0.15)'
    selected.style.transform = 'scale(1.03)'
  }
  // Sub-categories
  const subs = (window._subByCat || {})[catId] || []
  const section = document.getElementById('subCatSection')
  const select  = document.getElementById('compSubCatId')
  if (subs.length) {
    select.innerHTML = `<option value="">Select sub-type (optional)...</option>` +
      subs.map(sc => `<option value="${sc.id}">${sc.name}</option>`).join('')
    section.style.display = ''
  } else {
    section.style.display = 'none'
    select.innerHTML = ''
  }
}

async function submitComplaint() {
  const unit_id = parseInt(document.getElementById('compUnitId')?.value)
  const catEl = document.querySelector('input[name="catId"]:checked')
  const category_id = catEl ? parseInt(catEl.value) : null
  const subCatEl = document.getElementById('compSubCatId')
  const sub_category_id = subCatEl?.value ? parseInt(subCatEl.value) : null
  const description = document.getElementById('compDesc').value.trim()
  const priority = document.getElementById('compPriority').value
  const photoFile = document.getElementById('compPhoto').files[0]

  if (!unit_id) { toast('Select a unit', 'error'); return }
  if (!category_id) { toast('Select a complaint type', 'error'); return }
  if (!description) { toast('Enter description', 'error'); return }

  let photo_data = null
  if (photoFile) photo_data = await fileToBase64(photoFile)

  const r = await api('POST', '/complaints', { unit_id, category_id, sub_category_id, description, priority, photo_data })
  if (r?.ok) {
    toast(`Complaint ${r.data.complaint_no} registered!`, 'success')
    closeModal()
    navigate('complaints')
  } else {
    toast(r?.data?.error || 'Failed to register', 'error')
  }
}

// ── Units ─────────────────────────────────────────────────────
async function loadUnits(params = {}) {
  const r = await api('GET', '/units?limit=100')
  if (!r?.ok) return
  const units = r.data.units || []
  const total = r.data.total || 0

  // Use unit_status (new column) for accurate counting
  const getStatus = u => u.unit_status || u.particulars || 'Vacant'
  const ownerOcc   = units.filter(u => getStatus(u) === 'Occupied by Owner').length
  const tenantOcc  = units.filter(u => getStatus(u) === 'Occupied by Tenant').length
  const occupied   = ownerOcc + tenantOcc
  const vacant     = units.filter(u => getStatus(u) === 'Vacant').length
  const construction = units.filter(u => getStatus(u) === 'Under Construction').length

  document.getElementById('pageContent').innerHTML = `
  <div class="page-header">
    <div class="page-title">
      <div class="page-title-icon"><i class="fas fa-building"></i></div>
      <div>
        <div>Unit Registry</div>
        <div class="page-subtitle">${total} units &bull; ${occupied} occupied &bull; ${vacant} vacant &bull; ${construction} under construction</div>
      </div>
    </div>
    <div class="page-actions">
      <div style="position:relative;">
        <i class="fas fa-search" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:#C4B5B0;font-size:12px;"></i>
        <input type="text" id="unitSearch" placeholder="Search unit, owner..." class="form-input" style="width:200px;padding-left:32px;" oninput="filterUnits(this.value)"/>
      </div>
      <select id="unitFilter" onchange="filterUnits(document.getElementById('unitSearch').value)" class="filter-select">
        <option value="">All Status</option>
        <option value="occupied by owner">Owner Occupied</option>
        <option value="occupied by tenant">Tenant Occupied</option>
        <option value="vacant">Vacant</option>
        <option value="under construction">Under Construction</option>
      </select>
    </div>
  </div>

  <div class="grid-5" style="margin-bottom:18px;">
    ${[
      ['Total',total,'sc-flame','fa-building'],
      ['Owner Occ.',ownerOcc,'sc-blue','fa-home'],
      ['Tenant Occ.',tenantOcc,'sc-green','fa-user-friends'],
      ['Vacant',vacant,'sc-teal','fa-door-open'],
      ['Under Const.',construction,'sc-gold','fa-hard-hat']
    ].map(([l,v,cls,ic]) => `
    <div class="stat-card ${cls}">
      <i class="fas ${ic} stat-icon"></i>
      <div class="stat-number">${v}</div>
      <div class="stat-label">${l}</div>
    </div>`).join('')}
  </div>

  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm" id="unitsTable">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left font-semibold text-gray-600">Unit No</th>
            <th class="px-4 py-3 text-left font-semibold text-gray-600">Owner</th>
            <th class="px-4 py-3 text-left font-semibold text-gray-600 hidden md:table-cell">Tenant</th>
            <th class="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
            <th class="px-4 py-3 text-left font-semibold text-gray-600 hidden md:table-cell">Area</th>
            <th class="px-4 py-3 text-left font-semibold text-gray-600">Action</th>
          </tr>
        </thead>
        <tbody id="unitsBody">
          ${renderUnitRows(units)}
        </tbody>
      </table>
    </div>
  </div>`
}

function renderUnitRows(units) {
  const isStaff = currentUser && currentUser.type === 'employee'
  return units.map(u => {
    const status = u.unit_status || u.particulars || 'Vacant'
    return `
  <tr class="table-row border-t" id="unit-row-${u.id}">
    <td class="px-4 py-3 font-bold text-blue-900 cursor-pointer hover:underline" onclick="showUnitDetail('${u.unit_no}')">Unit ${u.unit_no}</td>
    <td class="px-4 py-3">
      <div class="font-medium">${u.owner_name || '—'}</div>
      <div class="text-xs text-gray-400">${u.owner_mobile || ''}</div>
    </td>
    <td class="px-4 py-3 hidden md:table-cell">
      ${u.tenant_name ? `<div class="text-sm">${u.tenant_name}</div><div class="text-xs text-orange-400">${u.tenancy_expiry ? 'Exp: '+formatDate(u.tenancy_expiry) : ''}</div>` : '<span class="text-gray-300">—</span>'}
    </td>
    <td class="px-4 py-3" id="unit-status-cell-${u.id}">
      ${isStaff ? `
      <div style="display:flex;align-items:center;gap:6px;">
        ${unitStatusBadge(status)}
        <button onclick="showUnitStatusModal(${u.id},'${u.unit_no}','${status}')"
          style="width:22px;height:22px;border-radius:6px;border:1px solid #E5E7EB;background:white;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;" title="Change status">
          <i class="fas fa-pencil-alt" style="font-size:10px;color:#9CA3AF;"></i>
        </button>
      </div>` : unitStatusBadge(status)}
    </td>
    <td class="px-4 py-3 text-gray-500 hidden md:table-cell">${u.billing_area} ${u.area_unit}</td>
    <td class="px-4 py-3">
      <button onclick="showUnitDetail('${u.unit_no}')" class="text-blue-600 hover:text-blue-800 mr-2" title="View detail"><i class="fas fa-eye"></i></button>
      <button onclick="showAddComplaintForUnit(${u.id},'${u.unit_no}')" class="text-orange-500 hover:text-orange-700" title="Register complaint"><i class="fas fa-exclamation-circle"></i></button>
    </td>
  </tr>`}).join('')
}

function filterUnits(search) {
  const filter = document.getElementById('unitFilter').value.toLowerCase()
  const tbody = document.getElementById('unitsBody')
  if (!tbody) return
  const rows = tbody.querySelectorAll('tr')
  rows.forEach(row => {
    const text = row.textContent.toLowerCase()
    const matchSearch = !search || text.includes(search.toLowerCase())
    const matchFilter = !filter || text.includes(filter)
    row.style.display = matchSearch && matchFilter ? '' : 'none'
  })
}

// ── Unit Status Modal ─────────────────────────────────────────
function showUnitStatusModal(unitId, unitNo, currentStatus) {
  const opts = UNIT_STATUSES.map(s => {
    const style = UNIT_STATUS_STYLE[s]
    const isSelected = s === currentStatus
    return `<label style="display:block;cursor:pointer;margin-bottom:8px;">
      <input type="radio" name="newUnitStatus" value="${s}" ${isSelected?'checked':''} style="display:none;" />
      <div onclick="this.previousElementSibling.checked=true;document.querySelectorAll('.us-opt').forEach(el=>el.style.borderColor='#E5E7EB');this.style.borderColor='${style.color}';"
        class="us-opt" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;border:2px solid ${isSelected?style.color:'#E5E7EB'};background:${isSelected?style.bg:'white'};transition:all .15s;">
        <div style="width:32px;height:32px;border-radius:8px;background:${style.bg};border:1px solid ${style.border};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="fas ${style.icon}" style="color:${style.color};font-size:14px;"></i>
        </div>
        <div>
          <div style="font-weight:700;font-size:13px;color:#111827;">${s}</div>
          ${{
            'Vacant':'Unit is currently unoccupied',
            'Occupied by Owner':'Owner is residing in the unit',
            'Occupied by Tenant':'Tenant is residing in the unit',
            'Under Construction':'Unit undergoing construction/renovation'
          }[s] ? `<div style="font-size:11px;color:#9CA3AF;">${{
            'Vacant':'Unit is currently unoccupied',
            'Occupied by Owner':'Owner is residing in the unit',
            'Occupied by Tenant':'Tenant is residing in the unit',
            'Under Construction':'Unit undergoing construction/renovation'
          }[s]}</div>` : ''}
        </div>
        ${isSelected ? `<div style="margin-left:auto;"><i class="fas fa-check-circle" style="color:${style.color};font-size:16px;"></i></div>` : ''}
      </div>
    </label>`
  }).join('')

  showModal(`
    <div style="padding:0;">
      <div style="background:linear-gradient(135deg,#1E40AF,#1D4ED8);padding:18px 22px;border-radius:14px 14px 0 0;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;background:rgba(255,255,255,0.15);border-radius:9px;display:flex;align-items:center;justify-content:center;">
            <i class="fas fa-building" style="color:white;font-size:16px;"></i>
          </div>
          <div style="color:white;">
            <div style="font-weight:700;font-size:15px;">Update Unit Status</div>
            <div style="font-size:11px;opacity:0.8;">Unit ${unitNo}</div>
          </div>
        </div>
        <button onclick="closeModal()" style="background:rgba(255,255,255,0.15);border:none;border-radius:8px;padding:6px 10px;cursor:pointer;color:white;font-size:14px;"><i class="fas fa-times"></i></button>
      </div>
      <div style="padding:20px 22px;">
        <input type="hidden" id="statusUnitId" value="${unitId}" />
        ${opts}
        <div style="display:flex;gap:10px;margin-top:16px;">
          <button onclick="submitUnitStatus()" style="flex:1;padding:11px;background:linear-gradient(135deg,#1D4ED8,#1E40AF);color:white;border:none;border-radius:10px;font-weight:700;font-size:13.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
            <i class="fas fa-check"></i>Update Status
          </button>
          <button onclick="closeModal()" style="flex:0 0 auto;padding:11px 20px;border:1.5px solid #E5E7EB;border-radius:10px;background:white;color:#6B7280;cursor:pointer;font-weight:600;">Cancel</button>
        </div>
      </div>
    </div>
  `)
}

async function submitUnitStatus() {
  const unitId = document.getElementById('statusUnitId').value
  const selected = document.querySelector('input[name="newUnitStatus"]:checked')
  if (!selected) { toast('Select a status', 'error'); return }
  const unit_status = selected.value
  const r = await api('PATCH', `/units/${unitId}/status`, { unit_status })
  if (r?.ok) {
    toast('Unit status updated!', 'success')
    closeModal()
    // Refresh just the status cell without full reload
    const cell = document.getElementById(`unit-status-cell-${unitId}`)
    if (cell) {
      cell.innerHTML = `<div style="display:flex;align-items:center;gap:6px;">
        ${unitStatusBadge(unit_status)}
        <button onclick="showUnitStatusModal(${unitId},'','${unit_status}')"
          style="width:22px;height:22px;border-radius:6px;border:1px solid #E5E7EB;background:white;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="fas fa-pencil-alt" style="font-size:10px;color:#9CA3AF;"></i>
        </button>
      </div>`
    }
  } else {
    toast(r?.data?.error || 'Failed to update status', 'error')
  }
}

async function showUnitDetail(unitNo) {
  const r = await api('GET', `/units/${unitNo}`)
  if (!r?.ok) { toast('Unit not found', 'error'); return }
  const { unit, owner, tenant, owner_kyc, tenant_kyc, complaint_stats, property_history } = r.data

  const isAdmin = ['admin', 'sub_admin'].includes(currentUser.role)
  const isStaff = currentUser.type === 'employee'
  const currentStatus = unit.unit_status || unit.particulars || 'Vacant'

  showModal(`
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-xl font-bold text-gray-800"><i class="fas fa-home mr-2 text-blue-600"></i>Unit ${unit.unit_no}</h2>
    <button onclick="closeModal()" class="text-gray-400"><i class="fas fa-times text-xl"></i></button>
  </div>

  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
    ${unitStatusBadge(currentStatus)}
    <span class="text-gray-500 text-sm">${unit.billing_area} ${unit.area_unit}</span>
    ${isStaff ? `<button onclick="closeModal();showUnitStatusModal(${unit.id},'${unit.unit_no}','${currentStatus}')"
      style="margin-left:auto;background:#EFF6FF;border:1px solid #BFDBFE;color:#1D4ED8;border-radius:8px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;">
      <i class="fas fa-exchange-alt" style="font-size:11px;"></i>Change Status
    </button>` : ''}
  </div>

  <div class="grid md:grid-cols-2 gap-4 mb-4">
    <!-- Owner -->
    <div class="bg-blue-50 rounded-xl p-4">
      <div class="font-bold text-blue-900 mb-3"><i class="fas fa-user mr-1"></i>Owner Details</div>
      ${owner ? `
      <div class="space-y-1 text-sm">
        <div class="font-semibold">${owner.name}</div>
        <div class="text-gray-600">${owner.email || '—'}</div>
        <div class="text-gray-600">${owner.mobile1 || '—'}</div>
        <div class="text-gray-500 text-xs">${owner.address || ''}</div>
      </div>
      ${isAdmin ? `<div class="mt-3">
        <div class="text-xs font-bold text-blue-800 mb-2">KYC Status</div>
        <div class="grid grid-cols-2 gap-1 text-xs">
          ${[['aadhar','Aadhar'],['pan','PAN'],['photo','Photo'],['sale_deed','Sale Deed'],['maintenance_agreement','Maint. Agr.']].map(([k,l]) => `
          <div class="flex items-center gap-1">${kycChip(owner_kyc[k])} ${l}</div>`).join('')}
        </div>
        <button onclick="closeModal();navigateToManageKyc_owner(${owner.id},this.dataset.name,'${unit.unit_no}')" data-name="${owner.name}" class="mt-2 btn-primary btn-sm w-full"><i class="fas fa-edit mr-1"></i>Manage KYC</button>
      </div>` : ''}` : '<p class="text-gray-400 text-sm">No owner registered</p>'}
    </div>

    <!-- Tenant -->
    <div class="bg-orange-50 rounded-xl p-4">
      <div class="font-bold text-orange-800 mb-3"><i class="fas fa-user-friends mr-1"></i>Tenant Details</div>
      ${tenant ? `
      <div class="space-y-1 text-sm">
        <div class="font-semibold">${tenant.name}</div>
        <div class="text-gray-600">${tenant.email || '—'}</div>
        <div class="text-gray-600">${tenant.mobile1 || '—'}</div>
        <div class="text-orange-600 text-xs font-semibold">${tenant.tenancy_expiry ? 'Expires: ' + formatDate(tenant.tenancy_expiry) : ''}</div>
      </div>
      ${isAdmin ? `<div class="mt-3">
        <div class="text-xs font-bold text-orange-800 mb-2">Tenant KYC</div>
        <div class="grid grid-cols-2 gap-1 text-xs">
          ${[['tenancy_contract','Contract'],['aadhar','Aadhar'],['pan','PAN'],['photo','Photo'],['police_verification','Police Verif.']].map(([k,l]) => `
          <div class="flex items-center gap-1">${kycChip(tenant_kyc[k])} ${l}</div>`).join('')}
        </div>
      </div>` : ''}` : `<p class="text-gray-400 text-sm">No tenant</p>`}
    </div>
  </div>

  <!-- Complaint stats -->
  <div class="mb-4">
    <div class="font-semibold text-sm mb-2">Complaint Stats</div>
    <div class="flex gap-2 flex-wrap">
      ${(complaint_stats || []).map(s => `<div class="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100">${s.status}: ${s.cnt}</div>`).join('')}
      ${!(complaint_stats?.length) ? '<span class="text-gray-400 text-xs">No complaints</span>' : ''}
    </div>
  </div>

  <!-- Property History -->
  ${property_history?.length ? `
  <div>
    <div class="font-semibold text-sm mb-2"><i class="fas fa-history mr-1"></i>Property History</div>
    <div class="timeline max-h-40 overflow-y-auto">
      ${property_history.map(h => `
      <div class="timeline-item">
        <div class="text-sm">${h.description}</div>
        <div class="text-xs text-gray-400">${formatDate(h.changed_at)} · ${h.changed_by || 'System'}</div>
      </div>`).join('')}
    </div>
  </div>` : ''}

  <div class="flex gap-2 mt-4">
    <button onclick="closeModal();showRegisterComplaintForUnit(${unit.id}, '${unit.unit_no}')" class="btn-primary flex-1">
      <i class="fas fa-plus mr-1"></i>New Complaint
    </button>
    ${isAdmin && owner ? `<button onclick="closeModal();navigate('customers',{highlight:${owner.id}})" class="btn-secondary flex-1">
      <i class="fas fa-user-edit mr-1"></i>Edit Owner
    </button>` : ''}
  </div>
  `)
}

async function showRegisterComplaintForUnit(unitId, unitNo) {
  const catR = await api('GET', '/complaints/categories/list')
  const categories = catR?.data?.categories || []

  showModal(`
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-xl font-bold">New Complaint – Unit ${unitNo}</h2>
    <button onclick="closeModal()" class="text-gray-400"><i class="fas fa-times"></i></button>
  </div>
  <input type="hidden" id="compUnitId" value="${unitId}"/>
  <div class="mb-4">
    <label class="form-label">Category *</label>
    <div class="grid grid-cols-2 gap-2">
      ${categories.map(c => `<label class="cursor-pointer"><input type="radio" name="catId" value="${c.id}" class="hidden peer"/>
      <div class="peer-checked:ring-2 peer-checked:ring-blue-600 peer-checked:bg-blue-50 border rounded-lg p-2 text-center hover:bg-gray-50">
        <div class="text-lg"><i class="fas ${c.icon||'fa-tools'}"></i></div>
        <div class="text-xs font-medium">${c.name}</div>
      </div></label>`).join('')}
    </div>
  </div>
  <div class="mb-4"><label class="form-label">Priority</label>
    <select id="compPriority" class="form-input">
      <option>Normal</option><option>Low</option><option>High</option><option>Urgent</option>
    </select>
  </div>
  <div class="mb-4"><label class="form-label">Description *</label>
    <textarea id="compDesc" class="form-input" rows="3" placeholder="Describe the issue..."></textarea>
  </div>
  <div class="mb-4"><label class="form-label">Photo</label>
    <input type="file" id="compPhoto" accept="image/*" class="form-input"/>
  </div>
  <button onclick="submitComplaint()" class="btn-primary w-full">Submit Complaint</button>
  `)
}

// ── Customers ─────────────────────────────────────────────────
async function loadCustomers(params = {}) {
  const r = await api('GET', '/customers?limit=50')
  if (!r?.ok) return
  const customers = r.data.customers || []

  document.getElementById('pageContent').innerHTML = `
  <div class="page-header">
    <div class="page-title">
      <div class="page-title-icon"><i class="fas fa-users"></i></div>
      <div>
        <div>Customer Master</div>
        <div class="page-subtitle">${customers.length} registered owner(s)</div>
      </div>
    </div>
    <div class="page-actions">
      <div style="position:relative;">
        <i class="fas fa-search" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:#C4B5B0;font-size:12px;"></i>
        <input type="text" id="custSearch" placeholder="Search by name, unit, email..." class="form-input" style="width:240px;padding-left:32px;" oninput="searchCustomers(this.value)"/>
      </div>
      <button onclick="showAddCustomer()" class="btn-primary"><i class="fas fa-plus"></i>Add Customer</button>
    </div>
  </div>
  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm" id="custTable">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left font-semibold text-gray-600">Unit</th>
            <th class="px-4 py-3 text-left font-semibold text-gray-600">Name</th>
            <th class="px-4 py-3 text-left font-semibold text-gray-600 hidden md:table-cell">Email</th>
            <th class="px-4 py-3 text-left font-semibold text-gray-600 hidden md:table-cell">Mobile</th>
            <th class="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
            <th class="px-4 py-3 text-left font-semibold text-gray-600">KYC</th>
            <th class="px-4 py-3 text-left font-semibold text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${renderCustomerRows(customers)}
        </tbody>
      </table>
    </div>
  </div>`
}

function renderCustomerRows(customers) {
  return customers.map(c => `
  <tr class="table-row border-t">
    <td class="px-4 py-3 font-bold text-blue-900">Unit ${c.unit_no}</td>
    <td class="px-4 py-3">
      <div class="font-medium">${c.name}</div>
    </td>
    <td class="px-4 py-3 text-gray-500 hidden md:table-cell">${c.email || '—'}</td>
    <td class="px-4 py-3 text-gray-500 hidden md:table-cell">${c.mobile1 || '—'}</td>
    <td class="px-4 py-3">${particularsBadge(c.particulars)}</td>
    <td class="px-4 py-3"><span class="kyc-chip kyc-pending text-xs">View</span></td>
    <td class="px-4 py-3 flex gap-2">
      <button onclick="showCustomerDetail(${c.id})" class="text-blue-600 hover:text-blue-800" title="View"><i class="fas fa-eye"></i></button>
      <button onclick="showEditCustomer(${c.id})" class="text-yellow-600 hover:text-yellow-800" title="Edit"><i class="fas fa-edit"></i></button>
      ${currentUser.role === 'admin' ? `<button onclick="deleteCustomer(${c.id})" class="text-red-500 hover:text-red-700" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
    </td>
  </tr>`).join('')
}

async function searchCustomers(q) {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(async () => {
    const r = await api('GET', `/customers?limit=50&search=${encodeURIComponent(q)}`)
    if (!r?.ok) return
    const tbody = document.querySelector('#custTable tbody')
    if (tbody) tbody.innerHTML = renderCustomerRows(r.data.customers || [])
  }, 300)
}

async function showAddCustomer() {
  const unitsR = await api('GET', '/units?limit=300')
  const units = unitsR?.data?.units || []

  showModal(`
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-xl font-bold">Add New Customer</h2>
    <button onclick="closeModal()" class="text-gray-400"><i class="fas fa-times"></i></button>
  </div>
  <div class="grid md:grid-cols-2 gap-4">
    <div><label class="form-label">Unit *</label>
      <select id="custUnit" class="form-input">
        <option value="">Select Unit</option>
        ${units.map(u => `<option value="${u.id}">Unit ${u.unit_no} (${u.particulars})</option>`).join('')}
      </select>
    </div>
    <div><label class="form-label">Full Name *</label><input id="custName" class="form-input" placeholder="Customer full name"/></div>
    <div><label class="form-label">Email</label><input id="custEmail" type="email" class="form-input" placeholder="email@example.com"/></div>
    <div><label class="form-label">Mobile 1</label><input id="custMobile1" class="form-input" placeholder="Mobile number"/></div>
    <div><label class="form-label">Mobile 2</label><input id="custMobile2" class="form-input" placeholder="Alt. mobile"/></div>
    <div><label class="form-label">Initial Password</label><input id="custPwd" type="password" class="form-input" placeholder="Customer@123" value="Customer@123"/></div>
    <div class="md:col-span-2"><label class="form-label">Address</label>
      <textarea id="custAddr" class="form-input" rows="2" placeholder="Full address..."></textarea>
    </div>
  </div>
  <button onclick="addCustomer()" class="btn-primary w-full mt-4">Add Customer</button>
  `)
}

async function addCustomer() {
  const data = {
    unit_id: parseInt(document.getElementById('custUnit').value),
    name: document.getElementById('custName').value.trim(),
    email: document.getElementById('custEmail').value.trim(),
    mobile1: document.getElementById('custMobile1').value.trim(),
    mobile2: document.getElementById('custMobile2').value.trim(),
    address: document.getElementById('custAddr').value.trim(),
    password: document.getElementById('custPwd').value,
  }
  if (!data.unit_id || !data.name) { toast('Unit and name required', 'error'); return }
  const r = await api('POST', '/customers', data)
  if (r?.ok) { toast('Customer added!', 'success'); closeModal(); navigate('customers') }
  else toast(r?.data?.error || 'Failed', 'error')
}

async function showCustomerDetail(id) {
  const r = await api('GET', `/customers/${id}`)
  if (!r?.ok) { toast('Failed to load', 'error'); return }
  const { customer: c, kyc_documents, tenant, tenant_kyc, complaints } = r.data

  const ownerDocs = ['aadhar', 'pan', 'photo', 'sale_deed', 'maintenance_agreement']
  const tenantDocs = ['tenancy_contract', 'aadhar', 'pan', 'photo', 'police_verification']
  const uploadedOwner = kyc_documents?.map(d => d.doc_type) || []

  showModal(`
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-xl font-bold">${c.name}</h2>
    <button onclick="closeModal()" class="text-gray-400"><i class="fas fa-times"></i></button>
  </div>

  <div class="grid md:grid-cols-2 gap-4 mb-4">
    <div class="bg-blue-50 rounded-xl p-4 text-sm space-y-2">
      <div class="font-bold text-blue-900">Unit ${c.unit_no} · ${c.particulars}</div>
      <div><i class="fas fa-envelope mr-2 text-blue-400"></i>${c.email || '—'}</div>
      <div><i class="fas fa-phone mr-2 text-blue-400"></i>${c.mobile1 || '—'} ${c.mobile2 ? '· '+c.mobile2 : ''}</div>
      <div class="text-gray-500 text-xs">${c.address || ''}</div>
      <div class="text-gray-400 text-xs">Member since: ${formatDate(c.created_at)}</div>
    </div>
    <div>
      <div class="font-bold text-sm mb-2">Owner KYC Documents</div>
      <div class="space-y-2">
        ${ownerDocs.map(t => {
          const doc = kyc_documents?.find(d => d.doc_type === t)
          return `<div class="flex items-center justify-between p-2 rounded-lg ${doc ? 'bg-green-50' : 'bg-red-50'}">
          <span class="text-xs font-medium ${doc ? 'text-green-700' : 'text-red-600'}">${t.replace('_',' ').toUpperCase()}</span>
          ${doc ? `<div class="flex gap-2">
            <span class="kyc-chip kyc-done">Uploaded</span>
            <button onclick="uploadKyc('customer',${c.id},'${t}')" class="text-xs text-blue-600">Replace</button>
          </div>` : `<button onclick="uploadKyc('customer',${c.id},'${t}')" class="btn-primary btn-sm">Upload</button>`}
          </div>`
        }).join('')}
      </div>
    </div>
  </div>

  ${tenant ? `
  <div class="mb-4 p-4 bg-orange-50 rounded-xl">
    <div class="font-bold text-orange-800 mb-2"><i class="fas fa-user-friends mr-1"></i>Tenant: ${tenant.name}</div>
    <div class="text-sm space-y-1">
      <div>${tenant.email || '—'} · ${tenant.mobile1 || '—'}</div>
      ${tenant.tenancy_expiry ? `<div class="text-orange-600">Expiry: ${formatDate(tenant.tenancy_expiry)}</div>` : ''}
    </div>
    <div class="mt-2 font-bold text-sm mb-1">Tenant KYC</div>
    <div class="grid grid-cols-3 gap-1">
      ${tenantDocs.map(t => {
        const doc = tenant_kyc?.find(d => d.doc_type === t)
        return `<div class="flex items-center gap-1 text-xs ${doc ? 'text-green-600' : 'text-red-500'}">
          <i class="fas ${doc ? 'fa-check' : 'fa-times'}"></i> ${t.replace('_',' ')}
        </div>`
      }).join('')}
    </div>
    <button onclick="closeModal();navigateToManageKyc_tenant(${tenant.id},this.dataset.name,'${c.unit_no}')" data-name="${tenant.name}" class="btn-secondary btn-sm mt-2"><i class="fas fa-edit mr-1"></i>Manage Tenant KYC</button>
  </div>` : `
  <div class="mb-4 p-3 bg-gray-50 rounded-xl flex justify-between items-center">
    <span class="text-gray-500 text-sm">No active tenant</span>
    <button onclick="closeModal();showAddTenant(${c.id},${c.unit_id})" class="btn-secondary btn-sm">Add Tenant</button>
  </div>`}

  <div class="mb-4">
    <div class="font-bold text-sm mb-2">Recent Complaints (${complaints?.length || 0})</div>
    ${complaints?.length ? complaints.slice(0,3).map(cp => `<div class="flex justify-between text-sm p-2 bg-gray-50 rounded mb-1">
      <span>${cp.complaint_no} · ${cp.category_name}</span>${statusBadge(cp.status)}
    </div>`).join('') : '<span class="text-gray-400 text-sm">No complaints</span>'}
  </div>

  <div class="flex gap-2">
    <button onclick="closeModal();showEditCustomer(${c.id})" class="btn-primary flex-1">Edit Details</button>
    <button onclick="closeModal();showAddTenant(${c.id},${c.unit_id})" class="btn-secondary flex-1">
      ${tenant ? 'Update Tenant' : 'Add Tenant'}
    </button>
  </div>
  `)
}

async function showEditCustomer(id) {
  const r = await api('GET', `/customers/${id}`)
  if (!r?.ok) return
  const c = r.data.customer
  showModal(`
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-xl font-bold">Edit Customer</h2>
    <button onclick="closeModal()" class="text-gray-400"><i class="fas fa-times"></i></button>
  </div>
  <div class="grid md:grid-cols-2 gap-4">
    <div><label class="form-label">Full Name *</label><input id="eName" class="form-input" value="${c.name}"/></div>
    <div><label class="form-label">Email</label><input id="eEmail" type="email" class="form-input" value="${c.email || ''}"/></div>
    <div><label class="form-label">Mobile 1</label><input id="eMobile1" class="form-input" value="${c.mobile1 || ''}"/></div>
    <div><label class="form-label">Mobile 2</label><input id="eMobile2" class="form-input" value="${c.mobile2 || ''}"/></div>
    <div class="md:col-span-2"><label class="form-label">Address</label>
      <textarea id="eAddr" class="form-input" rows="2">${c.address || ''}</textarea>
    </div>
  </div>
  <button onclick="updateCustomer(${c.id})" class="btn-primary w-full mt-4">Update Customer</button>
  `)
}

async function updateCustomer(id) {
  const data = {
    name: document.getElementById('eName').value.trim(),
    email: document.getElementById('eEmail').value.trim(),
    mobile1: document.getElementById('eMobile1').value.trim(),
    mobile2: document.getElementById('eMobile2').value.trim(),
    address: document.getElementById('eAddr').value.trim(),
  }
  const r = await api('PUT', `/customers/${id}`, data)
  if (r?.ok) { toast('Customer updated!', 'success'); closeModal(); navigate('customers') }
  else toast(r?.data?.error || 'Failed', 'error')
}

async function deleteCustomer(id) {
  if (!confirm('Remove this customer? This action cannot be undone.')) return
  const r = await api('DELETE', `/customers/${id}`)
  if (r?.ok) { toast('Customer removed', 'success'); navigate('customers') }
  else toast(r?.data?.error || 'Failed', 'error')
}

function showAddTenant(customerId, unitId) {
  showModal(`
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-xl font-bold">Add Tenant</h2>
    <button onclick="closeModal()" class="text-gray-400"><i class="fas fa-times"></i></button>
  </div>
  <div class="grid md:grid-cols-2 gap-4">
    <div><label class="form-label">Tenant Name *</label><input id="tName" class="form-input" placeholder="Full name"/></div>
    <div><label class="form-label">Email</label><input id="tEmail" type="email" class="form-input"/></div>
    <div><label class="form-label">Mobile 1</label><input id="tMobile1" class="form-input"/></div>
    <div><label class="form-label">Mobile 2</label><input id="tMobile2" class="form-input"/></div>
    <div><label class="form-label">Tenancy Start</label><input id="tStart" type="date" class="form-input"/></div>
    <div><label class="form-label">Tenancy Expiry</label><input id="tExpiry" type="date" class="form-input"/></div>
  </div>
  <button onclick="addTenant(${customerId},${unitId})" class="btn-primary w-full mt-4">Add Tenant</button>
  `)
}

async function addTenant(customerId, unitId) {
  const data = {
    unit_id: unitId,
    name: document.getElementById('tName').value.trim(),
    email: document.getElementById('tEmail').value.trim(),
    mobile1: document.getElementById('tMobile1').value.trim(),
    mobile2: document.getElementById('tMobile2').value.trim(),
    tenancy_start: document.getElementById('tStart').value,
    tenancy_expiry: document.getElementById('tExpiry').value,
  }
  if (!data.name) { toast('Tenant name required', 'error'); return }
  const r = await api('POST', `/customers/${customerId}/tenant`, data)
  if (r?.ok) { toast('Tenant added!', 'success'); closeModal(); }
  else toast(r?.data?.error || 'Failed', 'error')
}

// ═══════════════════════════════════════════════════════════════
// KYC MANAGEMENT — Full document upload + history trail
// ═══════════════════════════════════════════════════════════════

// Document type metadata
const KYC_OWNER_DOCS = [
  { key: 'aadhar',                label: 'Aadhar Card',           icon: 'fa-id-card',         color: '#3b82f6' },
  { key: 'pan',                   label: 'PAN Card',              icon: 'fa-credit-card',     color: '#8b5cf6' },
  { key: 'photo',                 label: 'Photograph',            icon: 'fa-camera',          color: '#ec4899' },
  { key: 'sale_deed',             label: 'Sale Deed',             icon: 'fa-file-contract',   color: '#f59e0b' },
  { key: 'maintenance_agreement', label: 'Maintenance Agreement', icon: 'fa-file-signature',  color: '#10b981' },
]
const KYC_TENANT_DOCS = [
  { key: 'tenancy_contract',  label: 'Tenancy Contract',    icon: 'fa-file-contract',  color: '#f59e0b' },
  { key: 'aadhar',            label: 'Aadhar Card',         icon: 'fa-id-card',        color: '#3b82f6' },
  { key: 'pan',               label: 'PAN Card',            icon: 'fa-credit-card',    color: '#8b5cf6' },
  { key: 'photo',             label: 'Photograph',          icon: 'fa-camera',         color: '#ec4899' },
  { key: 'police_verification', label: 'Police Verification', icon: 'fa-shield-alt',  color: '#ef4444' },
]

// ── KYC Upload modal (triggered from quick buttons) ──────────
function uploadKyc(entityType, entityId, docType) {
  openKycUploadModal(entityType, entityId, docType, null)
}
// ── Manage KYC full page ─────────────────────────────────────
// Opens a full-page KYC management view showing:
//  - Owner KYC documents tab (always shown)
//  - Tenant KYC documents tab (shown if tenantId provided)
// Each tab: document grid + per-document full version history

async function openManageKyc(ownerEntityType, ownerEntityId, ownerName, unitNo, tenantEntityType, tenantEntityId, tenantName) {
  // Persist state for refresh after upload
  window._kycManageState = { entityType: ownerEntityType, entityId: ownerEntityId, entityName: ownerName, unitNo, ownerEntityType, ownerEntityId, ownerName }

  const content = document.getElementById('pageContent')
  if (content) content.innerHTML = '<div class="loading"><div class="spinner"></div></div>'

  // Fetch owner KYC data
  const ownerKycR = await api('GET', `/kyc/${ownerEntityType}/${ownerEntityId}`)
  const ownerKyc = ownerKycR?.data || {}

  // Fetch tenant KYC data if tenant exists
  let tenantKyc = null
  if (tenantEntityId) {
    const tenantKycR = await api('GET', `/kyc/${tenantEntityType}/${tenantEntityId}`)
    tenantKyc = tenantKycR?.data || null
  }

  const hasTenant = !!(tenantEntityId && tenantKyc)
  const activeTab = hasTenant ? (window._kycManageActiveTab || 'owner') : 'owner'

  const ownerPct = ownerKyc.completion_percentage ?? 0
  const tenantPct = tenantKyc?.completion_percentage ?? 0

  if (content) content.innerHTML = `
  <div class="max-w-5xl mx-auto">
    <!-- Header -->
    <div class="flex items-center gap-4 mb-6">
      <button onclick="history.back()" class="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100">
        <i class="fas fa-arrow-left text-lg"></i>
      </button>
      <div>
        <h1 class="text-2xl font-bold text-gray-800"><i class="fas fa-id-card mr-2 text-blue-900"></i>Manage KYC – Unit ${unitNo}</h1>
        <p class="text-gray-500 text-sm mt-0.5">Upload, replace, and track document versions for owner and tenant</p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-2 mb-6 border-b pb-0">
      <button id="kycTabBtnOwner" onclick="switchKycManageTab('owner')"
        class="px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-all ${activeTab==='owner' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}">
        <i class="fas fa-user mr-1.5"></i>Owner KYC
        <span class="ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${ownerPct===100?'bg-green-100 text-green-700':'bg-gray-100 text-gray-600'}">${ownerPct}%</span>
      </button>
      ${hasTenant ? `
      <button id="kycTabBtnTenant" onclick="switchKycManageTab('tenant')"
        class="px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-all ${activeTab==='tenant' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">
        <i class="fas fa-user-friends mr-1.5"></i>Tenant KYC – ${tenantName || 'Tenant'}
        <span class="ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${tenantPct===100?'bg-green-100 text-green-700':'bg-gray-100 text-gray-600'}">${tenantPct}%</span>
      </button>` : `
      <div class="px-5 py-3 text-sm text-gray-400 italic flex items-center gap-2">
        <i class="fas fa-user-slash"></i>No active tenant
      </div>`}
    </div>

    <!-- Owner Tab Content -->
    <div id="kycPanelOwner" class="${activeTab==='owner' ? '' : 'hidden'}">
      ${renderKycManagePanel('customer', ownerEntityId, ownerName, KYC_OWNER_DOCS, ownerKyc, 'blue')}
    </div>

    <!-- Tenant Tab Content -->
    ${hasTenant ? `
    <div id="kycPanelTenant" class="${activeTab==='tenant' ? '' : 'hidden'}">
      ${renderKycManagePanel('tenant', tenantEntityId, tenantName, KYC_TENANT_DOCS, tenantKyc, 'orange')}
    </div>` : ''}
  </div>`

  // Store tenant info for tab switches
  window._kycManageData = { ownerEntityType, ownerEntityId, ownerName, unitNo, tenantEntityType, tenantEntityId, tenantName }
}

function switchKycManageTab(tab) {
  window._kycManageActiveTab = tab
  document.getElementById('kycPanelOwner')?.classList.toggle('hidden', tab !== 'owner')
  document.getElementById('kycPanelTenant')?.classList.toggle('hidden', tab !== 'tenant')
  const ownerBtn = document.getElementById('kycTabBtnOwner')
  const tenantBtn = document.getElementById('kycTabBtnTenant')
  if (ownerBtn) ownerBtn.className = ownerBtn.className.replace(/(border-blue-600 text-blue-700|border-transparent text-gray-500 hover:text-gray-700)/g, tab==='owner' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700')
  if (tenantBtn) tenantBtn.className = tenantBtn.className.replace(/(border-orange-500 text-orange-600|border-transparent text-gray-500 hover:text-gray-700)/g, tab==='tenant' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700')
}

function renderKycManagePanel(entityType, entityId, entityName, docList, kycData, color) {
  const currentDocs = kycData.current_documents || []
  const history = kycData.history || []
  const pct = kycData.completion_percentage ?? 0
  const missingTypes = kycData.missing_types || []

  const colorMap = {
    blue:   { bg: 'bg-blue-50',   header: 'bg-blue-600',   text: 'text-blue-700',   btn: 'bg-blue-600',   border: 'border-blue-200'  },
    orange: { bg: 'bg-orange-50', header: 'bg-orange-500', text: 'text-orange-700', btn: 'bg-orange-500', border: 'border-orange-200' },
  }
  const c = colorMap[color] || colorMap.blue

  // Group history by doc_type for quick lookup
  const historyByType = {}
  history.forEach(h => {
    if (!historyByType[h.doc_type]) historyByType[h.doc_type] = []
    historyByType[h.doc_type].push(h)
  })

  return `
  <!-- Summary bar -->
  <div class="card p-4 mb-6 flex flex-wrap items-center gap-4">
    <div class="flex-1 min-w-48">
      <div class="flex justify-between text-sm mb-1">
        <span class="font-semibold text-gray-700">${entityName}</span>
        <span class="font-bold ${pct===100?'text-green-600':'text-orange-500'}">${pct}% complete</span>
      </div>
      <div class="w-full bg-gray-100 rounded-full h-2.5">
        <div class="h-2.5 rounded-full transition-all ${pct===100?'bg-green-500':pct>=60?'bg-yellow-400':'bg-red-400'}" style="width:${pct}%"></div>
      </div>
    </div>
    <div class="flex items-center gap-3 text-sm">
      <span class="text-green-600 font-semibold"><i class="fas fa-check-circle mr-1"></i>${docList.length - missingTypes.length} uploaded</span>
      ${missingTypes.length > 0 ? `<span class="text-red-500 font-semibold"><i class="fas fa-times-circle mr-1"></i>${missingTypes.length} missing</span>` : ''}
      ${pct===100 ? `<span class="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold"><i class="fas fa-check-double mr-1"></i>KYC Complete</span>` : ''}
    </div>
    <button onclick="openKycUploadModal('${entityType}',${entityId},null,'refreshManageKyc')" class="btn-primary btn-sm" id="quickUploadBtn_${entityType}_${entityId}">
      <i class="fas fa-plus mr-1"></i>Upload New Document
    </button>
  </div>

  <!-- Document Cards Grid -->
  <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
    ${docList.map(doc => {
      const current = currentDocs.find(d => d.doc_type === doc.key)
      const docHistory = historyByType[doc.key] || []
      const versionCount = docHistory.length
      const isUploaded = !!current

      return `
      <div class="card border-l-4 ${isUploaded ? 'border-green-400' : 'border-red-300'}" style="border-left-color:${isUploaded ? '#4ade80' : '#fca5a5'}">
        <div class="p-4">
          <!-- Doc header -->
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:${doc.color}20">
                <i class="fas ${doc.icon} text-base" style="color:${doc.color}"></i>
              </div>
              <div>
                <div class="font-semibold text-gray-800 text-sm">${doc.label}</div>
                <div class="text-xs ${isUploaded?'text-green-600 font-semibold':'text-red-500'}">
                  ${isUploaded ? `<i class="fas fa-check-circle mr-0.5"></i>Uploaded` : `<i class="fas fa-exclamation-circle mr-0.5"></i>Not uploaded`}
                </div>
              </div>
            </div>
            ${versionCount > 1 ? `<span class="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">${versionCount} versions</span>` : ''}
          </div>

          ${isUploaded && current ? `
          <!-- Latest version info -->
          <div class="bg-green-50 rounded-lg p-3 mb-3 text-xs space-y-1">
            <div class="flex justify-between">
              <span class="font-semibold text-green-800">Version ${current.version} (Latest)</span>
              <span class="text-green-600">${formatDateTime(current.uploaded_at)}</span>
            </div>
            <div class="text-gray-600 flex items-center gap-1">
              <i class="fas fa-user text-gray-400"></i>
              ${current.uploaded_by_name || 'Staff'}
            </div>
            ${current.remarks ? `<div class="text-gray-500 italic"><i class="fas fa-comment mr-1"></i>${current.remarks}</div>` : ''}
            ${current.file_data && current.file_data.startsWith('data:image') ? `
            <div class="mt-2">
              <img src="${current.file_data}" class="w-full max-h-32 object-cover rounded-lg cursor-pointer border border-green-200"
                onclick="viewDocumentImage('${current.file_name}', '${current.file_data}')" title="Click to view full size"/>
            </div>` : current.file_name ? `
            <div class="flex items-center gap-2 mt-1 p-2 bg-white rounded border border-green-200">
              <i class="fas fa-file-alt text-green-600"></i>
              <span class="text-green-700 text-xs font-medium truncate">${current.file_name}</span>
            </div>` : ''}
          </div>` : `
          <!-- Missing placeholder -->
          <div class="bg-red-50 rounded-lg p-3 mb-3 text-xs text-red-500 text-center">
            <i class="fas fa-upload text-red-300 text-2xl block mb-1"></i>
            No document uploaded yet
          </div>`}

          <!-- Action buttons -->
          <div class="flex gap-2">
            <button onclick="openKycUploadModal('${entityType}',${entityId},'${doc.key}','refreshManageKyc')"
              class="flex-1 text-xs px-3 py-2 rounded-lg font-semibold border transition-all hover:shadow-sm
                ${isUploaded ? 'bg-white border-blue-200 text-blue-700 hover:bg-blue-50' : 'text-white border-transparent hover:opacity-90'}"
              style="${isUploaded ? '' : 'background:' + doc.color}">
              <i class="fas fa-${isUploaded ? 'redo' : 'upload'} mr-1"></i>
              ${isUploaded ? 'Replace / Update' : 'Upload Now'}
            </button>
            ${versionCount > 0 ? `
            <button onclick="toggleDocHistory('hist_${entityType}_${entityId}_${doc.key}')"
              class="px-3 py-2 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200">
              <i class="fas fa-history mr-1"></i>History
            </button>` : ''}
          </div>
        </div>

        ${versionCount > 0 ? `
        <!-- Version History (collapsible) -->
        <div id="hist_${entityType}_${entityId}_${doc.key}" class="hidden border-t bg-gray-50">
          <div class="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wide flex justify-between items-center">
            <span><i class="fas fa-history mr-1"></i>Full Version History</span>
            <span class="text-blue-600">${versionCount} version${versionCount !== 1 ? 's' : ''}</span>
          </div>
          <div class="max-h-72 overflow-y-auto">
            ${docHistory.map((h, idx) => `
            <div class="px-4 py-3 border-t flex gap-3 ${idx===0 ? 'bg-green-50' : 'hover:bg-white'}">
              <div class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                ${idx===0 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}">
                v${h.version}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start">
                  <div class="text-xs font-semibold ${idx===0?'text-green-700':'text-gray-700'} truncate max-w-40">${h.file_name || doc.label}</div>
                  ${idx===0 ? `<span class="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-semibold ml-1 flex-shrink-0">Latest</span>` : ''}
                </div>
                <div class="text-xs text-gray-500 mt-0.5">${formatDateTime(h.uploaded_at)}</div>
                <div class="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <i class="fas fa-user"></i>${h.uploaded_by_name || 'Staff'}
                </div>
                ${h.remarks ? `<div class="text-xs text-gray-500 italic mt-1 flex gap-1"><i class="fas fa-comment text-gray-400 mt-0.5"></i><span>${h.remarks}</span></div>` : ''}
                ${h.file_data && h.file_data.startsWith('data:image') ? `
                <div class="mt-1.5">
                  <img src="${h.file_data}" class="h-14 rounded border cursor-pointer hover:opacity-90 transition"
                    onclick="viewDocumentImage('${h.file_name || doc.label}', '${h.file_data}')" title="Click to view"/>
                </div>` : h.file_name ? `
                <div class="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                  <i class="fas fa-paperclip text-gray-400"></i>${h.file_name}
                </div>` : ''}
              </div>
            </div>`).join('')}
          </div>
        </div>` : ''}
      </div>`
    }).join('')}
  </div>`
}

// Open full-size document image viewer
function viewDocumentImage(filename, dataUrl) {
  if (!dataUrl) return
  const overlay = document.createElement('div')
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer'
  overlay.onclick = () => overlay.remove()
  overlay.innerHTML = `
    <div class="text-white text-sm mb-3 font-semibold">${filename || 'Document'} — Click anywhere to close</div>
    <img src="${dataUrl}" class="max-w-full max-h-screen rounded-lg shadow-2xl" style="max-height:85vh;object-fit:contain" onclick="event.stopPropagation()"/>
    <button class="mt-4 px-4 py-2 bg-white text-gray-800 rounded-lg font-semibold text-sm hover:bg-gray-100" onclick="overlay.remove()">Close</button>
  `
  document.body.appendChild(overlay)
}

// Toggle doc history panel
function toggleDocHistory(id) {
  const el = document.getElementById(id)
  if (el) el.classList.toggle('hidden')
}

// ── KYC Upload (with dynamic doc-type select if no docType given) ──
function openKycUploadModal(entityType, entityId, docType, onSuccessCallback) {
  const allDocs = entityType === 'customer' ? KYC_OWNER_DOCS : KYC_TENANT_DOCS
  const docMeta = docType ? (allDocs.find(d => d.key === docType) || { label: docType, icon: 'fa-file', color: '#6b7280' }) : null

  showModal(`
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-lg font-bold flex items-center gap-2">
      ${docMeta ? `<i class="fas ${docMeta.icon}" style="color:${docMeta.color}"></i>` : '<i class="fas fa-cloud-upload-alt text-blue-600"></i>'}
      ${docMeta ? 'Upload – ' + docMeta.label : 'Upload Document'}
    </h2>
    <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-xl"></i></button>
  </div>

  <div class="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700 flex gap-2">
    <i class="fas fa-info-circle mt-0.5 flex-shrink-0"></i>
    <span>Each upload creates a new version. All previous versions are permanently preserved in history.</span>
  </div>

  ${!docType ? `
  <div class="mb-4">
    <label class="form-label">Document Type <span class="text-red-500">*</span></label>
    <div class="grid grid-cols-2 gap-2">
      ${allDocs.map(d => `
      <label class="cursor-pointer">
        <input type="radio" name="kycDocType" value="${d.key}" class="hidden peer"/>
        <div class="peer-checked:ring-2 peer-checked:bg-blue-50 border rounded-xl p-3 flex items-center gap-2 hover:bg-gray-50 transition"
          style="--checked-ring-color:${d.color}">
          <i class="fas ${d.icon} text-sm" style="color:${d.color}"></i>
          <span class="text-sm font-medium text-gray-700">${d.label}</span>
        </div>
      </label>`).join('')}
    </div>
  </div>` : `<input type="hidden" id="kycDocTypeFixed" value="${docType}"/>`}

  <div class="mb-4">
    <label class="form-label">Select File <span class="text-red-500">*</span></label>
    <input type="file" id="kycFile" accept="image/*,application/pdf" class="form-input"/>
  </div>

  <div id="kycPreviewCont" class="hidden mb-4 p-2 border rounded-xl bg-gray-50 text-center">
    <img id="kycPreview" class="max-h-52 rounded-lg mx-auto border shadow-sm"/>
    <div id="kycFileName" class="text-xs text-gray-500 mt-2"></div>
  </div>

  <div class="mb-4">
    <label class="form-label">Remarks (optional)</label>
    <input id="kycRemarks" class="form-input" placeholder="e.g. Original verified, renewal copy, etc."/>
  </div>

  <button onclick="submitKycFromModal('${entityType}',${entityId},'${docType || ''}','${onSuccessCallback || ''}')"
    class="btn-primary w-full py-3">
    <i class="fas fa-upload mr-2"></i>Upload Document
  </button>
  `)

  document.getElementById('kycFile')?.addEventListener('change', async (e) => {
    const f = e.target.files[0]
    if (!f) return
    document.getElementById('kycFileName').textContent = `${f.name} (${(f.size/1024).toFixed(1)} KB)`
    document.getElementById('kycPreviewCont').classList.remove('hidden')
    if (f.type.startsWith('image/')) {
      const data = await fileToBase64(f)
      document.getElementById('kycPreview').src = data
      document.getElementById('kycPreview').style.display = ''
    } else {
      document.getElementById('kycPreview').src = ''
      document.getElementById('kycPreview').style.display = 'none'
    }
  })
}

async function submitKycFromModal(entityType, entityId, fixedDocType, callbackName) {
  const file = document.getElementById('kycFile')?.files[0]
  if (!file) { toast('Please select a file', 'error'); return }

  let docType = (fixedDocType === 'null' || fixedDocType === '' || fixedDocType === 'undefined') ? '' : fixedDocType
  if (!docType) {
    const selected = document.querySelector('input[name="kycDocType"]:checked')
    if (!selected) { toast('Please select a document type', 'error'); return }
    docType = selected.value
  }
  if (!docType) {
    const fixed = document.getElementById('kycDocTypeFixed')
    docType = fixed?.value || ''
  }
  if (!docType) { toast('Document type not set', 'error'); return }

  const remarks = document.getElementById('kycRemarks')?.value?.trim() || ''
  const file_data = await fileToBase64(file)

  const btn = document.querySelector('.btn-primary[onclick*="submitKycFromModal"]')
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Uploading...' }

  const r = await api('POST', `/kyc/${entityType}/${entityId}`, {
    doc_type: docType, file_name: file.name, file_data, remarks
  })

  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-upload mr-2"></i>Upload Document' }

  if (r?.ok) {
    toast(r.data.message || 'Document uploaded successfully!', 'success')
    closeModal()
    if (callbackName === 'refreshManageKyc') {
      const s = window._kycManageData
      if (s) openManageKyc(s.ownerEntityType, s.ownerEntityId, s.ownerName, s.unitNo, s.tenantEntityType, s.tenantEntityId, s.tenantName)
    }
  } else {
    toast(r?.data?.error || 'Upload failed', 'error')
  }
}

async function submitKyc(entityType, entityId, docType) {
  await submitKycFromModal(entityType, entityId, docType, null)
}

// ── KYC Tracker (summary page) ────────────────────────────────
async function loadKycTracker(params = {}) {
  const r = await api('GET', '/kyc/tracker/summary')
  if (!r?.ok) return
  const { owners = [], tenants = [] } = r.data

  // Compute stats
  const ownerComplete = owners.filter(o => o.has_aadhar && o.has_pan && o.has_photo && o.has_sale_deed && o.has_maint_agr).length
  const tenantComplete = tenants.filter(t => t.has_contract && t.has_aadhar && t.has_pan && t.has_photo && t.has_police).length

  document.getElementById('pageContent').innerHTML = `
  <div class="flex flex-wrap justify-between items-center mb-6 gap-4">
    <h1 class="text-2xl font-bold text-gray-800"><i class="fas fa-id-card mr-2 text-blue-900"></i>KYC Tracker</h1>
    <div class="flex gap-3">
      <input type="text" id="kycSearch" placeholder="Search name, unit..." class="form-input w-56" oninput="filterKycTable('all', this.value)"/>
    </div>
  </div>

  <!-- Summary Stats -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    <div class="card p-4 text-center border-t-4 border-blue-500">
      <div class="text-2xl font-bold text-blue-700">${owners.length}</div>
      <div class="text-xs text-gray-500 mt-1">Total Owners</div>
    </div>
    <div class="card p-4 text-center border-t-4 border-green-500">
      <div class="text-2xl font-bold text-green-600">${ownerComplete}</div>
      <div class="text-xs text-gray-500 mt-1">Owner KYC Complete</div>
    </div>
    <div class="card p-4 text-center border-t-4 border-orange-400">
      <div class="text-2xl font-bold text-orange-500">${tenants.length}</div>
      <div class="text-xs text-gray-500 mt-1">Active Tenants</div>
    </div>
    <div class="card p-4 text-center border-t-4 border-purple-500">
      <div class="text-2xl font-bold text-purple-600">${tenantComplete}</div>
      <div class="text-xs text-gray-500 mt-1">Tenant KYC Complete</div>
    </div>
  </div>

  <!-- Tabs -->
  <div class="flex gap-2 mb-4 border-b">
    <button onclick="showKycTab('owners')" id="tab-owners"
      class="px-5 py-3 text-sm font-semibold border-b-2 -mb-px border-blue-600 text-blue-700">
      <i class="fas fa-user mr-1"></i>Owners (${owners.length})
    </button>
    <button onclick="showKycTab('tenants')" id="tab-tenants"
      class="px-5 py-3 text-sm font-semibold border-b-2 -mb-px border-transparent text-gray-500 hover:text-gray-700">
      <i class="fas fa-user-friends mr-1"></i>Tenants (${tenants.length})
    </button>
  </div>

  <!-- Owners Tab -->
  <div id="kycTabOwners" class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left font-semibold text-gray-600">Unit</th>
            <th class="px-4 py-3 text-left font-semibold text-gray-600">Owner</th>
            <th class="px-4 py-3 text-center font-semibold text-gray-600">Aadhar</th>
            <th class="px-4 py-3 text-center font-semibold text-gray-600">PAN</th>
            <th class="px-4 py-3 text-center font-semibold text-gray-600">Photo</th>
            <th class="px-4 py-3 text-center font-semibold text-gray-600">Sale Deed</th>
            <th class="px-4 py-3 text-center font-semibold text-gray-600">Maint. Agr.</th>
            <th class="px-4 py-3 text-center font-semibold text-gray-600">Completion</th>
            <th class="px-4 py-3 text-center font-semibold text-gray-600">Action</th>
          </tr>
        </thead>
        <tbody id="kycOwnersBody">
          ${owners.map(o => {
            const vals = [o.has_aadhar, o.has_pan, o.has_photo, o.has_sale_deed, o.has_maint_agr]
            const done = vals.filter(Boolean).length
            const pct = Math.round(done/5*100)
            return `<tr class="table-row border-t">
              <td class="px-4 py-2 font-bold text-blue-900 cursor-pointer hover:underline" onclick="showUnitDetail('${o.unit_no}')">Unit ${o.unit_no}</td>
              <td class="px-4 py-2 font-medium">${o.name}</td>
              ${vals.map(v => `<td class="px-4 py-2 text-center">${v
                ? '<i class="fas fa-check-circle text-green-500 text-base"></i>'
                : '<i class="fas fa-times-circle text-red-400 text-base"></i>'}</td>`).join('')}
              <td class="px-4 py-2">
                <div class="flex items-center gap-2">
                  <div class="flex-1 bg-gray-100 rounded-full h-2 min-w-12">
                    <div class="h-2 rounded-full transition-all ${pct===100?'bg-green-500':pct>=60?'bg-yellow-400':'bg-red-400'}" style="width:${pct}%"></div>
                  </div>
                  <span class="text-xs font-bold ${pct===100?'text-green-600':pct>=60?'text-yellow-600':'text-red-500'} w-8">${pct}%</span>
                </div>
              </td>
              <td class="px-4 py-2 text-center">
                <button onclick="navigateToManageKyc_owner(${o.id},'${o.name}','${o.unit_no}')"
                  class="btn-primary btn-sm"><i class="fas fa-edit mr-1"></i>Manage</button>
              </td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Tenants Tab -->
  <div id="kycTabTenants" class="card overflow-hidden hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left font-semibold text-gray-600">Unit</th>
            <th class="px-4 py-3 text-left font-semibold text-gray-600">Tenant</th>
            <th class="px-4 py-3 text-center font-semibold text-gray-600">Contract</th>
            <th class="px-4 py-3 text-center font-semibold text-gray-600">Aadhar</th>
            <th class="px-4 py-3 text-center font-semibold text-gray-600">PAN</th>
            <th class="px-4 py-3 text-center font-semibold text-gray-600">Photo</th>
            <th class="px-4 py-3 text-center font-semibold text-gray-600">Police Verif.</th>
            <th class="px-4 py-3 text-left font-semibold text-gray-600">Tenancy Expiry</th>
            <th class="px-4 py-3 text-center font-semibold text-gray-600">Completion</th>
            <th class="px-4 py-3 text-center font-semibold text-gray-600">Action</th>
          </tr>
        </thead>
        <tbody id="kycTenantsBody">
          ${tenants.map(t => {
            const vals = [t.has_contract, t.has_aadhar, t.has_pan, t.has_photo, t.has_police]
            const done = vals.filter(Boolean).length
            const pct = Math.round(done/5*100)
            const exp = t.tenancy_expiry
            const isExpired = exp && new Date(exp) < new Date()
            return `<tr class="table-row border-t">
              <td class="px-4 py-2 font-bold text-blue-900">Unit ${t.unit_no}</td>
              <td class="px-4 py-2 font-medium">${t.name}</td>
              ${vals.map(v => `<td class="px-4 py-2 text-center">${v
                ? '<i class="fas fa-check-circle text-green-500 text-base"></i>'
                : '<i class="fas fa-times-circle text-red-400 text-base"></i>'}</td>`).join('')}
              <td class="px-4 py-2 ${isExpired?'text-red-600 font-semibold':'text-gray-500'} text-xs">
                ${exp ? (isExpired ? '<i class="fas fa-exclamation-triangle mr-1 text-red-500"></i>' : '') + formatDate(exp) : '—'}
              </td>
              <td class="px-4 py-2">
                <div class="flex items-center gap-2">
                  <div class="flex-1 bg-gray-100 rounded-full h-2 min-w-12">
                    <div class="h-2 rounded-full ${pct===100?'bg-green-500':pct>=60?'bg-yellow-400':'bg-red-400'}" style="width:${pct}%"></div>
                  </div>
                  <span class="text-xs font-bold ${pct===100?'text-green-600':pct>=60?'text-yellow-600':'text-red-500'} w-8">${pct}%</span>
                </div>
              </td>
              <td class="px-4 py-2 text-center">
                <button onclick="navigateToManageKyc_tenant(${t.id},'${t.name}','${t.unit_no}')"
                  class="btn-secondary btn-sm"><i class="fas fa-edit mr-1"></i>Manage</button>
              </td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`

  // Default: show first tab as active
  showKycTab('owners')
}

// Navigate from KYC Tracker → Manage KYC for a specific owner
async function navigateToManageKyc_owner(customerId, ownerName, unitNo) {
  window._kycManageActiveTab = 'owner'
  // Load unit to check for tenant
  const unitR = await api('GET', `/units/${unitNo}`)
  const tenant = unitR?.data?.tenant
  await openManageKyc('customer', customerId, ownerName, unitNo,
    tenant ? 'tenant' : null,
    tenant?.id || null,
    tenant?.name || null
  )
}

// Navigate from KYC Tracker → Manage KYC opening on the Tenant tab
async function navigateToManageKyc_tenant(tenantId, tenantName, unitNo) {
  window._kycManageActiveTab = 'tenant'
  // Load unit to get owner info
  const unitR = await api('GET', `/units/${unitNo}`)
  const owner = unitR?.data?.owner
  await openManageKyc(
    'customer', owner?.id, owner?.name || 'Owner', unitNo,
    'tenant', tenantId, tenantName
  )
}

function showKycTab(tab) {
  document.getElementById('kycTabOwners')?.classList.toggle('hidden', tab !== 'owners')
  document.getElementById('kycTabTenants')?.classList.toggle('hidden', tab !== 'tenants')
  const o = document.getElementById('tab-owners')
  const t = document.getElementById('tab-tenants')
  if (o) o.className = `px-5 py-3 text-sm font-semibold border-b-2 -mb-px ${tab==='owners' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`
  if (t) t.className = `px-5 py-3 text-sm font-semibold border-b-2 -mb-px ${tab==='tenants' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`
}

function filterKycTable(type, val) {
  const lv = val.toLowerCase()
  ;['kycOwnersBody', 'kycTenantsBody'].forEach(id => {
    const tbody = document.getElementById(id)
    if (!tbody) return
    tbody.querySelectorAll('tr').forEach(row => {
      row.style.display = !val || row.textContent.toLowerCase().includes(lv) ? '' : 'none'
    })
  })
}

// ── Employees ─────────────────────────────────────────────────
async function loadEmployees() {
  const r = await api('GET', '/employees')
  if (!r?.ok) return
  const employees = r.data.employees || []

  document.getElementById('pageContent').innerHTML = `
  <div class="page-header">
    <div class="page-title">
      <div class="page-title-icon"><i class="fas fa-user-tie"></i></div>
      <div>
        <div>Employee Management</div>
        <div class="page-subtitle">${employees.length} staff member(s)</div>
      </div>
    </div>
    ${currentUser.role === 'admin' ? `<button onclick="showAddEmployee()" class="btn-primary"><i class="fas fa-plus"></i>Add Employee</button>` : ''}
  </div>
  <div class="card overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left font-semibold">Name</th>
            <th class="px-4 py-3 text-left font-semibold">Email</th>
            <th class="px-4 py-3 text-left font-semibold hidden md:table-cell">Department</th>
            <th class="px-4 py-3 text-left font-semibold">Role</th>
            <th class="px-4 py-3 text-left font-semibold hidden md:table-cell">Status</th>
            <th class="px-4 py-3 text-left font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${employees.map(e => `<tr class="table-row border-t">
            <td class="px-4 py-3">
              <div class="font-medium">${e.name}</div>
              <div class="text-xs text-gray-400">${e.mobile || ''}</div>
            </td>
            <td class="px-4 py-3 text-gray-500">${e.email}</td>
            <td class="px-4 py-3 text-gray-500 hidden md:table-cell">${e.department || '—'}</td>
            <td class="px-4 py-3">${roleBadge(e.role)}</td>
            <td class="px-4 py-3 hidden md:table-cell">
              <span class="${e.is_active ? 'text-green-600' : 'text-red-500'} text-xs font-semibold">
                ${e.is_active ? '● Active' : '● Inactive'}
              </span>
            </td>
            <td class="px-4 py-3 flex gap-2">
              <button onclick="showEmpDetails(${e.id})" class="text-blue-600"><i class="fas fa-eye"></i></button>
              ${currentUser.role === 'admin' ? `
              <button onclick="showEditEmployee(${e.id})" class="text-yellow-600"><i class="fas fa-edit"></i></button>
              <button onclick="showResetEmpPwd(${e.id})" class="text-purple-600"><i class="fas fa-key"></i></button>
              ` : ''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`
}

async function showEmpDetails(id) {
  const r = await api('GET', `/employees/${id}`)
  if (!r?.ok) return
  const { employee: e, assigned_complaints = [] } = r.data
  showModal(`
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-xl font-bold">${e.name}</h2>
    <button onclick="closeModal()" class="text-gray-400"><i class="fas fa-times"></i></button>
  </div>
  <div class="grid md:grid-cols-2 gap-4 mb-4">
    <div class="bg-blue-50 rounded-xl p-4 text-sm space-y-2">
      ${roleBadge(e.role)}
      <div class="mt-2"><i class="fas fa-envelope mr-2 text-blue-400"></i>${e.email}</div>
      <div><i class="fas fa-phone mr-2 text-blue-400"></i>${e.mobile || '—'}</div>
      <div><i class="fas fa-building mr-2 text-blue-400"></i>${e.department || '—'}</div>
      <div class="${e.is_active ? 'text-green-600' : 'text-red-500'} font-semibold">${e.is_active ? '● Active' : '● Inactive'}</div>
    </div>
    <div>
      <div class="font-bold text-sm mb-2">Active Assignments (${assigned_complaints.length})</div>
      ${assigned_complaints.length ? assigned_complaints.slice(0,5).map(c => `
      <div class="text-xs p-2 bg-gray-50 rounded mb-1 flex justify-between">
        <span>${c.complaint_no} – Unit ${c.unit_no}</span>${statusBadge(c.status)}
      </div>`).join('') : '<p class="text-gray-400 text-sm">No active assignments</p>'}
    </div>
  </div>
  `)
}

async function showAddEmployee() {
  showModal(`
  <div class="modal-header">
    <div class="modal-title"><i class="fas fa-user-plus" style="color:#E8431A;margin-right:8px;"></i>Add Employee</div>
    <button onclick="closeModal()" class="modal-close"><i class="fas fa-times"></i></button>
  </div>
  <div class="modal-body">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div><label class="form-label">Full Name *</label><input id="empName" class="form-input" placeholder="Employee name"/></div>
      <div><label class="form-label">Email *</label><input id="empEmail" type="email" class="form-input" placeholder="email@company.com"/></div>
      <div><label class="form-label">Mobile</label><input id="empMobile" class="form-input" placeholder="Mobile number"/></div>
      <div><label class="form-label">Role *</label>
        <select id="empRole" class="form-input">
          <option value="employee">Employee</option>
          <option value="sub_admin">Sub Admin</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div><label class="form-label">Department</label><input id="empDept" class="form-input" placeholder="e.g. Electrical, Plumbing"/></div>
      <div><label class="form-label">Initial Password</label><input id="empPwd" type="password" class="form-input" value="Emp@123"/></div>
    </div>
  </div>
  <div class="modal-footer">
    <button onclick="closeModal()" class="btn-ghost">Cancel</button>
    <button onclick="addEmployee()" class="btn-primary"><i class="fas fa-plus"></i>Add Employee</button>
  </div>`)
}

async function addEmployee() {
  const data = {
    name: document.getElementById('empName').value.trim(),
    email: document.getElementById('empEmail').value.trim(),
    mobile: document.getElementById('empMobile').value.trim(),
    role: document.getElementById('empRole').value,
    department: document.getElementById('empDept').value.trim(),
    password: document.getElementById('empPwd').value,
  }
  if (!data.name || !data.email) { toast('Name and email required', 'error'); return }
  const r = await api('POST', '/employees', data)
  if (r?.ok) { toast('Employee added!', 'success'); closeModal(); navigate('employees') }
  else toast(r?.data?.error || 'Failed', 'error')
}

async function showEditEmployee(id) {
  const r = await api('GET', `/employees/${id}`)
  if (!r?.ok) return
  const e = r.data.employee
  showModal(`
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-xl font-bold">Edit Employee</h2>
    <button onclick="closeModal()" class="text-gray-400"><i class="fas fa-times"></i></button>
  </div>
  <div class="grid md:grid-cols-2 gap-4">
    <div><label class="form-label">Full Name</label><input id="eeName" class="form-input" value="${e.name}"/></div>
    <div><label class="form-label">Email</label><input id="eeEmail" type="email" class="form-input" value="${e.email}"/></div>
    <div><label class="form-label">Mobile</label><input id="eeMobile" class="form-input" value="${e.mobile||''}"/></div>
    <div><label class="form-label">Role</label>
      <select id="eeRole" class="form-input">
        <option ${e.role==='employee'?'selected':''} value="employee">Employee</option>
        <option ${e.role==='sub_admin'?'selected':''} value="sub_admin">Sub Admin</option>
        <option ${e.role==='admin'?'selected':''} value="admin">Admin</option>
      </select>
    </div>
    <div><label class="form-label">Department</label><input id="eeDept" class="form-input" value="${e.department||''}"/></div>
    <div><label class="form-label">Status</label>
      <select id="eeActive" class="form-input">
        <option value="1" ${e.is_active?'selected':''}>Active</option>
        <option value="0" ${!e.is_active?'selected':''}>Inactive</option>
      </select>
    </div>
  </div>
  <button onclick="updateEmployee(${e.id})" class="btn-primary w-full mt-4">Update Employee</button>
  `)
}

async function updateEmployee(id) {
  const data = {
    name: document.getElementById('eeName').value.trim(),
    email: document.getElementById('eeEmail').value.trim(),
    mobile: document.getElementById('eeMobile').value.trim(),
    role: document.getElementById('eeRole').value,
    department: document.getElementById('eeDept').value.trim(),
    is_active: parseInt(document.getElementById('eeActive').value),
  }
  const r = await api('PUT', `/employees/${id}`, data)
  if (r?.ok) { toast('Updated!', 'success'); closeModal(); navigate('employees') }
  else toast(r?.data?.error || 'Failed', 'error')
}

function showResetEmpPwd(id) {
  showModal(`
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-lg font-bold">Reset Password</h2>
    <button onclick="closeModal()" class="text-gray-400"><i class="fas fa-times"></i></button>
  </div>
  <label class="form-label">New Password</label>
  <input id="newPwd" type="password" class="form-input mb-4" value="Emp@123"/>
  <button onclick="resetEmpPwd(${id})" class="btn-primary w-full">Reset Password</button>
  `)
}

async function resetEmpPwd(id) {
  const new_password = document.getElementById('newPwd').value
  const r = await api('POST', `/employees/${id}/reset-password`, { new_password })
  if (r?.ok) { toast('Password reset!', 'success'); closeModal() }
  else toast(r?.data?.error || 'Failed', 'error')
}

// ── Audit Trail ───────────────────────────────────────────────
async function loadAudit() {
  const r = await api('GET', '/complaints?limit=200')
  const compR = r?.data?.complaints || []

  // Simulate audit loading with complaint data
  document.getElementById('pageContent').innerHTML = `
  <h1 class="text-2xl font-bold text-gray-800 mb-6"><i class="fas fa-history mr-2 text-blue-900"></i>Audit Trail</h1>
  <div class="card p-6">
    <p class="text-gray-600 mb-4">View complete audit logs by opening any complaint and scrolling to the Activity Timeline.</p>
    <div class="grid md:grid-cols-3 gap-4">
      <div class="p-4 bg-blue-50 rounded-xl text-center">
        <div class="text-3xl font-bold text-blue-700">${compR.length}</div>
        <div class="text-sm text-blue-600 mt-1">Total Complaints Tracked</div>
      </div>
      <div class="p-4 bg-green-50 rounded-xl text-center">
        <div class="text-3xl font-bold text-green-700">${compR.filter(c=>c.status==='Resolved'||c.status==='Closed').length}</div>
        <div class="text-sm text-green-600 mt-1">Resolved/Closed</div>
      </div>
      <div class="p-4 bg-orange-50 rounded-xl text-center">
        <div class="text-3xl font-bold text-orange-700">${compR.filter(c=>c.status==='Open').length}</div>
        <div class="text-sm text-orange-600 mt-1">Pending Action</div>
      </div>
    </div>
    <div class="mt-6">
      <h3 class="font-bold text-gray-700 mb-3">Recent Activity</h3>
      <div class="space-y-2">
        ${compR.slice(0,15).map(c => `<div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <div class="w-2 h-2 rounded-full ${c.status==='Open'?'bg-yellow-400':c.status==='Resolved'?'bg-green-400':c.status==='Assigned'?'bg-blue-400':'bg-gray-400'}"></div>
          <div class="flex-1">
            <div class="text-sm font-medium">${c.complaint_no} – Unit ${c.unit_no} · ${c.category_name}</div>
            <div class="text-xs text-gray-400">${c.customer_name || 'Staff'} · ${formatDateTime(c.created_at)}</div>
          </div>
          ${statusBadge(c.status)}
          <button onclick="showComplaintDetail(${c.id})" class="text-blue-600 text-xs">View</button>
        </div>`).join('')}
      </div>
    </div>
  </div>`
}

// ══════════════════════════════════════════════════════════════
// ── EMPLOYEE CALENDAR ────────────────────────────────────────
// ══════════════════════════════════════════════════════════════
let calView = 'month'
let calYear = new Date().getFullYear()
let calMonth = new Date().getMonth() + 1
let calWeekStart = ''
let calData = { visits: [], leaves: [], summary: {} }

async function loadCalendar(params = {}) {
  const content = document.getElementById('pageContent')
  calView = params.view || calView || 'month'
  calYear = params.year || calYear || new Date().getFullYear()
  calMonth = params.month || calMonth || (new Date().getMonth() + 1)

  content.innerHTML = `<div class="loading"><div class="spinner"></div></div>`

  if (calView === 'week' && !calWeekStart) {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    calWeekStart = new Date(new Date().setDate(diff)).toISOString().split('T')[0]
  }

  const qs = new URLSearchParams({ view: calView, year: calYear, month: calMonth })
  if (calView === 'week' && calWeekStart) qs.set('week_start', calWeekStart)

  const r = await api('GET', `/calendar?${qs}`)
  if (!r?.ok) { content.innerHTML = `<p class="text-red-500 p-6">Failed to load calendar data</p>`; return }
  calData = r.data
  renderCalendar(content)
}

function renderCalendar(content) {
  const { visits = [], leaves = [], summary = {} } = calData
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const visitsByDate = {}
  visits.forEach(v => { if (!visitsByDate[v.visit_date]) visitsByDate[v.visit_date] = []; visitsByDate[v.visit_date].push(v) })
  const leaveDates = new Set(leaves.map(l => l.leave_date))

  content.innerHTML = `
  <div style="display:flex;flex-direction:column;gap:18px;">
    <!-- Header -->
    <div class="page-header">
      <div class="page-title">
        <div class="page-title-icon"><i class="fas fa-calendar-alt"></i></div>
        <div>
          <div>My Visit Calendar</div>
          <div class="page-subtitle">Scheduled complaint visits assigned to you</div>
        </div>
      </div>
      <div class="page-actions">
        <button onclick="showApplyLeaveModal()" class="btn-outline"><i class="fas fa-umbrella-beach"></i>Apply Leave</button>
        <button onclick="navigate('leave-mgmt')" class="btn-ghost"><i class="fas fa-list"></i>All Leaves</button>
      </div>
    </div>

    <!-- Summary tiles -->
    <div class="grid-4" style="gap:12px;">
      ${[['Total Visits',summary.total||0,'sc-flame','fa-calendar-check'],['Today',summary.today||0,'sc-green','fa-sun'],['Upcoming',summary.upcoming||0,'sc-blue','fa-calendar-plus'],['Overdue',summary.overdue||0,'sc-rose','fa-exclamation-triangle']].map(([lbl,val,cls,ic])=>`
      <div class="stat-card ${cls}">
        <i class="fas ${ic} stat-icon"></i>
        <div class="stat-number">${val}</div>
        <div class="stat-label">${lbl}</div>
      </div>`).join('')}
    </div>

    <!-- Controls -->
    <div class="card" style="padding:14px 18px;">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
        <div class="tab-group">
          ${['month','week','today','all'].map(v => `<button onclick="switchCalView('${v}')" class="tab-pill${calView===v?' active':''}">${v.charAt(0).toUpperCase()+v.slice(1)}</button>`).join('')}
        </div>
        ${calView==='month'?`<div style="display:flex;align-items:center;gap:8px;">
          <button onclick="calNavMonth(-1)" class="btn-icon btn-icon-ghost"><i class="fas fa-chevron-left" style="font-size:11px;"></i></button>
          <span style="font-weight:700;color:#374151;min-width:140px;text-align:center;">${monthNames[calMonth-1]} ${calYear}</span>
          <button onclick="calNavMonth(1)" class="btn-icon btn-icon-ghost"><i class="fas fa-chevron-right" style="font-size:11px;"></i></button>
        </div>`:''}
        ${calView==='week'?`<div style="display:flex;align-items:center;gap:8px;">
          <button onclick="calNavWeek(-1)" class="btn-icon btn-icon-ghost"><i class="fas fa-chevron-left" style="font-size:11px;"></i></button>
          <span style="font-weight:700;color:#374151;">Week of ${formatDate(calWeekStart)}</span>
          <button onclick="calNavWeek(1)" class="btn-icon btn-icon-ghost"><i class="fas fa-chevron-right" style="font-size:11px;"></i></button>
        </div>`:''}
      </div>
      <div style="display:flex;gap:16px;margin-top:10px;font-size:11.5px;color:#6B7280;">
        <span style="display:flex;align-items:center;gap:5px;"><span style="width:12px;height:12px;background:#DBEAFE;border-radius:3px;display:inline-block;"></span>Scheduled Visit</span>
        <span style="display:flex;align-items:center;gap:5px;"><span style="width:12px;height:12px;background:#FEE2E2;border-radius:3px;display:inline-block;"></span>Leave Day</span>
        <span style="display:flex;align-items:center;gap:5px;"><span style="width:12px;height:12px;background:#FEF3C7;border:2px solid #E8431A;border-radius:3px;display:inline-block;"></span>Today</span>
      </div>
    </div>
    <div class="card p-4">
      ${calView==='month' ? renderMonthGrid(visitsByDate, leaveDates) : renderVisitList(visits, leaveDates)}
    </div>
  </div>`
}

function renderMonthGrid(visitsByDate, leaveDates) {
  const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const today = new Date().toISOString().split('T')[0]
  const firstDay = new Date(calYear, calMonth-1, 1)
  const lastDay  = new Date(calYear, calMonth, 0)
  let startDow = firstDay.getDay()
  startDow = startDow === 0 ? 6 : startDow - 1
  const totalDays = lastDay.getDate()
  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)

  let html = `<div class="grid grid-cols-7 gap-1">`
  dayNames.forEach(d => { html += `<div class="text-center text-xs font-bold text-gray-400 py-2">${d}</div>` })
  cells.forEach(day => {
    if (!day) { html += `<div class="h-24 bg-gray-50 rounded"></div>`; return }
    const dateStr = `${calYear}-${calMonth.toString().padStart(2,'0')}-${day.toString().padStart(2,'0')}`
    const isToday = dateStr === today
    const isLeave = leaveDates.has(dateStr)
    const dayVisits = visitsByDate[dateStr] || []
    html += `<div class="h-24 rounded-lg border p-1 cursor-pointer hover:border-blue-300 transition-all overflow-hidden ${isToday?'bg-yellow-50 border-yellow-400':isLeave?'bg-red-50 border-red-200':'bg-white border-gray-100'}" onclick="showDayDetail('${dateStr}')">
      <div class="text-xs font-bold ${isToday?'text-yellow-700':'text-gray-700'} mb-1">${day}${isLeave?' <i class="fas fa-umbrella-beach text-red-400 text-xs"></i>':''}</div>
      ${dayVisits.slice(0,3).map(v => `<div class="text-xs bg-blue-100 text-blue-800 rounded px-1 mb-0.5 truncate">${v.visit_time?v.visit_time.substring(0,5)+' ':''} ${v.unit_no}</div>`).join('')}
      ${dayVisits.length>3?`<div class="text-xs text-gray-400">+${dayVisits.length-3} more</div>`:''}
    </div>`
  })
  html += `</div>`
  return html
}

function renderVisitList(visits, leaveDates) {
  if (!visits.length) return `<div class="text-center py-12 text-gray-400"><i class="fas fa-calendar-check text-4xl mb-3"></i><p>No visits scheduled for this period</p></div>`
  return `<div class="overflow-x-auto"><table class="w-full text-sm">
    <thead><tr class="text-left text-xs text-gray-500 border-b">
      <th class="py-2 pr-4">Date &amp; Time</th><th class="py-2 pr-4">Complaint</th><th class="py-2 pr-4">Unit</th>
      <th class="py-2 pr-4">Category</th><th class="py-2 pr-4">Resident</th><th class="py-2 pr-4">Priority</th><th class="py-2">Status</th>
    </tr></thead>
    <tbody class="divide-y">
      ${visits.map(v => `<tr class="hover:bg-gray-50 ${leaveDates.has(v.visit_date)?'bg-red-50':''}">
        <td class="py-2 pr-4 whitespace-nowrap"><div class="font-medium">${formatDate(v.visit_date)}</div><div class="text-xs text-gray-400">${v.visit_time||'Time TBD'}</div></td>
        <td class="py-2 pr-4"><button onclick="showComplaintDetail(${v.id})" class="text-blue-600 hover:underline font-mono text-xs">${v.complaint_no}</button></td>
        <td class="py-2 pr-4 font-medium">${v.unit_no}</td>
        <td class="py-2 pr-4"><div class="text-xs">${v.category_name}</div>${v.sub_category_name?`<div class="text-xs text-gray-400">${v.sub_category_name}</div>`:''}</td>
        <td class="py-2 pr-4 text-xs">${v.customer_name||'—'}</td>
        <td class="py-2 pr-4"><span class="${priorityColor(v.priority)} font-semibold text-xs">${v.priority}</span></td>
        <td class="py-2">${statusBadge(v.status)}</td>
      </tr>`).join('')}
    </tbody></table></div>`
}

function switchCalView(v) {
  calView = v
  if (v === 'today') { const now = new Date(); calYear = now.getFullYear(); calMonth = now.getMonth()+1 }
  loadCalendar()
}
function calNavMonth(dir) {
  calMonth += dir
  if (calMonth > 12) { calMonth = 1; calYear++ }
  if (calMonth < 1)  { calMonth = 12; calYear-- }
  loadCalendar()
}
function calNavWeek(dir) {
  const d = new Date(calWeekStart); d.setDate(d.getDate() + dir*7)
  calWeekStart = d.toISOString().split('T')[0]
  loadCalendar()
}

function showDayDetail(dateStr) {
  const visits = calData.visits.filter(v => v.visit_date === dateStr)
  const isLeave = calData.leaves.some(l => l.leave_date === dateStr)
  showModal(`<div class="p-4">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-bold text-gray-800"><i class="fas fa-calendar-day mr-2 text-blue-600"></i>${formatDate(dateStr)}</h3>
      <button onclick="closeModal()" class="text-gray-400 hover:text-gray-700"><i class="fas fa-times"></i></button>
    </div>
    ${isLeave?`<div class="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><i class="fas fa-umbrella-beach mr-2"></i>Approved Leave Day</div>`:''}
    ${!visits.length?`<p class="text-gray-400 text-center py-4">No visits scheduled</p>`:`
    <div class="space-y-2">
      ${visits.map(v=>`<div class="p-3 border rounded-lg hover:bg-gray-50">
        <div class="flex items-center justify-between">
          <span class="font-mono text-xs text-blue-600">${v.complaint_no}</span>
          ${statusBadge(v.status)}
        </div>
        <div class="text-sm font-medium mt-1">Unit ${v.unit_no} – ${v.category_name}</div>
        ${v.sub_category_name?`<div class="text-xs text-gray-500">${v.sub_category_name}</div>`:''}
        <div class="text-xs text-gray-400 mt-1">${v.customer_name||''} ${v.visit_time?' · '+v.visit_time:''}</div>
        <button onclick="closeModal();showComplaintDetail(${v.id})" class="mt-2 text-xs text-blue-600 hover:underline">View Complaint →</button>
      </div>`).join('')}
    </div>`}
  </div>`)
}

function showApplyLeaveModal() {
  const today = new Date().toISOString().split('T')[0]
  showModal(`
  <div class="modal-header">
    <div class="modal-title"><i class="fas fa-umbrella-beach" style="color:#F59E0B;margin-right:8px;"></i>Apply for Leave</div>
    <button onclick="closeModal()" class="modal-close"><i class="fas fa-times"></i></button>
  </div>
  <div class="modal-body">
    <div style="display:grid;gap:14px;">
      <div><label class="form-label">Leave Date *</label>
        <input type="date" id="leaveDate" class="form-input" min="${today}" required/></div>
      <div><label class="form-label">Leave Type</label>
        <select id="leaveType" class="form-input">
          <option value="Full Day">Full Day</option>
          <option value="Half Day AM">Half Day &ndash; Morning</option>
          <option value="Half Day PM">Half Day &ndash; Afternoon</option>
        </select></div>
      <div><label class="form-label">Reason <span style="color:#9CA3AF;font-weight:400;">(optional)</span></label>
        <textarea id="leaveReason" class="form-input" rows="3" placeholder="Reason for leave..."></textarea></div>
    </div>
  </div>
  <div class="modal-footer">
    <button onclick="closeModal()" class="btn-ghost">Cancel</button>
    <button onclick="submitLeaveApplication()" class="btn-primary"><i class="fas fa-paper-plane"></i>Submit Application</button>
  </div>`)
}

async function submitLeaveApplication() {
  const leave_date = document.getElementById('leaveDate').value
  const leave_type = document.getElementById('leaveType').value
  const reason     = document.getElementById('leaveReason').value
  if (!leave_date) { toast('Please select a leave date', 'error'); return }
  const r = await api('POST', '/calendar/leaves', { leave_date, leave_type, reason })
  if (r?.ok) { toast('Leave application submitted!', 'success'); closeModal(); loadLeaveManagement() }
  else toast(r?.data?.error || 'Failed to submit leave', 'error')
}

// ══════════════════════════════════════════════════════════════
// ── LEAVE MANAGEMENT ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════════
async function loadLeaveManagement() {
  const content = document.getElementById('pageContent')
  content.innerHTML = `<div class="loading"><div class="spinner"></div></div>`
  const isManager = ['admin','sub_admin'].includes(currentUser.role)
  const r = await api('GET', `/calendar/leaves`)
  if (!r?.ok) { content.innerHTML = `<p class="text-red-500 p-6">Failed to load leaves</p>`; return }
  const { leaves = [], pendingCount = 0 } = r.data

  content.innerHTML = `
  <div style="display:flex;flex-direction:column;gap:18px;">
    <div class="page-header">
      <div class="page-title">
        <div class="page-title-icon"><i class="fas fa-umbrella-beach"></i></div>
        <div>
          <div>Leave Management</div>
          <div class="page-subtitle">${isManager ? 'Review and approve employee leave requests' : 'Your leave applications'}</div>
        </div>
      </div>
      <div class="page-actions">
        ${isManager && pendingCount > 0 ? `<span style="background:#FFF7ED;color:#C2410C;border:1px solid #FED7AA;border-radius:20px;padding:5px 12px;font-size:12px;font-weight:700;">${pendingCount} Pending</span>` : ''}
        ${!isManager ? `<button onclick="showApplyLeaveModal()" class="btn-primary"><i class="fas fa-plus"></i>Apply Leave</button>` : ''}
      </div>
    </div>
    <div class="card" style="padding:14px 18px;">
      <div class="tab-group" style="display:inline-flex;">
        ${['All','Pending','Approved','Rejected'].map(s => `<button onclick="filterLeaves('${s}')" id="leaveTab${s}" class="tab-pill${s==='All'?' active':''}">${s}</button>`).join('')}
      </div>
    </div>
    <div class="card">
      <div id="leaveTableContainer" style="padding:4px 0;">${renderLeaveTable(leaves, isManager)}</div>
    </div>
  </div>`
  window._allLeaves = leaves
}

function renderLeaveTable(leaves, isManager) {
  if (!leaves.length) return `<div class="text-center py-8 text-gray-400"><i class="fas fa-calendar-times text-3xl mb-2"></i><p>No leave records found</p></div>`
  return `<div class="overflow-x-auto"><table class="w-full text-sm">
    <thead><tr class="text-left text-xs text-gray-500 border-b">
      ${isManager?'<th class="py-2 pr-4">Employee</th>':''}
      <th class="py-2 pr-4">Leave Date</th><th class="py-2 pr-4">Type</th><th class="py-2 pr-4">Reason</th>
      <th class="py-2 pr-4">Status</th><th class="py-2 pr-4">Applied On</th><th class="py-2">Actions</th>
    </tr></thead>
    <tbody class="divide-y">
      ${leaves.map(l=>`<tr class="hover:bg-gray-50">
        ${isManager?`<td class="py-2 pr-4 font-medium">${l.employee_name}<div class="text-xs text-gray-400">${l.department||''}</div></td>`:''}
        <td class="py-2 pr-4 whitespace-nowrap font-medium">${formatDate(l.leave_date)}</td>
        <td class="py-2 pr-4 text-xs">${l.leave_type}</td>
        <td class="py-2 pr-4 text-xs text-gray-600 max-w-xs">${l.reason||'—'}</td>
        <td class="py-2 pr-4">${leaveStatusBadge(l.status)}</td>
        <td class="py-2 pr-4 text-xs text-gray-400">${formatDate(l.applied_at)}</td>
        <td class="py-2">
          ${isManager&&l.status==='Pending'?`
            <button onclick="reviewLeave(${l.id},'approve')" class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded mr-1 hover:bg-green-200"><i class="fas fa-check mr-1"></i>Approve</button>
            <button onclick="reviewLeave(${l.id},'reject')" class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"><i class="fas fa-times mr-1"></i>Reject</button>`:''}
          ${!isManager&&l.status==='Pending'?`<button onclick="cancelLeave(${l.id})" class="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"><i class="fas fa-trash mr-1"></i>Cancel</button>`:''}
          ${l.review_remarks?`<div class="text-xs text-gray-400 mt-1">Note: ${l.review_remarks.substring(0,40)}</div>`:''}
        </td>
      </tr>`).join('')}
    </tbody></table></div>`
}

function leaveStatusBadge(status) {
  const map = { Pending:'bg-yellow-100 text-yellow-800', Approved:'bg-green-100 text-green-800', Rejected:'bg-red-100 text-red-800' }
  return `<span class="${map[status]||'bg-gray-100 text-gray-600'} px-2 py-0.5 rounded-full text-xs font-semibold">${status}</span>`
}

function filterLeaves(status) {
  ['All','Pending','Approved','Rejected'].forEach(s => {
    const btn = document.getElementById('leaveTab'+s)
    if (btn) { btn.className = 'tab-pill' + (s===status?' active':'') }
  })
  const isManager = ['admin','sub_admin'].includes(currentUser.role)
  const filtered = status==='All' ? window._allLeaves : (window._allLeaves||[]).filter(l=>l.status===status)
  document.getElementById('leaveTableContainer').innerHTML = renderLeaveTable(filtered, isManager)
}

async function reviewLeave(id, action) {
  const remarks = action==='reject' ? (prompt('Reason for rejection (optional):') || '') : ''
  const r = await api('POST', `/calendar/leaves/${id}/${action}`, { remarks })
  if (r?.ok) { toast(action==='approve'?'Leave approved!':'Leave rejected', 'success'); loadLeaveManagement() }
  else toast(r?.data?.error||'Action failed', 'error')
}

async function cancelLeave(id) {
  if (!confirm('Cancel this leave application?')) return
  const r = await api('DELETE', `/calendar/leaves/${id}`, null)
  if (r?.ok) { toast('Leave cancelled', 'success'); loadLeaveManagement() }
  else toast(r?.data?.error||'Failed to cancel', 'error')
}

// ══════════════════════════════════════════════════════════════
// ── VEHICLES ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════
async function loadVehicles() {
  const content = document.getElementById('pageContent')
  content.innerHTML = `<div class="loading"><div class="spinner"></div></div>`
  const r = await api('GET', '/vehicles')
  if (!r?.ok) { content.innerHTML = `<p class="text-red-500 p-6">Failed to load vehicles</p>`; return }
  const { vehicles = [] } = r.data

  content.innerHTML = `
  <div style="display:flex;flex-direction:column;gap:18px;">
    <div class="page-header">
      <div class="page-title">
        <div class="page-title-icon"><i class="fas fa-car"></i></div>
        <div>
          <div>Vehicle Registry</div>
          <div class="page-subtitle">${vehicles.length} vehicle(s) registered across all units</div>
        </div>
      </div>
      <button onclick="showAddVehicleModal()" class="btn-primary"><i class="fas fa-plus"></i>Register Vehicle</button>
    </div>
    <div class="card" style="padding:14px 18px;">
      <div style="position:relative;">
        <i class="fas fa-search" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#C4B5B0;font-size:13px;"></i>
        <input type="text" id="vehicleSearch" placeholder="Search by vehicle number, unit, owner or make..."
          class="form-input" style="padding-left:36px;" oninput="filterVehicles(this.value)"/>
      </div>
    </div>
    <div id="vehicleList" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;">
      ${renderVehicleCards(vehicles)}
    </div>
  </div>`
  window._allVehicles = vehicles
}

function renderVehicleCards(vehicles) {
  if (!vehicles.length) return `<div class="empty-state" style="grid-column:1/-1;"><i class="fas fa-car"></i><p>No vehicles registered yet</p></div>`
  const typeIcons = { Car:'fa-car', Bike:'fa-motorcycle', Scooter:'fa-motorcycle', Truck:'fa-truck', Other:'fa-car-side' }
  const typeColors = { Car:'#2563EB', Bike:'#7C3AED', Scooter:'#7C3AED', Truck:'#D97706', Other:'#059669' }
  return vehicles.map(v => `
    <div class="item-card" style="padding:16px;">
      <!-- Header -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:42px;height:42px;border-radius:10px;background:${typeColors[v.vehicle_type]||'#2563EB'}15;display:flex;align-items:center;justify-content:center;border:1.5px solid ${typeColors[v.vehicle_type]||'#2563EB'}30;">
            <i class="fas ${typeIcons[v.vehicle_type]||'fa-car'}" style="color:${typeColors[v.vehicle_type]||'#2563EB'};font-size:16px;"></i>
          </div>
          <div>
            <div style="font-weight:800;font-size:15px;letter-spacing:0.05em;color:#111827;font-family:monospace;">${v.vehicle_number}</div>
            <div style="font-size:11.5px;color:#9CA3AF;margin-top:2px;">${v.vehicle_type}${v.make?' &bull; '+v.make:''} ${v.model||''}</div>
          </div>
        </div>
        <div style="display:flex;gap:4px;">
          <button onclick="showVehicleDetail(${v.id})" class="btn-icon" style="color:#2563EB;background:#EFF6FF;border:1px solid #DBEAFE;" title="View"><i class="fas fa-eye" style="font-size:12px;"></i></button>
          <button onclick="showEditVehicle(${v.id})" class="btn-icon" style="color:#059669;background:#ECFDF5;border:1px solid #D1FAE5;" title="Edit"><i class="fas fa-edit" style="font-size:12px;"></i></button>
          <button onclick="removeVehicle(${v.id})" class="btn-icon" style="color:#DC2626;background:#FEF2F2;border:1px solid #FECACA;" title="Remove"><i class="fas fa-trash" style="font-size:12px;"></i></button>
        </div>
      </div>
      <!-- Details grid -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;border-top:1px solid #F3F4F6;padding-top:12px;">
        <div><span style="color:#9CA3AF;">Unit</span><div style="font-weight:600;color:#374151;">${v.unit_no}</div></div>
        <div><span style="color:#9CA3AF;">Color</span><div style="font-weight:600;color:#374151;">${v.color||'&mdash;'}</div></div>
        <div><span style="color:#9CA3AF;">Owner</span><div style="font-weight:600;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${v.owner_name||'&mdash;'}</div></div>
        <div><span style="color:#9CA3AF;">Tenant</span><div style="font-weight:600;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${v.tenant_name||'&mdash;'}</div></div>
      </div>
      <!-- RC & date -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;">
        ${v.rc_file_data
          ? `<button onclick="viewRcDocument(${v.id})" style="background:#FFF0EC;color:#E8431A;border:1px solid #FDDDD4;border-radius:6px;padding:4px 10px;font-size:11.5px;font-weight:600;cursor:pointer;"><i class="fas fa-file-alt" style="margin-right:4px;"></i>View RC</button>`
          : `<span style="font-size:11px;color:#9CA3AF;"><i class="fas fa-exclamation-circle" style="margin-right:4px;"></i>No RC uploaded</span>`}
        <span style="font-size:10.5px;color:#C4B5B0;">${formatDate(v.registered_at)}</span>
      </div>
    </div>`).join('')
}

function filterVehicles(q) {
  const query = q.toLowerCase()
  const filtered = (window._allVehicles||[]).filter(v =>
    v.vehicle_number.toLowerCase().includes(query) ||
    (v.unit_no||'').toLowerCase().includes(query) ||
    (v.owner_name||'').toLowerCase().includes(query) ||
    (v.tenant_name||'').toLowerCase().includes(query) ||
    (v.make||'').toLowerCase().includes(query))
  document.getElementById('vehicleList').innerHTML = renderVehicleCards(filtered)
}

async function showAddVehicleModal(prefillUnitId) {
  const ur = await api('GET', '/units?limit=300')
  const unitOpts = (ur?.data?.units||[]).map(u =>
    `<option value="${u.id}" ${prefillUnitId&&u.id==prefillUnitId?'selected':''}>Unit ${u.unit_no} – ${u.owner_name||'Vacant'}</option>`
  ).join('')

  showModal(`<div class="p-4 overflow-y-auto" style="max-height:90vh">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-bold text-gray-800"><i class="fas fa-car mr-2 text-blue-600"></i>Register Vehicle</h3>
      <button onclick="closeModal()" class="text-gray-400 hover:text-gray-700"><i class="fas fa-times"></i></button>
    </div>
    <div class="space-y-3">
      <div>
        <label class="form-label">Unit *</label>
        <select id="vUnit" class="form-input" onchange="loadUnitResidents(this.value)">
          <option value="">Select unit...</option>${unitOpts}
        </select>
      </div>
      <div id="residentFields"></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="form-label">Vehicle Number *</label>
          <input type="text" id="vNumber" class="form-input" placeholder="e.g. MH12AB1234" oninput="this.value=this.value.toUpperCase()"/></div>
        <div><label class="form-label">Vehicle Type</label>
          <select id="vType" class="form-input"><option>Car</option><option>Bike</option><option>Scooter</option><option>Truck</option><option>Other</option></select></div>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div><label class="form-label">Make</label><input type="text" id="vMake" class="form-input" placeholder="Honda"/></div>
        <div><label class="form-label">Model</label><input type="text" id="vModel" class="form-input" placeholder="City"/></div>
        <div><label class="form-label">Color</label><input type="text" id="vColor" class="form-input" placeholder="Silver"/></div>
      </div>
      <div>
        <label class="form-label">RC Document (Registration Certificate)</label>
        <input type="file" id="vRcFile" accept="image/*,.pdf" class="form-input" onchange="previewRc(this)"/>
        <div id="rcPreview" class="mt-2"></div>
      </div>
      <div class="flex gap-2 pt-2">
        <button onclick="submitVehicle()" class="btn-primary flex-1 py-2 rounded-xl">Register Vehicle</button>
        <button onclick="closeModal()" class="flex-1 py-2 border rounded-xl text-gray-600">Cancel</button>
      </div>
    </div>
  </div>`)

  if (prefillUnitId) loadUnitResidents(prefillUnitId)
}

async function loadUnitResidents(unitId) {
  if (!unitId) { document.getElementById('residentFields').innerHTML = ''; return }
  const r = await api('GET', `/units/${unitId}`)
  if (!r?.ok) return
  const { unit } = r.data
  const owner = unit.owner
  const tenants = unit.tenants || []
  let html = ''
  if (owner || tenants.length) {
    html = `<div><label class="form-label">Resident (Owner / Tenant)</label>
      <select id="vResident" class="form-input">
        <option value="">Select resident...</option>
        ${owner?`<option value="owner:${owner.id}">Owner – ${owner.name}</option>`:''}
        ${tenants.filter(t=>t.is_active).map(t=>`<option value="tenant:${t.id}">Tenant – ${t.name}</option>`).join('')}
      </select></div>`
  }
  document.getElementById('residentFields').innerHTML = html
}

async function previewRc(input) {
  if (!input.files[0]) return
  const file = input.files[0]
  const b64 = await fileToBase64(file)
  input._b64 = b64; input._fname = file.name
  const preview = document.getElementById('rcPreview')
  if (file.type.startsWith('image/')) preview.innerHTML = `<img src="${b64}" class="w-48 h-32 object-cover rounded border"/>`
  else preview.innerHTML = `<div class="text-xs text-gray-600 mt-1"><i class="fas fa-file-pdf text-red-500 mr-1"></i>${file.name}</div>`
}

async function submitVehicle() {
  const unit_id = document.getElementById('vUnit').value
  const vNumber = document.getElementById('vNumber').value.trim().toUpperCase()
  const vType   = document.getElementById('vType').value
  const vMake   = document.getElementById('vMake').value.trim()
  const vModel  = document.getElementById('vModel').value.trim()
  const vColor  = document.getElementById('vColor').value.trim()
  const rcInput = document.getElementById('vRcFile')

  if (!unit_id || !vNumber) { toast('Unit and vehicle number are required', 'error'); return }

  let customer_id = null, tenant_id = null
  const resEl = document.getElementById('vResident')
  if (resEl?.value) { const [type,id] = resEl.value.split(':'); if(type==='owner') customer_id=parseInt(id); else tenant_id=parseInt(id) }

  const r = await api('POST', '/vehicles', {
    unit_id: parseInt(unit_id), customer_id, tenant_id,
    vehicle_number: vNumber, vehicle_type: vType,
    vehicle_make: vMake||null, vehicle_model: vModel||null, vehicle_color: vColor||null,
    rc_file_name: rcInput._fname||null, rc_file_data: rcInput._b64||null
  })
  if (r?.ok) { toast('Vehicle registered!', 'success'); closeModal(); loadVehicles() }
  else toast(r?.data?.error||'Failed to register vehicle', 'error')
}

async function showVehicleDetail(id) {
  const r = await api('GET', `/vehicles/${id}`)
  if (!r?.ok) { toast('Failed to load vehicle', 'error'); return }
  const v = r.data.vehicle
  showModal(`<div class="p-4">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-bold text-gray-800"><i class="fas fa-car mr-2 text-blue-600"></i>${v.vehicle_number}</h3>
      <button onclick="closeModal()" class="text-gray-400"><i class="fas fa-times"></i></button>
    </div>
    <div class="grid grid-cols-2 gap-3 text-sm">
      <div><span class="text-gray-400">Unit</span><div class="font-semibold">${v.unit_no}</div></div>
      <div><span class="text-gray-400">Type</span><div class="font-semibold">${v.vehicle_type}</div></div>
      <div><span class="text-gray-400">Make / Model</span><div class="font-semibold">${v.make||'—'} ${v.model||''}</div></div>
      <div><span class="text-gray-400">Color</span><div class="font-semibold">${v.color||'—'}</div></div>
      <div><span class="text-gray-400">Owner</span><div class="font-semibold">${v.owner_name||'—'}</div></div>
      <div><span class="text-gray-400">Tenant</span><div class="font-semibold">${v.tenant_name||'—'}</div></div>
      <div><span class="text-gray-400">Registered</span><div class="font-semibold">${formatDate(v.registered_at)}</div></div>
      <div><span class="text-gray-400">By</span><div class="font-semibold">${v.registered_by_name||'Self'}</div></div>
    </div>
    ${v.rc_file_data&&v.rc_file_data.startsWith('data:image')?`<div class="mt-4"><div class="text-xs text-gray-500 mb-1">RC Document</div><img src="${v.rc_file_data}" class="max-w-full rounded border" alt="RC"/></div>`:''}
    ${v.rc_file_data&&!v.rc_file_data.startsWith('data:image')?`<div class="mt-4 p-3 bg-gray-50 rounded"><i class="fas fa-file-pdf text-red-500 mr-2"></i>${v.rc_file_name||'RC'}<a href="${v.rc_file_data}" download="${v.rc_file_name||'rc'}" class="ml-2 text-blue-600 text-xs hover:underline">Download</a></div>`:''}
  </div>`)
}

async function showEditVehicle(id) {
  const r = await api('GET', `/vehicles/${id}`)
  if (!r?.ok) { toast('Failed to load', 'error'); return }
  const v = r.data.vehicle
  showModal(`<div class="p-4">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-bold text-gray-800"><i class="fas fa-edit mr-2"></i>Edit Vehicle</h3>
      <button onclick="closeModal()" class="text-gray-400"><i class="fas fa-times"></i></button>
    </div>
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div><label class="form-label">Vehicle Number *</label>
          <input type="text" id="evNumber" class="form-input" value="${v.vehicle_number}" oninput="this.value=this.value.toUpperCase()"/></div>
        <div><label class="form-label">Type</label>
          <select id="evType" class="form-input">${['Car','Bike','Scooter','Truck','Other'].map(t=>`<option ${v.vehicle_type===t?'selected':''}>${t}</option>`).join('')}</select></div>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div><label class="form-label">Make</label><input type="text" id="evMake" class="form-input" value="${v.make||''}"/></div>
        <div><label class="form-label">Model</label><input type="text" id="evModel" class="form-input" value="${v.model||''}"/></div>
        <div><label class="form-label">Color</label><input type="text" id="evColor" class="form-input" value="${v.color||''}"/></div>
      </div>
      <div>
        <label class="form-label">Replace RC Document</label>
        <input type="file" id="evRcFile" accept="image/*,.pdf" class="form-input" onchange="previewRcEdit(this)"/>
        <div id="rcEditPreview">${v.rc_file_data&&v.rc_file_data.startsWith('data:image')?`<img src="${v.rc_file_data}" class="w-48 h-32 object-cover rounded border mt-1"/>`:v.rc_file_name?`<div class="text-xs text-gray-600 mt-1"><i class="fas fa-file-pdf text-red-500 mr-1"></i>${v.rc_file_name}</div>`:''}</div>
      </div>
      <div class="flex gap-2 pt-2">
        <button onclick="updateVehicle(${v.id})" class="btn-primary flex-1 py-2 rounded-xl">Save Changes</button>
        <button onclick="closeModal()" class="flex-1 py-2 border rounded-xl text-gray-600">Cancel</button>
      </div>
    </div>
  </div>`)
}

async function previewRcEdit(input) {
  if (!input.files[0]) return
  const file = input.files[0]
  const b64 = await fileToBase64(file)
  input._b64 = b64; input._fname = file.name
  const preview = document.getElementById('rcEditPreview')
  if (file.type.startsWith('image/')) preview.innerHTML = `<img src="${b64}" class="w-48 h-32 object-cover rounded border mt-1"/>`
  else preview.innerHTML = `<div class="text-xs text-gray-600 mt-1"><i class="fas fa-file-pdf text-red-500 mr-1"></i>${file.name}</div>`
}

async function updateVehicle(id) {
  const rcInput = document.getElementById('evRcFile')
  const r = await api('PUT', `/vehicles/${id}`, {
    vehicle_number: document.getElementById('evNumber').value.trim().toUpperCase(),
    vehicle_type:   document.getElementById('evType').value,
    vehicle_make:   document.getElementById('evMake').value.trim()||null,
    vehicle_model:  document.getElementById('evModel').value.trim()||null,
    vehicle_color:  document.getElementById('evColor').value.trim()||null,
    rc_file_name:   rcInput._fname||null,
    rc_file_data:   rcInput._b64||null
  })
  if (r?.ok) { toast('Vehicle updated!', 'success'); closeModal(); loadVehicles() }
  else toast(r?.data?.error||'Update failed', 'error')
}

async function removeVehicle(id) {
  if (!confirm('Remove this vehicle from registry?')) return
  const r = await api('DELETE', `/vehicles/${id}`, null)
  if (r?.ok) { toast('Vehicle removed', 'success'); loadVehicles() }
  else toast(r?.data?.error||'Failed to remove', 'error')
}

function viewRcDocument(vehicleId) {
  const v = (window._allVehicles||[]).find(x => x.id == vehicleId)
  if (!v?.rc_file_data) { toast('No RC document available', 'error'); return }
  showModal(`<div class="p-4">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-bold">RC Document – ${v.vehicle_number}</h3>
      <button onclick="closeModal()" class="text-gray-400"><i class="fas fa-times"></i></button>
    </div>
    ${v.rc_file_data.startsWith('data:image')?`<img src="${v.rc_file_data}" class="max-w-full rounded" alt="RC"/>`:
    `<div class="p-4 bg-gray-50 rounded text-center">
      <i class="fas fa-file-pdf text-red-500 text-4xl mb-2"></i>
      <div class="text-sm mb-3">${v.rc_file_name||'RC Document'}</div>
      <a href="${v.rc_file_data}" download="${v.rc_file_name||'rc'}" class="btn-primary px-4 py-2 rounded-xl inline-block text-sm">Download PDF</a>
    </div>`}
  </div>`)
}

// ══════════════════════════════════════════════════════════════
// ── COMPLAINTS MASTER ────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

// Color palette pool for dynamic categories
const CAT_COLOR_POOL = [
  { bg:'#EFF6FF', border:'#BFDBFE', icon:'#2563EB', badge:'#DBEAFE', badgeText:'#1E40AF', accent:'#3B82F6' },
  { bg:'#FFFBEB', border:'#FDE68A', icon:'#D97706', badge:'#FEF3C7', badgeText:'#92400E', accent:'#F59E0B' },
  { bg:'#ECFDF5', border:'#A7F3D0', icon:'#059669', badge:'#D1FAE5', badgeText:'#065F46', accent:'#10B981' },
  { bg:'#F5F3FF', border:'#DDD6FE', icon:'#7C3AED', badge:'#EDE9FE', badgeText:'#4C1D95', accent:'#8B5CF6' },
  { bg:'#FFF5F3', border:'#FDDDD4', icon:'#E8431A', badge:'#FEE2D5', badgeText:'#7C2D12', accent:'#E8431A' },
  { bg:'#F0FDF4', border:'#BBF7D0', icon:'#16A34A', badge:'#DCFCE7', badgeText:'#14532D', accent:'#22C55E' },
  { bg:'#FFF1F2', border:'#FECDD3', icon:'#E11D48', badge:'#FFE4E6', badgeText:'#881337', accent:'#F43F5E' },
  { bg:'#F0F9FF', border:'#BAE6FD', icon:'#0284C7', badge:'#E0F2FE', badgeText:'#0C4A6E', accent:'#0EA5E9' },
]

const CAT_ICON_OPTIONS = [
  'fa-tint','fa-bolt','fa-hammer','fa-receipt','fa-ellipsis-h','fa-tools',
  'fa-fire','fa-leaf','fa-car','fa-wifi','fa-shield-alt','fa-cog',
  'fa-water','fa-lightbulb','fa-wrench','fa-trash','fa-building','fa-lock'
]

function getCatColor(idx) { return CAT_COLOR_POOL[idx % CAT_COLOR_POOL.length] }

async function loadComplaintsMaster() {
  const content = document.getElementById('pageContent')
  content.innerHTML = `<div class="loading"><div class="spinner"></div></div>`

  const isAdmin = ['admin','sub_admin'].includes(currentUser?.role)

  // Admins see all (incl. inactive); others see active only
  const [catR, subCatR] = await Promise.all([
    isAdmin ? api('GET', '/complaints/categories/all') : api('GET', '/complaints/categories/list'),
    isAdmin ? api('GET', '/complaints/sub-categories/all') : api('GET', '/complaints/sub-categories/list')
  ])
  const categories = catR?.data?.categories || []
  const subCategories = subCatR?.data?.sub_categories || []
  const subByCat = {}
  subCategories.forEach(sc => { if (!subByCat[sc.category_id]) subByCat[sc.category_id] = []; subByCat[sc.category_id].push(sc) })

  const totalActive   = categories.filter(c => c.is_active).length
  const totalInactive = categories.filter(c => !c.is_active).length
  const totalSubs     = subCategories.length
  const activeSubs    = subCategories.filter(s => s.is_active).length

  content.innerHTML = `
  <div style="display:flex;flex-direction:column;gap:20px;">

    <!-- Page Header -->
    <div class="page-header">
      <div class="page-title">
        <div class="page-title-icon"><i class="fas fa-layer-group"></i></div>
        <div>
          <div>Complaints Master</div>
          <div class="page-subtitle">${categories.length} complaint types &bull; ${totalSubs} sub-types configured</div>
        </div>
      </div>
      ${isAdmin ? `<button onclick="showAddCategoryModal()" class="btn-primary"><i class="fas fa-plus"></i>Add Type</button>` : ''}
    </div>

    <!-- Summary Stats -->
    <div class="grid-4" style="gap:12px;">
      <div class="card" style="padding:16px;display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#E8431A,#8B1A1A);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="fas fa-layer-group" style="color:white;font-size:16px;"></i>
        </div>
        <div>
          <div style="font-size:22px;font-weight:800;color:#111827;">${categories.length}</div>
          <div style="font-size:11px;color:#6B7280;font-weight:500;">Total Types</div>
        </div>
      </div>
      <div class="card" style="padding:16px;display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#10B981,#065F46);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="fas fa-check-circle" style="color:white;font-size:16px;"></i>
        </div>
        <div>
          <div style="font-size:22px;font-weight:800;color:#111827;">${totalActive}</div>
          <div style="font-size:11px;color:#6B7280;font-weight:500;">Active Types</div>
        </div>
      </div>
      <div class="card" style="padding:16px;display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#3B82F6,#1E40AF);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="fas fa-list" style="color:white;font-size:16px;"></i>
        </div>
        <div>
          <div style="font-size:22px;font-weight:800;color:#111827;">${totalSubs}</div>
          <div style="font-size:11px;color:#6B7280;font-weight:500;">Total Sub-Types</div>
        </div>
      </div>
      <div class="card" style="padding:16px;display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#8B5CF6,#4C1D95);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="fas fa-toggle-on" style="color:white;font-size:16px;"></i>
        </div>
        <div>
          <div style="font-size:22px;font-weight:800;color:#111827;">${activeSubs}</div>
          <div style="font-size:11px;color:#6B7280;font-weight:500;">Active Sub-Types</div>
        </div>
      </div>
    </div>

    <!-- Category Cards Grid -->
    <div style="display:flex;flex-direction:column;gap:16px;">
      ${categories.length === 0 ? `
        <div class="card" style="padding:40px;text-align:center;color:#9CA3AF;">
          <i class="fas fa-layer-group" style="font-size:48px;margin-bottom:16px;opacity:0.3;display:block;"></i>
          <div style="font-size:16px;font-weight:600;margin-bottom:8px;">No complaint types configured</div>
          ${isAdmin ? `<button onclick="showAddCategoryModal()" class="btn-primary" style="margin-top:12px;"><i class="fas fa-plus"></i>Add First Type</button>` : ''}
        </div>
      ` : categories.map((cat, catIdx) => {
        const subs = subByCat[cat.id] || []
        const activeSubs2 = subs.filter(s => s.is_active)
        const inactiveSubs = subs.filter(s => !s.is_active)
        const c = getCatColor(catIdx)
        const icon = cat.icon || 'fa-exclamation-circle'
        const isInactive = !cat.is_active
        return `
        <div class="card" style="overflow:hidden;${isInactive?'opacity:0.65;':''}" id="cat-card-${cat.id}">
          <!-- Category Header -->
          <div style="background:${c.bg};border-bottom:1.5px solid ${c.border};padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div style="display:flex;align-items:center;gap:12px;flex:1;">
              <div style="width:42px;height:42px;border-radius:11px;background:white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.1);flex-shrink:0;">
                <i class="fas ${icon}" style="color:${c.icon};font-size:18px;"></i>
              </div>
              <div>
                <div style="font-weight:700;color:#111827;font-size:15px;display:flex;align-items:center;gap:8px;">
                  ${cat.name}
                  ${isInactive ? `<span style="background:#FEE2E2;color:#B91C1C;font-size:9.5px;padding:2px 7px;border-radius:20px;font-weight:700;">INACTIVE</span>` : ''}
                </div>
                <div style="font-size:11.5px;color:#6B7280;margin-top:2px;">
                  ${cat.description || 'No description'}
                  &bull; <strong>${subs.length}</strong> sub-type(s) &bull; Sort: ${cat.sort_order||1}
                </div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
              <span style="background:${c.badge};color:${c.badgeText};padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;">${activeSubs2.length} active</span>
              ${isAdmin ? `
              <button onclick="showAddSubCategoryModal(${cat.id},'${cat.name.replace(/'/g,'\\\'')}')" 
                style="background:${c.accent};color:white;border:none;border-radius:8px;padding:6px 12px;font-size:11.5px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;">
                <i class="fas fa-plus"></i>Add Sub-Type
              </button>
              <button onclick="showEditCategoryModal(${cat.id})" 
                style="background:white;border:1.5px solid ${c.border};border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer;color:${c.icon};" title="Edit type">
                <i class="fas fa-edit"></i>
              </button>
              <button onclick="confirmDeleteCategory(${cat.id},'${cat.name.replace(/'/g,'\\\'')}')" 
                style="background:white;border:1.5px solid #FECACA;border-radius:8px;padding:6px 10px;font-size:12px;cursor:pointer;color:#DC2626;" title="Delete type">
                <i class="fas fa-trash"></i>
              </button>
              ` : ''}
            </div>
          </div>

          <!-- Sub-types Table -->
          <div style="padding:0;">
            ${subs.length === 0 ? `
              <div style="padding:20px;text-align:center;color:#9CA3AF;font-size:12.5px;">
                <i class="fas fa-inbox" style="font-size:24px;margin-bottom:8px;display:block;opacity:0.4;"></i>
                No sub-types yet ${isAdmin ? `— <button onclick="showAddSubCategoryModal(${cat.id},'${cat.name.replace(/'/g,'\\\'')}')" style="color:${c.icon};background:none;border:none;font-weight:600;cursor:pointer;font-size:12.5px;">Add one</button>` : ''}
              </div>
            ` : `
              <table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr style="background:#F9FAFB;border-bottom:1px solid #F3F4F6;">
                    <th style="padding:10px 20px;text-align:left;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;width:40px;">#</th>
                    <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;">Sub-Type Name</th>
                    <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;">Description</th>
                    <th style="padding:10px 16px;text-align:center;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;">Res. Days</th>
                    <th style="padding:10px 16px;text-align:center;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;">Status</th>
                    <th style="padding:10px 16px;text-align:center;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;">Sort</th>
                    ${isAdmin ? `<th style="padding:10px 16px;text-align:center;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;">Actions</th>` : ''}
                  </tr>
                </thead>
                <tbody>
                  ${subs.map((sc, i) => `
                    <tr style="border-bottom:1px solid #F3F4F6;${!sc.is_active?'opacity:0.55;background:#FAFAFA;':''}transition:background 0.15s;" 
                        onmouseover="this.style.background='${c.bg}'" onmouseout="this.style.background=''">
                      <td style="padding:11px 20px;">
                        <span style="width:22px;height:22px;background:${c.badge};color:${c.badgeText};border-radius:50%;font-size:10px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;">${i+1}</span>
                      </td>
                      <td style="padding:11px 16px;">
                        <div style="font-weight:600;color:#111827;font-size:13px;">${sc.name}</div>
                      </td>
                      <td style="padding:11px 16px;color:#6B7280;font-size:12px;max-width:240px;">
                        ${sc.description ? `<span title="${sc.description}">${sc.description.length>60?sc.description.substring(0,60)+'…':sc.description}</span>` : '<span style="color:#D1D5DB;">—</span>'}
                      </td>
                      <td style="padding:11px 16px;text-align:center;">
                        ${sc.typical_resolution_days ? `<span style="background:#F0FDF4;color:#16A34A;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;">${sc.typical_resolution_days}d</span>` : '<span style="color:#D1D5DB;font-size:12px;">—</span>'}
                      </td>
                      <td style="padding:11px 16px;text-align:center;">
                        <span style="background:${sc.is_active?'#D1FAE5':'#FEE2E2'};color:${sc.is_active?'#065F46':'#B91C1C'};padding:3px 10px;border-radius:20px;font-size:10.5px;font-weight:700;">
                          ${sc.is_active?'Active':'Inactive'}
                        </span>
                      </td>
                      <td style="padding:11px 16px;text-align:center;color:#9CA3AF;font-size:12px;">${sc.sort_order||1}</td>
                      ${isAdmin ? `
                      <td style="padding:11px 16px;text-align:center;">
                        <div style="display:flex;gap:6px;justify-content:center;">
                          <button onclick="showEditSubCategoryModal(${sc.id},${cat.id})" 
                            style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:7px;padding:5px 9px;font-size:11.5px;cursor:pointer;color:#2563EB;" title="Edit">
                            <i class="fas fa-edit"></i>
                          </button>
                          <button onclick="confirmDeleteSubCategory(${sc.id},'${sc.name.replace(/'/g,'\\\'')}')" 
                            style="background:#FEF2F2;border:1px solid #FECACA;border-radius:7px;padding:5px 9px;font-size:11.5px;cursor:pointer;color:#DC2626;" title="Delete">
                            <i class="fas fa-trash"></i>
                          </button>
                        </div>
                      </td>` : ''}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>`
      }).join('')}
    </div>
  </div>`
}

// ── Add Category Modal ────────────────────────────────────────
function showAddCategoryModal() {
  const iconOpts = CAT_ICON_OPTIONS.map(ic =>
    `<option value="${ic}">${ic.replace('fa-','')}</option>`
  ).join('')
  showModal(`
    <div style="padding:0;">
      <div style="background:linear-gradient(135deg,#E8431A,#8B1A1A);padding:20px 24px;border-radius:14px 14px 0 0;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;background:rgba(255,255,255,0.15);border-radius:9px;display:flex;align-items:center;justify-content:center;">
            <i class="fas fa-plus" style="color:white;font-size:16px;"></i>
          </div>
          <div style="color:white;">
            <div style="font-weight:700;font-size:15px;">Add Complaint Type</div>
            <div style="font-size:11px;opacity:0.85;">Create a new complaint category</div>
          </div>
        </div>
        <button onclick="closeModal()" style="background:rgba(255,255,255,0.15);border:none;border-radius:8px;padding:6px 10px;cursor:pointer;color:white;font-size:14px;"><i class="fas fa-times"></i></button>
      </div>
      <div style="padding:22px 24px;display:flex;flex-direction:column;gap:14px;">
        <div>
          <label class="form-label">Type Name *</label>
          <input id="catName" class="form-input" placeholder="e.g. Plumbing, Electrical…" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label class="form-label">Icon</label>
            <select id="catIcon" class="form-input">${iconOpts}</select>
          </div>
          <div>
            <label class="form-label">Sort Order</label>
            <input id="catSort" type="number" class="form-input" value="1" min="1" />
          </div>
        </div>
        <div>
          <label class="form-label">Description</label>
          <textarea id="catDesc" class="form-input" rows="2" placeholder="Brief description of this complaint type…"></textarea>
        </div>
        <div style="display:flex;gap:10px;padding-top:4px;">
          <button onclick="submitAddCategory()" class="btn-primary" style="flex:1;padding:10px;">
            <i class="fas fa-check" style="margin-right:6px;"></i>Create Type
          </button>
          <button onclick="closeModal()" style="flex:0 0 auto;padding:10px 20px;border:1.5px solid #E5E7EB;border-radius:10px;background:white;color:#6B7280;cursor:pointer;font-weight:600;">Cancel</button>
        </div>
      </div>
    </div>
  `)
}

async function submitAddCategory() {
  const name = document.getElementById('catName').value.trim()
  const icon = document.getElementById('catIcon').value
  const sort_order = parseInt(document.getElementById('catSort').value)||1
  const description = document.getElementById('catDesc').value.trim()
  if (!name) { toast('Type name is required','error'); return }
  const r = await api('POST', '/complaints/categories', { name, icon, description, sort_order })
  if (r?.ok) { toast('Complaint type created!','success'); closeModal(); loadComplaintsMaster() }
  else toast(r?.data?.error||'Failed to create type','error')
}

// ── Edit Category Modal ───────────────────────────────────────
async function showEditCategoryModal(id) {
  // Fetch all categories to find this one
  const r = await api('GET', '/complaints/categories/all')
  const cat = (r?.data?.categories||[]).find(c => c.id == id)
  if (!cat) { toast('Category not found','error'); return }
  const iconOpts = CAT_ICON_OPTIONS.map(ic =>
    `<option value="${ic}" ${cat.icon===ic?'selected':''}>${ic.replace('fa-','')}</option>`
  ).join('')
  showModal(`
    <div style="padding:0;">
      <div style="background:linear-gradient(135deg,#2563EB,#1E40AF);padding:20px 24px;border-radius:14px 14px 0 0;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;background:rgba(255,255,255,0.15);border-radius:9px;display:flex;align-items:center;justify-content:center;">
            <i class="fas fa-edit" style="color:white;font-size:16px;"></i>
          </div>
          <div style="color:white;">
            <div style="font-weight:700;font-size:15px;">Edit Complaint Type</div>
            <div style="font-size:11px;opacity:0.85;">${cat.name}</div>
          </div>
        </div>
        <button onclick="closeModal()" style="background:rgba(255,255,255,0.15);border:none;border-radius:8px;padding:6px 10px;cursor:pointer;color:white;font-size:14px;"><i class="fas fa-times"></i></button>
      </div>
      <div style="padding:22px 24px;display:flex;flex-direction:column;gap:14px;">
        <div>
          <label class="form-label">Type Name *</label>
          <input id="editCatName" class="form-input" value="${cat.name}" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
          <div>
            <label class="form-label">Icon</label>
            <select id="editCatIcon" class="form-input">${iconOpts}</select>
          </div>
          <div>
            <label class="form-label">Sort Order</label>
            <input id="editCatSort" type="number" class="form-input" value="${cat.sort_order||1}" min="1" />
          </div>
          <div>
            <label class="form-label">Status</label>
            <select id="editCatStatus" class="form-input">
              <option value="1" ${cat.is_active?'selected':''}>Active</option>
              <option value="0" ${!cat.is_active?'selected':''}>Inactive</option>
            </select>
          </div>
        </div>
        <div>
          <label class="form-label">Description</label>
          <textarea id="editCatDesc" class="form-input" rows="2">${cat.description||''}</textarea>
        </div>
        <div style="display:flex;gap:10px;padding-top:4px;">
          <button onclick="submitEditCategory(${id})" class="btn-primary" style="flex:1;padding:10px;">
            <i class="fas fa-save" style="margin-right:6px;"></i>Save Changes
          </button>
          <button onclick="closeModal()" style="flex:0 0 auto;padding:10px 20px;border:1.5px solid #E5E7EB;border-radius:10px;background:white;color:#6B7280;cursor:pointer;font-weight:600;">Cancel</button>
        </div>
      </div>
    </div>
  `)
}

async function submitEditCategory(id) {
  const name = document.getElementById('editCatName').value.trim()
  const icon = document.getElementById('editCatIcon').value
  const sort_order = parseInt(document.getElementById('editCatSort').value)||1
  const description = document.getElementById('editCatDesc').value.trim()
  const is_active = document.getElementById('editCatStatus').value === '1'
  if (!name) { toast('Type name is required','error'); return }
  const r = await api('PUT', `/complaints/categories/${id}`, { name, icon, description, sort_order, is_active })
  if (r?.ok) { toast('Type updated!','success'); closeModal(); loadComplaintsMaster() }
  else toast(r?.data?.error||'Failed to update','error')
}

async function confirmDeleteCategory(id, name) {
  if (!confirm(`Delete complaint type "${name}"?\n\nThis will also remove all its sub-types. This cannot be undone.`)) return
  const r = await api('DELETE', `/complaints/categories/${id}`, null)
  if (r?.ok) { toast('Type deleted','success'); loadComplaintsMaster() }
  else toast(r?.data?.error||'Failed to delete','error')
}

// ── Add Sub-Category Modal ────────────────────────────────────
function showAddSubCategoryModal(catId, catName) {
  showModal(`
    <div style="padding:0;">
      <div style="background:linear-gradient(135deg,#10B981,#065F46);padding:20px 24px;border-radius:14px 14px 0 0;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;background:rgba(255,255,255,0.15);border-radius:9px;display:flex;align-items:center;justify-content:center;">
            <i class="fas fa-plus" style="color:white;font-size:16px;"></i>
          </div>
          <div style="color:white;">
            <div style="font-weight:700;font-size:15px;">Add Sub-Type</div>
            <div style="font-size:11px;opacity:0.85;">Under: ${catName}</div>
          </div>
        </div>
        <button onclick="closeModal()" style="background:rgba(255,255,255,0.15);border:none;border-radius:8px;padding:6px 10px;cursor:pointer;color:white;font-size:14px;"><i class="fas fa-times"></i></button>
      </div>
      <div style="padding:22px 24px;display:flex;flex-direction:column;gap:14px;">
        <input type="hidden" id="subCatParentId" value="${catId}" />
        <div>
          <label class="form-label">Sub-Type Name *</label>
          <input id="subCatName" class="form-input" placeholder="e.g. Pipe Leakage, Socket Repair…" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label class="form-label">Typical Resolution (days)</label>
            <input id="subCatDays" type="number" class="form-input" placeholder="e.g. 3" min="1" />
          </div>
          <div>
            <label class="form-label">Sort Order</label>
            <input id="subCatSort" type="number" class="form-input" value="1" min="1" />
          </div>
        </div>
        <div>
          <label class="form-label">Description</label>
          <textarea id="subCatDesc" class="form-input" rows="2" placeholder="Detailed description of this sub-type…"></textarea>
        </div>
        <div style="display:flex;gap:10px;padding-top:4px;">
          <button onclick="submitAddSubCategory()" class="btn-primary" style="flex:1;padding:10px;">
            <i class="fas fa-check" style="margin-right:6px;"></i>Create Sub-Type
          </button>
          <button onclick="closeModal()" style="flex:0 0 auto;padding:10px 20px;border:1.5px solid #E5E7EB;border-radius:10px;background:white;color:#6B7280;cursor:pointer;font-weight:600;">Cancel</button>
        </div>
      </div>
    </div>
  `)
}

async function submitAddSubCategory() {
  const category_id = document.getElementById('subCatParentId').value
  const name = document.getElementById('subCatName').value.trim()
  const description = document.getElementById('subCatDesc').value.trim()
  const typical_resolution_days = parseInt(document.getElementById('subCatDays').value)||null
  const sort_order = parseInt(document.getElementById('subCatSort').value)||1
  if (!name) { toast('Sub-type name is required','error'); return }
  const r = await api('POST', '/complaints/sub-categories', { category_id: parseInt(category_id), name, description, typical_resolution_days, sort_order })
  if (r?.ok) { toast('Sub-type created!','success'); closeModal(); loadComplaintsMaster() }
  else toast(r?.data?.error||'Failed to create sub-type','error')
}

// ── Edit Sub-Category Modal ───────────────────────────────────
async function showEditSubCategoryModal(id, catId) {
  // Fetch sub-categories for this category
  const [allSubR, catR] = await Promise.all([
    api('GET', `/complaints/sub-categories/all?category_id=${catId}`),
    api('GET', '/complaints/categories/all')
  ])
  const sc = (allSubR?.data?.sub_categories||[]).find(s => s.id == id)
  const categories = catR?.data?.categories || []
  if (!sc) { toast('Sub-category not found','error'); return }
  const catOpts = categories.map(c =>
    `<option value="${c.id}" ${c.id==sc.category_id?'selected':''}>${c.name}</option>`
  ).join('')
  showModal(`
    <div style="padding:0;">
      <div style="background:linear-gradient(135deg,#2563EB,#1E40AF);padding:20px 24px;border-radius:14px 14px 0 0;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;background:rgba(255,255,255,0.15);border-radius:9px;display:flex;align-items:center;justify-content:center;">
            <i class="fas fa-edit" style="color:white;font-size:16px;"></i>
          </div>
          <div style="color:white;">
            <div style="font-weight:700;font-size:15px;">Edit Sub-Type</div>
            <div style="font-size:11px;opacity:0.85;">${sc.name}</div>
          </div>
        </div>
        <button onclick="closeModal()" style="background:rgba(255,255,255,0.15);border:none;border-radius:8px;padding:6px 10px;cursor:pointer;color:white;font-size:14px;"><i class="fas fa-times"></i></button>
      </div>
      <div style="padding:22px 24px;display:flex;flex-direction:column;gap:14px;">
        <div>
          <label class="form-label">Sub-Type Name *</label>
          <input id="editSubName" class="form-input" value="${sc.name}" />
        </div>
        <div>
          <label class="form-label">Parent Type</label>
          <select id="editSubCatId" class="form-input">${catOpts}</select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
          <div>
            <label class="form-label">Res. Days</label>
            <input id="editSubDays" type="number" class="form-input" value="${sc.typical_resolution_days||''}" min="1" placeholder="e.g. 3" />
          </div>
          <div>
            <label class="form-label">Sort Order</label>
            <input id="editSubSort" type="number" class="form-input" value="${sc.sort_order||1}" min="1" />
          </div>
          <div>
            <label class="form-label">Status</label>
            <select id="editSubStatus" class="form-input">
              <option value="1" ${sc.is_active?'selected':''}>Active</option>
              <option value="0" ${!sc.is_active?'selected':''}>Inactive</option>
            </select>
          </div>
        </div>
        <div>
          <label class="form-label">Description</label>
          <textarea id="editSubDesc" class="form-input" rows="2">${sc.description||''}</textarea>
        </div>
        <div style="display:flex;gap:10px;padding-top:4px;">
          <button onclick="submitEditSubCategory(${id})" class="btn-primary" style="flex:1;padding:10px;">
            <i class="fas fa-save" style="margin-right:6px;"></i>Save Changes
          </button>
          <button onclick="closeModal()" style="flex:0 0 auto;padding:10px 20px;border:1.5px solid #E5E7EB;border-radius:10px;background:white;color:#6B7280;cursor:pointer;font-weight:600;">Cancel</button>
        </div>
      </div>
    </div>
  `)
}

async function submitEditSubCategory(id) {
  const name = document.getElementById('editSubName').value.trim()
  const category_id = parseInt(document.getElementById('editSubCatId').value)
  const description = document.getElementById('editSubDesc').value.trim()
  const typical_resolution_days = parseInt(document.getElementById('editSubDays').value)||null
  const sort_order = parseInt(document.getElementById('editSubSort').value)||1
  const is_active = document.getElementById('editSubStatus').value === '1'
  if (!name) { toast('Sub-type name is required','error'); return }
  const r = await api('PUT', `/complaints/sub-categories/${id}`, { name, category_id, description, typical_resolution_days, sort_order, is_active })
  if (r?.ok) { toast('Sub-type updated!','success'); closeModal(); loadComplaintsMaster() }
  else toast(r?.data?.error||'Failed to update','error')
}

async function confirmDeleteSubCategory(id, name) {
  if (!confirm(`Delete sub-type "${name}"?\n\nThis cannot be undone.`)) return
  const r = await api('DELETE', `/complaints/sub-categories/${id}`, null)
  if (r?.ok) { toast('Sub-type deleted','success'); loadComplaintsMaster() }
  else toast(r?.data?.error||'Failed to delete','error')
}

// ══════════════════════════════════════════════════════════════
// ── INTERNAL COMPLAINTS ──────────────────────────────────────
// ══════════════════════════════════════════════════════════════

const IC_CATEGORIES = [
  'HR / People Issues', 'Facilities & Maintenance', 'IT & Systems',
  'Safety & Compliance', 'Management Concern', 'Process Improvement', 'General'
]
const IC_PRIORITY_STYLE = {
  Normal:  { bg:'#F0F9FF', color:'#0369A1', border:'#BAE6FD' },
  High:    { bg:'#FFF7ED', color:'#C2410C', border:'#FDC99B' },
  Urgent:  { bg:'#FEF2F2', color:'#B91C1C', border:'#FECACA' },
  Low:     { bg:'#F9FAFB', color:'#6B7280', border:'#E5E7EB' },
}
const IC_STATUS_STYLE = {
  'Pending':     { bg:'#FFFBEB', color:'#D97706', border:'#FDE68A', icon:'fa-clock' },
  'In-Progress': { bg:'#EFF6FF', color:'#1D4ED8', border:'#BFDBFE', icon:'fa-spinner' },
  'Resolved':    { bg:'#F0FDF4', color:'#15803D', border:'#86EFAC', icon:'fa-check-circle' },
}

function icStatusBadge(status) {
  const s = IC_STATUS_STYLE[status] || IC_STATUS_STYLE['Pending']
  return `<span style="background:${s.bg};color:${s.color};border:1px solid ${s.border};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:5px;">
    <i class="fas ${s.icon}" style="font-size:10px;"></i>${status}
  </span>`
}
function icPriorityBadge(p) {
  const s = IC_PRIORITY_STYLE[p] || IC_PRIORITY_STYLE['Normal']
  return `<span style="background:${s.bg};color:${s.color};border:1px solid ${s.border};padding:2px 9px;border-radius:20px;font-size:10.5px;font-weight:700;">${p}</span>`
}

async function loadInternalComplaints(params = {}) {
  const content = document.getElementById('pageContent')
  content.innerHTML = `<div class="loading"><div class="spinner"></div></div>`

  const isManager = ['admin','sub_admin'].includes(currentUser?.role)
  const statusFilter = params?.status || ''

  const r = await api('GET', `/internal-complaints?limit=50&status=${statusFilter}`)
  const complaints = r?.data?.complaints || []
  const total = r?.data?.total || 0

  const pending    = complaints.filter(c => c.status === 'Pending').length
  const inProgress = complaints.filter(c => c.status === 'In-Progress').length
  const resolved   = complaints.filter(c => c.status === 'Resolved').length

  content.innerHTML = `
  <div style="display:flex;flex-direction:column;gap:18px;">

    <!-- Header -->
    <div class="page-header">
      <div class="page-title">
        <div class="page-title-icon" style="background:linear-gradient(135deg,#7C3AED,#4C1D95);"><i class="fas fa-comment-dots"></i></div>
        <div>
          <div>Internal Complaints</div>
          <div class="page-subtitle">Employee-side issue tracker &bull; ${total} total</div>
        </div>
      </div>
      <button onclick="showRegisterInternalComplaint()" class="btn-primary" style="background:linear-gradient(135deg,#7C3AED,#4C1D95);box-shadow:0 3px 14px rgba(124,58,237,0.35);">
        <i class="fas fa-plus"></i>Raise Complaint
      </button>
    </div>

    <!-- Stats -->
    <div class="grid-4" style="gap:12px;">
      ${[
        [total,   'Total',      'fa-layer-group',  'linear-gradient(135deg,#7C3AED,#4C1D95)', 'all'],
        [pending, 'Pending',    'fa-clock',        'linear-gradient(135deg,#D97706,#92400E)', 'Pending'],
        [inProgress,'In-Progress','fa-spinner',    'linear-gradient(135deg,#1D4ED8,#1E3A8A)', 'In-Progress'],
        [resolved,'Resolved',   'fa-check-circle', 'linear-gradient(135deg,#15803D,#14532D)', 'Resolved'],
      ].map(([val,lbl,ic,grad,sf]) => `
      <div class="card" style="padding:16px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:transform .15s;"
           onclick="loadInternalComplaints({status:'${sf==='all'?'':sf}'})"
           onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
        <div style="width:40px;height:40px;border-radius:10px;background:${grad};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="fas ${ic}" style="color:white;font-size:16px;"></i>
        </div>
        <div>
          <div style="font-size:22px;font-weight:800;color:#111827;">${val}</div>
          <div style="font-size:11px;color:#6B7280;font-weight:500;">${lbl}</div>
        </div>
      </div>`).join('')}
    </div>

    <!-- Filter tabs -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      ${['','Pending','In-Progress','Resolved'].map(sf => `
      <button onclick="loadInternalComplaints({status:'${sf}'})"
        style="padding:7px 16px;border-radius:20px;border:1.5px solid ${sf===statusFilter?'#7C3AED':'#E5E7EB'};background:${sf===statusFilter?'#7C3AED':'white'};color:${sf===statusFilter?'white':'#6B7280'};font-weight:600;font-size:12px;cursor:pointer;transition:all .15s;">
        ${sf || 'All'}
      </button>`).join('')}
    </div>

    <!-- Table -->
    ${complaints.length === 0 ? `
    <div class="card" style="padding:48px;text-align:center;color:#9CA3AF;">
      <i class="fas fa-comment-slash" style="font-size:48px;margin-bottom:16px;display:block;opacity:0.3;"></i>
      <div style="font-size:16px;font-weight:600;margin-bottom:8px;">No internal complaints</div>
      <div style="font-size:13px;margin-bottom:16px;">Raise one to get started</div>
      <button onclick="showRegisterInternalComplaint()" style="background:linear-gradient(135deg,#7C3AED,#4C1D95);color:white;border:none;border-radius:10px;padding:10px 24px;font-weight:700;cursor:pointer;">
        <i class="fas fa-plus" style="margin-right:6px;"></i>Raise Complaint
      </button>
    </div>` : `
    <div class="card" style="overflow:hidden;">
      <div class="table-responsive">
      <table style="width:100%;border-collapse:collapse;min-width:600px;">
        <thead>
          <tr style="background:#F9FAFB;border-bottom:1px solid #F3F4F6;">
            <th style="padding:11px 18px;text-align:left;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.05em;">Ref No.</th>
            <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.05em;">Category</th>
            <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.05em;">Description</th>
            ${isManager ? `<th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.05em;">Reported By</th>` : ''}
            <th style="padding:11px 16px;text-align:center;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.05em;">Priority</th>
            <th style="padding:11px 16px;text-align:center;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.05em;">Status</th>
            <th style="padding:11px 16px;text-align:left;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.05em;">Date</th>
            <th style="padding:11px 16px;text-align:center;font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.05em;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${complaints.map((c, i) => `
          <tr style="border-bottom:1px solid #F9FAFB;transition:background .15s;" onmouseover="this.style.background='#F9F7FF'" onmouseout="this.style.background=''">
            <td style="padding:12px 18px;">
              <div style="font-weight:700;font-size:12.5px;color:#7C3AED;font-family:monospace;">${c.complaint_no}</div>
              ${c.assigned_to_name ? `<div style="font-size:10.5px;color:#9CA3AF;margin-top:2px;"><i class="fas fa-user-check" style="margin-right:3px;"></i>${c.assigned_to_name}</div>` : ''}
            </td>
            <td style="padding:12px 16px;">
              <div style="font-weight:600;font-size:12.5px;color:#111827;">${c.category}</div>
              ${c.sub_category ? `<div style="font-size:11px;color:#9CA3AF;">${c.sub_category}</div>` : ''}
            </td>
            <td style="padding:12px 16px;max-width:220px;">
              <div style="font-size:12.5px;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${c.description}">${c.description}</div>
            </td>
            ${isManager ? `<td style="padding:12px 16px;font-size:12px;color:#374151;">${c.reporter_name}<br/><span style="color:#9CA3AF;font-size:10.5px;">${c.reporter_dept||''}</span></td>` : ''}
            <td style="padding:12px 16px;text-align:center;">${icPriorityBadge(c.priority)}</td>
            <td style="padding:12px 16px;text-align:center;">${icStatusBadge(c.status)}</td>
            <td style="padding:12px 16px;font-size:11.5px;color:#6B7280;white-space:nowrap;">${formatDate(c.created_at)}</td>
            <td style="padding:12px 16px;text-align:center;">
              <button onclick="showInternalComplaintDetail(${c.id})"
                style="background:#F5F3FF;border:1px solid #DDD6FE;color:#7C3AED;border-radius:8px;padding:5px 10px;font-size:12px;cursor:pointer;font-weight:600;">
                <i class="fas fa-eye"></i>
              </button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
      </div>
    </div>`}
  </div>`
}

async function showRegisterInternalComplaint() {
  const catOpts = IC_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')
  showModal(`
    <div style="padding:0;">
      <div style="background:linear-gradient(135deg,#7C3AED,#4C1D95);padding:20px 24px;border-radius:14px 14px 0 0;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;background:rgba(255,255,255,0.15);border-radius:9px;display:flex;align-items:center;justify-content:center;">
            <i class="fas fa-comment-dots" style="color:white;font-size:16px;"></i>
          </div>
          <div style="color:white;">
            <div style="font-weight:700;font-size:15px;">Raise Internal Complaint</div>
            <div style="font-size:11px;opacity:.85;">Only visible to authorized staff</div>
          </div>
        </div>
        <button onclick="closeModal()" style="background:rgba(255,255,255,0.15);border:none;border-radius:8px;padding:6px 10px;cursor:pointer;color:white;font-size:14px;"><i class="fas fa-times"></i></button>
      </div>
      <div style="padding:22px 24px;display:flex;flex-direction:column;gap:14px;max-height:70vh;overflow-y:auto;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label class="form-label">Category *</label>
            <select id="icCat" class="form-input">${catOpts}</select>
          </div>
          <div>
            <label class="form-label">Sub-Category</label>
            <input id="icSubCat" class="form-input" placeholder="Optional detail…" />
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label class="form-label">Priority</label>
            <select id="icPriority" class="form-input">
              <option>Normal</option><option>Low</option><option>High</option><option>Urgent</option>
            </select>
          </div>
          <div>
            <label class="form-label">Photo (optional)</label>
            <input type="file" id="icPhoto" accept="image/*" class="form-input" style="padding:6px;"/>
          </div>
        </div>
        <div>
          <label class="form-label">Description *</label>
          <textarea id="icDesc" class="form-input" rows="4" placeholder="Describe the issue in detail — include location, impact, steps to reproduce if applicable…"></textarea>
        </div>
        <div style="display:flex;gap:10px;padding-top:4px;">
          <button onclick="submitInternalComplaint()" style="flex:1;padding:11px;background:linear-gradient(135deg,#7C3AED,#4C1D95);color:white;border:none;border-radius:10px;font-weight:700;font-size:13.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
            <i class="fas fa-paper-plane"></i>Submit Complaint
          </button>
          <button onclick="closeModal()" style="flex:0 0 auto;padding:11px 20px;border:1.5px solid #E5E7EB;border-radius:10px;background:white;color:#6B7280;cursor:pointer;font-weight:600;">Cancel</button>
        </div>
      </div>
    </div>
  `)
}

async function submitInternalComplaint() {
  const category    = document.getElementById('icCat').value
  const sub_category= document.getElementById('icSubCat').value.trim()
  const priority    = document.getElementById('icPriority').value
  const description = document.getElementById('icDesc').value.trim()
  const photoFile   = document.getElementById('icPhoto').files[0]
  if (!description) { toast('Description is required', 'error'); return }
  let photo_data = null
  if (photoFile) photo_data = await fileToBase64(photoFile)
  const r = await api('POST', '/internal-complaints', { category, sub_category: sub_category||null, priority, description, photo_data })
  if (r?.ok) {
    toast(`Internal complaint ${r.data.complaint_no} raised!`, 'success')
    closeModal(); loadInternalComplaints()
  } else toast(r?.data?.error || 'Failed to submit', 'error')
}

async function showInternalComplaintDetail(id) {
  const r = await api('GET', `/internal-complaints/${id}`)
  if (!r?.ok) { toast('Failed to load', 'error'); return }
  const { complaint: c, audit_trail } = r.data
  const isManager = ['admin','sub_admin'].includes(currentUser?.role)
  const isOwner   = c.reported_by_employee_id == currentUser?.id
  const isAssigned= c.assigned_to_employee_id == currentUser?.id
  const canAct    = isManager || isAssigned

  // Load employees for assignment dropdown (managers only)
  let empList = []
  if (isManager) {
    const er = await api('GET', '/employees?limit=100')
    empList = (er?.data?.employees || []).filter(e => e.is_active)
  }

  const sStyle = IC_STATUS_STYLE[c.status] || IC_STATUS_STYLE['Pending']

  showModal(`
    <div style="padding:0;">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#7C3AED,#4C1D95);padding:18px 22px;border-radius:14px 14px 0 0;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;background:rgba(255,255,255,0.15);border-radius:9px;display:flex;align-items:center;justify-content:center;">
            <i class="fas fa-comment-dots" style="color:white;font-size:16px;"></i>
          </div>
          <div style="color:white;">
            <div style="font-weight:700;font-size:15px;font-family:monospace;">${c.complaint_no}</div>
            <div style="font-size:11px;opacity:.85;">${c.category}${c.sub_category?' · '+c.sub_category:''}</div>
          </div>
        </div>
        <button onclick="closeModal()" style="background:rgba(255,255,255,0.15);border:none;border-radius:8px;padding:6px 10px;cursor:pointer;color:white;font-size:14px;"><i class="fas fa-times"></i></button>
      </div>

      <div style="padding:20px 22px;max-height:72vh;overflow-y:auto;display:flex;flex-direction:column;gap:16px;">

        <!-- Status + priority row -->
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          ${icStatusBadge(c.status)}
          ${icPriorityBadge(c.priority)}
          <span style="font-size:11.5px;color:#9CA3AF;margin-left:auto;">${formatDateTime(c.created_at)}</span>
        </div>

        <!-- Meta grid -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div style="background:#F9FAFB;border-radius:10px;padding:12px;">
            <div style="font-size:10.5px;color:#9CA3AF;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Reported By</div>
            <div style="font-weight:700;font-size:13px;color:#111827;">${c.reporter_name}</div>
            <div style="font-size:11.5px;color:#6B7280;">${c.reporter_dept||''}</div>
          </div>
          <div style="background:#F9FAFB;border-radius:10px;padding:12px;">
            <div style="font-size:10.5px;color:#9CA3AF;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Assigned To</div>
            <div style="font-weight:700;font-size:13px;color:#111827;">${c.assigned_to_name || '—'}</div>
            <div style="font-size:11.5px;color:#6B7280;">${c.assigned_at ? formatDate(c.assigned_at) : ''}</div>
          </div>
        </div>

        <!-- Description -->
        <div style="background:#F9F7FF;border:1px solid #DDD6FE;border-radius:10px;padding:14px;">
          <div style="font-size:10.5px;color:#7C3AED;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px;">Description</div>
          <div style="font-size:13px;color:#374151;line-height:1.65;">${c.description}</div>
        </div>

        <!-- Photo -->
        ${c.photo_data ? `
        <div>
          <div style="font-size:10.5px;color:#9CA3AF;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px;">Attachment</div>
          <img src="${c.photo_data}" style="max-width:100%;border-radius:10px;border:1px solid #E5E7EB;max-height:200px;object-fit:cover;"/>
        </div>` : ''}

        <!-- Resolution notes -->
        ${c.resolution_notes ? `
        <div style="background:#F0FDF4;border:1px solid #86EFAC;border-radius:10px;padding:14px;">
          <div style="font-size:10.5px;color:#15803D;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px;"><i class="fas fa-check-circle" style="margin-right:5px;"></i>Resolution Notes</div>
          <div style="font-size:13px;color:#374151;">${c.resolution_notes}</div>
          ${c.resolved_at ? `<div style="font-size:11px;color:#9CA3AF;margin-top:6px;">Resolved: ${formatDateTime(c.resolved_at)} by ${c.resolved_by_name||'—'}</div>` : ''}
        </div>` : ''}

        <!-- Actions -->
        ${isManager && c.status === 'Pending' ? `
        <div style="border:1.5px solid #DDD6FE;border-radius:10px;padding:14px;background:#F9F7FF;">
          <div style="font-weight:700;font-size:12.5px;margin-bottom:10px;color:#7C3AED;"><i class="fas fa-user-check" style="margin-right:6px;"></i>Assign to Employee</div>
          <div style="display:flex;gap:8px;">
            <select id="icAssignEmpId" class="form-input" style="flex:1;">
              <option value="">Select employee…</option>
              ${empList.map(e => `<option value="${e.id}" ${e.id==c.assigned_to_employee_id?'selected':''}>${e.name} (${e.role})</option>`).join('')}
            </select>
            <button onclick="assignInternalComplaint(${c.id})" class="btn-primary btn-sm">Assign</button>
          </div>
        </div>` : ''}

        ${canAct && c.status !== 'Resolved' ? `
        <div style="border:1.5px solid #A7F3D0;border-radius:10px;padding:14px;background:#F0FDF4;">
          <div style="font-weight:700;font-size:12.5px;margin-bottom:10px;color:#065F46;"><i class="fas fa-check-double" style="margin-right:6px;"></i>Update Status</div>
          <div style="display:flex;gap:8px;margin-bottom:10px;">
            ${c.status !== 'In-Progress' ? `<button onclick="updateICStatus(${c.id},'In-Progress')" style="flex:1;padding:8px;background:#EFF6FF;border:1px solid #BFDBFE;color:#1D4ED8;border-radius:9px;font-weight:600;font-size:12px;cursor:pointer;">
              <i class="fas fa-spinner" style="margin-right:5px;"></i>Mark In-Progress
            </button>` : ''}
            <button onclick="document.getElementById('icResNotesWrap').style.display='block'" style="flex:1;padding:8px;background:#D1FAE5;border:1px solid #6EE7B7;color:#065F46;border-radius:9px;font-weight:600;font-size:12px;cursor:pointer;">
              <i class="fas fa-check" style="margin-right:5px;"></i>Mark Resolved
            </button>
          </div>
          <div id="icResNotesWrap" style="display:none;">
            <textarea id="icResNotes" class="form-input" rows="2" placeholder="Resolution notes (optional)…" style="margin-bottom:8px;"></textarea>
            <button onclick="updateICStatus(${c.id},'Resolved')" style="width:100%;padding:9px;background:linear-gradient(135deg,#10B981,#065F46);color:white;border:none;border-radius:9px;font-weight:700;cursor:pointer;">
              <i class="fas fa-check-circle" style="margin-right:6px;"></i>Confirm Resolved
            </button>
          </div>
        </div>` : ''}

        <!-- Audit trail -->
        ${audit_trail?.length ? `
        <div>
          <div style="font-weight:700;font-size:12.5px;color:#374151;margin-bottom:10px;"><i class="fas fa-history" style="color:#7C3AED;margin-right:6px;"></i>Activity Timeline</div>
          <div class="timeline">
            ${audit_trail.map(a => `
            <div class="timeline-item">
              <div style="font-size:12.5px;font-weight:600;color:#374151;">${a.description}</div>
              <div style="font-size:11px;color:#9CA3AF;margin-top:2px;">${formatDateTime(a.created_at)} &bull; ${a.actor_name||'System'}</div>
            </div>`).join('')}
          </div>
        </div>` : ''}

      </div>
    </div>
  `)
}

async function assignInternalComplaint(id) {
  const empId = document.getElementById('icAssignEmpId')?.value
  if (!empId) { toast('Select an employee', 'error'); return }
  const r = await api('POST', `/internal-complaints/${id}/assign`, { employee_id: parseInt(empId) })
  if (r?.ok) { toast(r.data.message, 'success'); closeModal(); loadInternalComplaints() }
  else toast(r?.data?.error || 'Failed', 'error')
}

async function updateICStatus(id, status) {
  const resolution_notes = document.getElementById('icResNotes')?.value || ''
  const r = await api('PATCH', `/internal-complaints/${id}/status`, { status, resolution_notes: resolution_notes || undefined })
  if (r?.ok) { toast(`Status updated to ${status}`, 'success'); closeModal(); loadInternalComplaints() }
  else toast(r?.data?.error || 'Failed', 'error')
}

// ── Modal ─────────────────────────────────────────────────────
function showModal(content) {
  const existing = document.getElementById('modalOverlay')
  if (existing) existing.remove()
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.id = 'modalOverlay'
  overlay.innerHTML = `<div class="modal" style="padding:0;">${content}</div>`
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal() })
  document.body.appendChild(overlay)
}

function closeModal() {
  const el = document.getElementById('modalOverlay')
  if (el) el.remove()
}

// ── Init ──────────────────────────────────────────────────────
window.addEventListener('load', boot)

// Expose all functions to global scope
Object.assign(window, {
  navigate, logout, doLogin, switchLoginTab, togglePwd, onSearch, markAllRead,
  toggleSidebar, closeSidebar, mbnNav,
  showComplaintDetail, assignComplaint, scheduleVisit, resolveComplaint, closeComplaint,
  showRegisterComplaint, submitComplaint, filterComplaints, onCategoryChange,
  showUnitDetail, filterUnits, showRegisterComplaintForUnit, showAddComplaintForUnit: showRegisterComplaintForUnit,
  showCustomerDetail, showEditCustomer, showAddCustomer, addCustomer, updateCustomer, deleteCustomer,
  showAddTenant, addTenant, searchCustomers,
  uploadKyc, submitKyc, showKycTab, filterKycTable,
  openManageKyc, openKycUploadModal, submitKycFromModal,
  switchKycManageTab, toggleDocHistory, viewDocumentImage,
  navigateToManageKyc_owner, navigateToManageKyc_tenant,
  showAddEmployee, addEmployee, showEditEmployee, updateEmployee, showEmpDetails, showResetEmpPwd, resetEmpPwd,
  showModal, closeModal, loadKycTracker,
  // Calendar
  loadCalendar, switchCalView, calNavMonth, calNavWeek, showDayDetail, showApplyLeaveModal, submitLeaveApplication,
  // Leave
  loadLeaveManagement, filterLeaves, reviewLeave, cancelLeave,
  // Vehicles
  loadVehicles, showAddVehicleModal, submitVehicle, showVehicleDetail, showEditVehicle, updateVehicle, removeVehicle,
  viewRcDocument, filterVehicles, loadUnitResidents, previewRc, previewRcEdit,
  // Complaints Master
  loadComplaintsMaster,
  showAddCategoryModal, submitAddCategory,
  showEditCategoryModal, submitEditCategory, confirmDeleteCategory,
  showAddSubCategoryModal, submitAddSubCategory,
  showEditSubCategoryModal, submitEditSubCategory, confirmDeleteSubCategory,
  // Unit Status
  showUnitStatusModal, submitUnitStatus,
  // Internal Complaints
  loadInternalComplaints, showRegisterInternalComplaint, submitInternalComplaint,
  showInternalComplaintDetail, assignInternalComplaint, updateICStatus
})
