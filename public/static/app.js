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

function particularsBadge(p) {
  const s = p?.toLowerCase()
  let cls = 'badge-vacant'
  if (s?.includes('occupied')) cls = 'badge-occupied'
  if (s?.includes('construction')) cls = 'badge-construction'
  return `<span class="${cls} px-2 py-1 rounded-full text-xs font-semibold">${p || 'Unknown'}</span>`
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
  <div style="min-height:100vh;display:flex;background:#F5EDEB;">

    <!-- LEFT BRANDING PANEL -->
    <div style="flex:1;background:linear-gradient(160deg,#1A0505 0%,#2D0808 35%,#4A1010 70%,#3D0E0E 100%);
      display:none;flex-direction:column;justify-content:center;align-items:center;
      padding:48px 40px;position:relative;overflow:hidden;" class="hidden lg:flex">
      <!-- Decorative glows -->
      <div style="position:absolute;top:-60px;right:-60px;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,rgba(232,67,26,0.15),transparent 70%);"></div>
      <div style="position:absolute;bottom:-80px;left:-40px;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,rgba(201,133,58,0.1),transparent 70%);"></div>
      <div style="position:absolute;top:60%;right:10%;width:150px;height:150px;border-radius:50%;background:rgba(255,255,255,0.03);"></div>

      <!-- Logo -->
      <div style="position:relative;z-index:2;text-align:center;">
        <img src="/static/emperium-logo.png" alt="Emperium City" style="width:180px;display:block;margin:0 auto 24px;filter:drop-shadow(0 8px 24px rgba(232,67,26,0.4))"/>
        <h1 style="color:white;font-size:26px;font-weight:800;margin-bottom:10px;">Grievance Redressal System</h1>
        <p style="color:rgba(255,255,255,0.45);font-size:13.5px;line-height:1.7;max-width:320px;margin:0 auto;">
          Streamlined complaint management for Emperium City residents &amp; facility staff.
        </p>

        <!-- Stats row -->
        <div style="display:flex;gap:32px;margin-top:40px;justify-content:center;">
          ${[['213','Total Units'],['5','Departments'],['24/7','Support'],['Fast','Resolution']].map(([num,lbl])=>`
          <div style="text-align:center;">
            <div style="font-size:22px;font-weight:800;color:#E8431A;">${num}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:4px;">${lbl}</div>
          </div>`).join('')}
        </div>

        <!-- Feature pills -->
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:32px;justify-content:center;">
          ${[['fa-bolt','Real-time Tracking'],['fa-shield-alt','Secure Portal'],['fa-calendar-check','Visit Scheduling'],['fa-car','Vehicle Registry']].map(([ic,lbl])=>`
          <div style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:6px 14px;font-size:12px;color:rgba(255,255,255,0.6);display:flex;align-items:center;gap:6px;">
            <i class="fas ${ic}" style="color:#E8431A;"></i>${lbl}
          </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- RIGHT LOGIN PANEL -->
    <div style="width:min(100%,460px);min-height:100vh;background:white;display:flex;flex-direction:column;
      justify-content:center;align-items:center;padding:40px 36px;
      box-shadow:-4px 0 40px rgba(0,0,0,0.08);">

      <!-- Mobile logo (shown on small screens) -->
      <div class="lg:hidden" style="text-align:center;margin-bottom:28px;">
        <img src="/static/emperium-logo.png" alt="Emperium" style="width:120px;margin:0 auto 8px;display:block;"/>
        <p style="font-size:11px;color:#9CA3AF;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">Grievance Redressal System</p>
      </div>

      <div style="width:100%;max-width:360px;">
        <!-- Header -->
        <div style="margin-bottom:28px;">
          <h2 style="font-size:24px;font-weight:800;color:#111827;margin-bottom:6px;">Welcome back</h2>
          <p style="color:#9CA3AF;font-size:13.5px;">Sign in to access your GRS portal</p>
        </div>

        <!-- Tab switcher -->
        <div style="display:flex;background:#F5EDEB;border-radius:12px;padding:4px;margin-bottom:24px;gap:4px;">
          <button id="tabCust" onclick="switchLoginTab('customer')"
            style="flex:1;padding:9px 16px;border-radius:9px;border:none;font-size:13px;font-weight:600;
            cursor:pointer;transition:all 0.2s;background:linear-gradient(135deg,#E8431A,#8B1A1A);color:white;
            box-shadow:0 2px 8px rgba(232,67,26,0.32);">
            <i class="fas fa-user" style="margin-right:6px;"></i>Resident
          </button>
          <button id="tabEmp" onclick="switchLoginTab('employee')"
            style="flex:1;padding:9px 16px;border-radius:9px;border:none;font-size:13px;font-weight:600;
            cursor:pointer;transition:all 0.2s;background:transparent;color:#6B7280;">
            <i class="fas fa-user-tie" style="margin-right:6px;"></i>Staff
          </button>
        </div>

        <div id="loginType" style="display:none;">customer</div>

        <!-- Login form -->
        <form onsubmit="doLogin(event)">
          <div style="margin-bottom:16px;">
            <label class="form-label">Email Address</label>
            <div style="position:relative;">
              <i class="fas fa-envelope" style="position:absolute;left:13px;top:50%;transform:translateY(-50%);color:#C4B5B0;font-size:13px;"></i>
              <input id="loginEmail" type="email" autocomplete="email" class="form-input"
                style="padding-left:38px;" placeholder="your@email.com" required/>
            </div>
          </div>
          <div style="margin-bottom:22px;">
            <label class="form-label">Password</label>
            <div style="position:relative;">
              <i class="fas fa-lock" style="position:absolute;left:13px;top:50%;transform:translateY(-50%);color:#C4B5B0;font-size:13px;"></i>
              <input id="loginPwd" type="password" autocomplete="current-password" class="form-input"
                style="padding-left:38px;padding-right:42px;" placeholder="Enter password" required/>
              <button type="button" onclick="togglePwd()" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#C4B5B0;font-size:14px;">
                <i class="fas fa-eye" id="pwdIcon"></i>
              </button>
            </div>
          </div>
          <button type="submit" class="btn-primary" style="width:100%;justify-content:center;padding:11px;font-size:14px;border-radius:11px;">
            <i class="fas fa-sign-in-alt"></i>Sign In
          </button>
        </form>

        <!-- Demo credentials -->
        <div style="margin-top:24px;background:#FFF5F2;border:1px solid #FDDDD4;border-radius:12px;padding:14px 16px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <div style="width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#E8431A,#8B1A1A);display:flex;align-items:center;justify-content:center;">
              <i class="fas fa-info" style="color:white;font-size:10px;"></i>
            </div>
            <span style="font-weight:700;font-size:12px;color:#8B1A1A;">Demo Credentials</span>
          </div>
          <div style="display:grid;gap:6px;">
            ${[['Admin','admin@emperiumcity.com','Admin@123'],['Sub-Admin','subadmin@emperiumcity.com','SubAdmin@123'],['Employee','rajesh@emperiumcity.com','Emp@123'],['Resident','kapoorminakshi124@gmail.com','Customer@123']].map(([role,email,pwd])=>`
            <div onclick="document.getElementById('loginEmail').value='${email}';document.getElementById('loginPwd').value='${pwd}';" style="cursor:pointer;display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:7px;transition:background 0.15s;" onmouseover="this.style.background='rgba(232,67,26,0.06)'" onmouseout="this.style.background='transparent'">
              <span style="font-size:10px;font-weight:700;color:#E8431A;background:#FEE2D5;border-radius:4px;padding:2px 6px;min-width:60px;text-align:center;">${role}</span>
              <span style="font-size:11.5px;color:#4B5563;font-family:monospace;">${email}</span>
            </div>`).join('')}
          </div>
          <p style="font-size:10.5px;color:#9CA3AF;margin-top:8px;text-align:center;">Click any row to auto-fill credentials</p>
        </div>

        <!-- Footer -->
        <p style="text-align:center;font-size:11px;color:#C4B5B0;margin-top:20px;">
          &copy; 2026 Emperium City &bull; GRS Portal v2.0
        </p>
      </div>
    </div>
  </div>`
}

function switchLoginTab(type) {
  document.getElementById('loginType').textContent = type
  const isCust = type === 'customer'
  const activeStyle = 'background:linear-gradient(135deg,#E8431A,#8B1A1A);color:white;box-shadow:0 2px 8px rgba(232,67,26,0.32);'
  const inactiveStyle = 'background:transparent;color:#6B7280;box-shadow:none;'
  document.getElementById('tabCust').style.cssText = document.getElementById('tabCust').style.cssText.replace(/background:[^;]+;|color:[^;]+;|box-shadow:[^;]+;/g,'') + (isCust ? activeStyle : inactiveStyle)
  document.getElementById('tabEmp').style.cssText = document.getElementById('tabEmp').style.cssText.replace(/background:[^;]+;|color:[^;]+;|box-shadow:[^;]+;/g,'') + (!isCust ? activeStyle : inactiveStyle)
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
  <div class="app-shell">
    <!-- ═══ SIDEBAR ══════════════════════════════════════════ -->
    <aside class="sidebar" id="sidebar">
      <!-- Logo -->
      <div class="sidebar-logo">
        <img src="/static/emperium-logo.png" alt="Emperium City" style="width:150px;margin:0 auto 10px;display:block;filter:brightness(1.05)"/>
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
        <div class="topbar-search">
          <i class="fas fa-search search-icon"></i>
          <input type="text" id="globalSearch"
            placeholder="Search units, residents, complaints..."
            oninput="onSearch(this.value)"/>
          <div id="searchDropdown" class="hidden"></div>
        </div>
        <div class="topbar-right">
          <div class="topbar-date">
            <i class="fas fa-calendar mr-1.5" style="color:#E8431A"></i>${dayjs().format('ddd, D MMM YYYY')}
          </div>
          <button onclick="navigate('notifications')" class="notif-btn" title="Notifications">
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
  </div>`

  navigate('dashboard')
  loadNotifCount()
}

function navItem(page, label, icon) {
  return `<a href="#" onclick="navigate('${page}'); return false;" id="nav-${page}" class="nav-item">
    <i class="fas ${icon} nav-icon"></i><span>${label}</span>
  </a>`
}

function setActiveNav(page) {
  document.querySelectorAll('#mainNav .nav-item').forEach(a => a.classList.remove('active'))
  const el = document.getElementById('nav-' + page)
  if (el) el.classList.add('active')
}

function navigate(page, params = {}) {
  currentPage = page
  setActiveNav(page)
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
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:20px;">
    <div class="stat-card sc-flame">
      <i class="fas fa-building stat-icon"></i>
      <div class="stat-number">${us.total_units || 0}</div>
      <div class="stat-label">Total Units</div>
      <div class="stat-sub">${us.occupied || 0} Occupied &bull; ${us.vacant || 0} Vacant</div>
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
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;">
        ${[['Open','open_count','#F59E0B','#FFF3E0'],['Assigned','assigned_count','#3B82F6','#EFF6FF'],['Scheduled','scheduled_count','#8B5CF6','#F5F3FF'],['Resolved','resolved_count','#10B981','#ECFDF5'],['Closed','closed_count','#6B7280','#F9FAFB']].map(([label,key,color,bg]) => `
        <div style="text-align:center;padding:14px 8px;border-radius:12px;background:${bg};border:1.5px solid ${color}22;">
          <div style="font-size:24px;font-weight:800;color:${color};">${cs[key] || 0}</div>
          <div style="font-size:11px;font-weight:600;color:${color};margin-top:4px;">${label}</div>
        </div>`).join('')}
      </div>
    </div>
  </div>

  <!-- Bottom Grid -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
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
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px;">
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
  <div style="display:grid;grid-template-columns:300px 1fr;gap:20px;margin-bottom:20px;">
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
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
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

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;">
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
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
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

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
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

  const occupied = units.filter(u => u.particulars?.toUpperCase().includes('OCCUPIED')).length
  const vacant = units.filter(u => u.particulars?.toUpperCase().includes('VACANT')).length
  const construction = units.filter(u => u.particulars?.toUpperCase().includes('CONSTRUCTION')).length

  document.getElementById('pageContent').innerHTML = `
  <div class="page-header">
    <div class="page-title">
      <div class="page-title-icon"><i class="fas fa-building"></i></div>
      <div>
        <div>Unit Registry</div>
        <div class="page-subtitle">${total} units &bull; ${occupied} occupied &bull; ${vacant} vacant</div>
      </div>
    </div>
    <div class="page-actions">
      <div style="position:relative;">
        <i class="fas fa-search" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:#C4B5B0;font-size:12px;"></i>
        <input type="text" id="unitSearch" placeholder="Search unit, owner..." class="form-input" style="width:200px;padding-left:32px;" oninput="filterUnits(this.value)"/>
      </div>
      <select id="unitFilter" onchange="filterUnits(document.getElementById('unitSearch').value)" class="filter-select">
        <option value="">All Status</option>
        <option value="occupied">Occupied</option>
        <option value="vacant">Vacant</option>
        <option value="construction">Under Construction</option>
      </select>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px;">
    ${[['Total Units',total,'sc-flame','fa-building'],['Occupied',occupied,'sc-green','fa-user-check'],['Vacant',vacant,'sc-teal','fa-door-open'],['Under Const.',construction,'sc-gold','fa-hard-hat']].map(([l,v,cls,ic]) => `
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
  return units.map(u => `
  <tr class="table-row border-t">
    <td class="px-4 py-3 font-bold text-blue-900 cursor-pointer hover:underline" onclick="showUnitDetail('${u.unit_no}')">Unit ${u.unit_no}</td>
    <td class="px-4 py-3">
      <div class="font-medium">${u.owner_name || '—'}</div>
      <div class="text-xs text-gray-400">${u.owner_mobile || ''}</div>
    </td>
    <td class="px-4 py-3 hidden md:table-cell">
      ${u.tenant_name ? `<div class="text-sm">${u.tenant_name}</div><div class="text-xs text-orange-400">${u.tenancy_expiry ? 'Exp: '+formatDate(u.tenancy_expiry) : ''}</div>` : '<span class="text-gray-300">—</span>'}
    </td>
    <td class="px-4 py-3">${particularsBadge(u.particulars)}</td>
    <td class="px-4 py-3 text-gray-500 hidden md:table-cell">${u.billing_area} ${u.area_unit}</td>
    <td class="px-4 py-3">
      <button onclick="showUnitDetail('${u.unit_no}')" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-eye"></i></button>
      <button onclick="showAddComplaintForUnit(${u.id},'${u.unit_no}')" class="text-orange-500 hover:text-orange-700"><i class="fas fa-exclamation-circle"></i></button>
    </td>
  </tr>`).join('')
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

async function showUnitDetail(unitNo) {
  const r = await api('GET', `/units/${unitNo}`)
  if (!r?.ok) { toast('Unit not found', 'error'); return }
  const { unit, owner, tenant, owner_kyc, tenant_kyc, complaint_stats, property_history } = r.data

  const isAdmin = ['admin', 'sub_admin'].includes(currentUser.role)

  showModal(`
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-xl font-bold text-gray-800"><i class="fas fa-home mr-2 text-blue-600"></i>Unit ${unit.unit_no}</h2>
    <button onclick="closeModal()" class="text-gray-400"><i class="fas fa-times text-xl"></i></button>
  </div>

  <div class="flex gap-2 mb-4">
    ${particularsBadge(unit.particulars)}
    <span class="text-gray-500 text-sm">${unit.billing_area} ${unit.area_unit}</span>
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
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
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
async function loadComplaintsMaster() {
  const content = document.getElementById('pageContent')
  content.innerHTML = `<div class="loading"><div class="spinner"></div></div>`

  const [catR, subCatR] = await Promise.all([
    api('GET', '/complaints/categories/list'),
    api('GET', '/complaints/sub-categories/list')
  ])
  const categories = catR?.data?.categories || []
  const subCategories = subCatR?.data?.sub_categories || []
  const subByCat = {}
  subCategories.forEach(sc => { if (!subByCat[sc.category_id]) subByCat[sc.category_id] = []; subByCat[sc.category_id].push(sc) })

  const catIcons = { Plumbing:'fa-tint', Electricity:'fa-bolt', Civil:'fa-hammer', Billing:'fa-receipt', Miscellaneous:'fa-ellipsis-h' }
  const catColors = { Plumbing:'blue', Electricity:'yellow', Civil:'green', Billing:'purple', Miscellaneous:'gray' }

  const catColorMap = {
    Plumbing:   { bg:'#EFF6FF', border:'#BFDBFE', icon:'#2563EB', badge:'#DBEAFE', badgeText:'#1E40AF' },
    Electricity:{ bg:'#FFFBEB', border:'#FDE68A', icon:'#D97706', badge:'#FEF3C7', badgeText:'#92400E' },
    Civil:      { bg:'#ECFDF5', border:'#A7F3D0', icon:'#059669', badge:'#D1FAE5', badgeText:'#065F46' },
    Billing:    { bg:'#F5F3FF', border:'#DDD6FE', icon:'#7C3AED', badge:'#EDE9FE', badgeText:'#4C1D95' },
    Miscellaneous:{ bg:'#FFF5F3', border:'#FDDDD4', icon:'#E8431A', badge:'#FEE2D5', badgeText:'#7C2D12' }
  }
  content.innerHTML = `
  <div style="display:flex;flex-direction:column;gap:18px;">
    <div class="page-header">
      <div class="page-title">
        <div class="page-title-icon"><i class="fas fa-layer-group"></i></div>
        <div>
          <div>Complaints Master</div>
          <div class="page-subtitle">${categories.length} complaint types &bull; ${subCategories.length} sub-types configured</div>
        </div>
      </div>
      <button onclick="showRegisterComplaint()" class="btn-primary"><i class="fas fa-plus"></i>Register Complaint</button>
    </div>

    <!-- Category overview cards -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;">
      ${categories.map(cat => {
        const subs = subByCat[cat.id] || []
        const c = catColorMap[cat.name] || catColorMap.Miscellaneous
        const icon = catIcons[cat.name] || 'fa-exclamation-circle'
        return `<div style="background:${c.bg};border:1.5px solid ${c.border};border-radius:12px;padding:14px;text-align:center;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
          <div style="width:36px;height:36px;border-radius:10px;background:white;display:flex;align-items:center;justify-content:center;margin:0 auto 8px;box-shadow:0 1px 6px rgba(0,0,0,0.08);">
            <i class="fas ${icon}" style="color:${c.icon};font-size:15px;"></i>
          </div>
          <div style="font-weight:700;font-size:12.5px;color:#111827;">${cat.name}</div>
          <div style="margin-top:5px;padding:2px 8px;background:${c.badge};color:${c.badgeText};border-radius:20px;font-size:10.5px;font-weight:700;display:inline-block;">${subs.length} sub-types</div>
        </div>`
      }).join('')}
    </div>

    <!-- Detailed category cards -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
      ${categories.map(cat => {
        const subs = subByCat[cat.id] || []
        const c = catColorMap[cat.name] || catColorMap.Miscellaneous
        const icon = catIcons[cat.name] || 'fa-exclamation-circle'
        return `<div class="card">
          <div style="background:${c.bg};border-bottom:1px solid ${c.border};padding:14px 18px;border-radius:14px 14px 0 0;display:flex;align-items:center;gap:10px;">
            <div style="width:34px;height:34px;border-radius:9px;background:white;display:flex;align-items:center;justify-content:center;">
              <i class="fas ${icon}" style="color:${c.icon};"></i>
            </div>
            <div>
              <div style="font-weight:700;color:#111827;font-size:14px;">${cat.name}</div>
              <div style="font-size:11px;color:#6B7280;">${subs.length} sub-type(s)</div>
            </div>
          </div>
          <div style="padding:12px 18px;">
            ${subs.length === 0 ? `<p style="color:#9CA3AF;font-size:12.5px;text-align:center;padding:12px;">No sub-types configured</p>` :
              subs.map((sc,i) => `<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-radius:8px;background:${i%2===0?c.bg:'transparent'};margin-bottom:3px;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="width:20px;height:20px;background:${c.badge};color:${c.badgeText};border-radius:50%;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i+1}</span>
                  <span style="font-size:12.5px;color:#374151;font-weight:500;">${sc.name}</span>
                </div>
                <span style="font-size:10.5px;color:#10B981;font-weight:600;"><i class="fas fa-check-circle" style="margin-right:3px;"></i>Active</span>
              </div>`).join('')}
          </div>
        </div>`
      }).join('')}
    </div>

    <!-- How-to guide -->
    <div class="card" style="padding:18px 22px;border-left:4px solid #E8431A;">
      <div style="font-weight:700;color:#111827;margin-bottom:10px;font-size:13.5px;"><i class="fas fa-info-circle" style="color:#E8431A;margin-right:8px;"></i>How to Register a Complaint</div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;">
        ${[['1','fa-layer-group','Select Type','Choose the main complaint category'],['2','fa-list','Sub-Type','Pick a specific sub-type'],['3','fa-align-left','Describe','Add detailed description'],['4','fa-image','Photo','Optionally attach a photo'],['5','fa-flag','Priority','Set urgency level']].map(([num,ic,lbl,desc])=>`
        <div style="text-align:center;padding:12px 8px;background:#FFF5F3;border-radius:10px;">
          <div style="width:28px;height:28px;background:linear-gradient(135deg,#E8431A,#8B1A1A);border-radius:50%;color:white;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;margin:0 auto 6px;">${num}</div>
          <i class="fas ${ic}" style="color:#E8431A;font-size:14px;margin-bottom:5px;display:block;"></i>
          <div style="font-weight:700;font-size:11.5px;color:#111827;">${lbl}</div>
          <div style="font-size:10.5px;color:#9CA3AF;margin-top:2px;">${desc}</div>
        </div>`).join('')}
      </div>
    </div>
  </div>`
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
  loadComplaintsMaster
})
