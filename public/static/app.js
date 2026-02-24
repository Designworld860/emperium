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

async function api(method, path, data) {
  try {
    const opts = { method, headers: authHeaders() }
    if (data) opts.body = JSON.stringify(data)
    const r = await fetch(API + path, opts)
    const json = await r.json()
    if (r.status === 401) { logout(); return null }
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
    const r = await api('GET', '/auth/me')
    if (r?.ok) {
      currentUser = r.data.user
      saveUser(currentUser)
      showApp()
    } else {
      showLogin()
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
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700">
    <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
      <div class="text-center mb-6">
        <div class="w-16 h-16 bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
          <i class="fas fa-building text-yellow-400 text-2xl"></i>
        </div>
        <h1 class="text-2xl font-bold text-gray-800">Emperium City</h1>
        <p class="text-gray-500 text-sm mt-1">Grievance Redressal System</p>
      </div>

      <div class="flex bg-gray-100 rounded-xl p-1 mb-6">
        <button id="tabCust" onclick="switchLoginTab('customer')"
          class="flex-1 py-2 rounded-lg text-sm font-semibold transition-all bg-blue-900 text-white">
          <i class="fas fa-user mr-1"></i> Resident
        </button>
        <button id="tabEmp" onclick="switchLoginTab('employee')"
          class="flex-1 py-2 rounded-lg text-sm font-semibold transition-all text-gray-600">
          <i class="fas fa-user-tie mr-1"></i> Staff
        </button>
      </div>

      <div id="loginType" class="hidden">customer</div>

      <form onsubmit="doLogin(event)" class="space-y-4">
        <div>
          <label class="form-label">Email Address</label>
          <input id="loginEmail" type="email" class="form-input" placeholder="Enter your email" required/>
        </div>
        <div>
          <label class="form-label">Password</label>
          <div class="relative">
            <input id="loginPwd" type="password" class="form-input pr-10" placeholder="Enter password" required/>
            <button type="button" onclick="togglePwd()" class="absolute right-3 top-2 text-gray-400">
              <i class="fas fa-eye" id="pwdIcon"></i>
            </button>
          </div>
        </div>
        <button type="submit" class="btn-primary w-full py-3 text-center rounded-xl">
          <i class="fas fa-sign-in-alt mr-2"></i>Sign In
        </button>
      </form>

      <div class="mt-6 p-4 bg-blue-50 rounded-xl text-xs text-gray-600">
        <p class="font-semibold mb-2">Demo Credentials:</p>
        <p><strong>Admin:</strong> admin@emperiumcity.com / Admin@123</p>
        <p><strong>Sub-Admin:</strong> subadmin@emperiumcity.com / SubAdmin@123</p>
        <p><strong>Employee:</strong> rajesh@emperiumcity.com / Emp@123</p>
        <p><strong>Resident:</strong> kapoorminakshi124@gmail.com / Customer@123</p>
      </div>
    </div>
  </div>`
}

function switchLoginTab(type) {
  document.getElementById('loginType').textContent = type
  const isCust = type === 'customer'
  document.getElementById('tabCust').className = `flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${isCust ? 'bg-blue-900 text-white' : 'text-gray-600'}`
  document.getElementById('tabEmp').className = `flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${!isCust ? 'bg-blue-900 text-white' : 'text-gray-600'}`
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

  document.getElementById('app').innerHTML = `
  <div class="flex h-screen overflow-hidden">
    <!-- Sidebar -->
    <aside class="sidebar w-64 flex-shrink-0 flex flex-col" id="sidebar">
      <div class="sidebar-logo">
        <div class="flex items-center gap-2">
          <div class="w-10 h-10 bg-yellow-400 rounded-lg flex items-center justify-center">
            <i class="fas fa-building text-blue-900 text-lg"></i>
          </div>
          <div>
            <div class="text-white font-bold text-sm">Emperium City</div>
            <div class="text-blue-300 text-xs">GRS Portal</div>
          </div>
        </div>
      </div>

      <nav class="flex-1 px-3 space-y-1 overflow-y-auto py-2">
        ${navItem('dashboard','Dashboard','fa-tachometer-alt')}
        ${navItem('complaints','Complaints','fa-exclamation-circle')}
        ${isEmp ? navItem('units','Unit Registry','fa-home') : ''}
        ${isEmp ? navItem('customers','Customer Master','fa-users') : ''}
        ${isEmp ? navItem('kyc-tracker','KYC Tracker','fa-id-card') : ''}
        ${(isAdmin || isSubAdmin) ? navItem('employees','Employees','fa-user-tie') : ''}
        ${navItem('notifications','Notifications','fa-bell')}
        ${(isAdmin || isSubAdmin) ? navItem('audit','Audit Trail','fa-history') : ''}
      </nav>

      <div class="border-t border-blue-800 p-3">
        <div class="flex items-center gap-3 p-2 rounded-lg bg-blue-800">
          <div class="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-blue-900 font-bold text-sm">
            ${(currentUser.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-white text-xs font-semibold truncate">${currentUser.name}</div>
            <div class="text-blue-300 text-xs truncate">${currentUser.role || currentUser.type}</div>
          </div>
          <button onclick="logout()" class="text-blue-300 hover:text-white" title="Logout">
            <i class="fas fa-sign-out-alt"></i>
          </button>
        </div>
        ${isCust ? `<div class="text-blue-300 text-xs mt-2 text-center">Unit ${currentUser.unit_no}</div>` : ''}
      </div>
    </aside>

    <!-- Main content -->
    <main class="flex-1 overflow-y-auto flex flex-col">
      <!-- Top bar -->
      <header class="bg-white border-b px-6 py-3 flex items-center gap-4 sticky top-0 z-10">
        <div class="flex-1 relative">
          <input type="text" id="globalSearch" placeholder="Search units, residents, complaints..."
            class="form-input pl-10 max-w-md" oninput="onSearch(this.value)"/>
          <i class="fas fa-search absolute left-3 top-2.5 text-gray-400"></i>
          <div id="searchDropdown" class="hidden absolute top-full mt-1 bg-white border rounded-xl shadow-lg w-full max-w-md z-50 max-h-72 overflow-y-auto"></div>
        </div>
        <button onclick="navigate('notifications')" class="relative text-gray-500 hover:text-blue-900 text-lg p-2">
          <i class="fas fa-bell"></i>
          <span id="notifBadge" class="hidden notification-dot"></span>
        </button>
        <div class="text-sm text-gray-500">${dayjs().format('ddd, D MMM YYYY')}</div>
      </header>

      <!-- Page content -->
      <div class="flex-1 p-6" id="pageContent">
        <div class="loading"><div class="spinner"></div></div>
      </div>
    </main>
  </div>`

  navigate('dashboard')
  loadNotifCount()
}

function navItem(page, label, icon) {
  return `<a href="#" onclick="navigate('${page}'); return false;" id="nav-${page}"
    class="flex items-center px-3 py-2 rounded-lg text-sm font-medium">
    <i class="fas ${icon} nav-icon"></i>${label}
  </a>`
}

function setActiveNav(page) {
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'))
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
  }
  if (pages[page]) pages[page](params)
  else content.innerHTML = `<p class="text-gray-400 text-center mt-20">Page not found</p>`
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
      dd.innerHTML = `<div class="p-4 text-gray-400 text-sm text-center">No results found</div>`
    } else {
      dd.innerHTML = `
        ${units.length ? `<div class="px-4 py-2 text-xs font-bold text-gray-400 uppercase">Units</div>` : ''}
        ${units.map(u => `<div class="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b"
            onclick="showUnitDetail('${u.unit_no}')">
          <div class="font-semibold text-sm">Unit ${u.unit_no} – ${u.owner_name || 'N/A'}</div>
          <div class="text-xs text-gray-400">${u.particulars} · ${u.tenant_name ? 'Tenant: ' + u.tenant_name : 'No tenant'}</div>
        </div>`).join('')}
        ${complaints.length ? `<div class="px-4 py-2 text-xs font-bold text-gray-400 uppercase">Complaints</div>` : ''}
        ${complaints.map(cp => `<div class="px-4 py-2 hover:bg-blue-50 cursor-pointer"
            onclick="showComplaintDetail(${cp.id})">
          <div class="font-semibold text-sm">${cp.complaint_no} – Unit ${cp.unit_no}</div>
          <div class="text-xs text-gray-400">${cp.category_name} · ${cp.status}</div>
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
  <div class="max-w-3xl mx-auto">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-gray-800"><i class="fas fa-bell mr-2 text-blue-900"></i>Notifications</h1>
      ${unread_count > 0 ? `<button onclick="markAllRead()" class="btn-primary btn-sm"><i class="fas fa-check-double mr-1"></i>Mark All Read</button>` : ''}
    </div>
    <div class="space-y-3">
      ${notifications.length === 0 ? `<div class="card p-12 text-center text-gray-400"><i class="fas fa-bell-slash text-4xl mb-3"></i><p>No notifications</p></div>` :
        notifications.map(n => `
        <div class="card p-4 flex gap-4 ${n.is_read ? 'opacity-70' : 'border-l-4 border-blue-500'}">
          <div class="text-xl mt-1"><i class="fas fa-${typeIcon[n.type] || typeIcon.info}"></i></div>
          <div class="flex-1">
            <div class="font-semibold text-gray-800 text-sm">${n.title}</div>
            <div class="text-gray-600 text-sm mt-1">${n.message}</div>
            <div class="text-gray-400 text-xs mt-2">${formatDateTime(n.created_at)}</div>
          </div>
          ${n.complaint_id ? `<button onclick="showComplaintDetail(${n.complaint_id})" class="text-blue-500 text-sm hover:underline">View</button>` : ''}
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
  <h1 class="text-2xl font-bold text-gray-800 mb-6"><i class="fas fa-tachometer-alt mr-2 text-blue-900"></i>Dashboard</h1>
  
  <!-- Stats Row 1 -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    <div class="stat-card" style="background:linear-gradient(135deg,#1e3a5f,#2563eb)">
      <div class="text-3xl font-bold">${us.total_units || 0}</div>
      <div class="text-blue-200 text-sm mt-1">Total Units</div>
      <div class="text-xs mt-2 text-blue-100">🟢 ${us.occupied || 0} Occupied · ⚪ ${us.vacant || 0} Vacant</div>
    </div>
    <div class="stat-card" style="background:linear-gradient(135deg,#065f46,#10b981)">
      <div class="text-3xl font-bold">${cnt.customers || 0}</div>
      <div class="text-green-100 text-sm mt-1">Registered Owners</div>
      <div class="text-xs mt-2 text-green-100">${cnt.tenants || 0} Active Tenants</div>
    </div>
    <div class="stat-card" style="background:linear-gradient(135deg,#7c3aed,#a855f7)">
      <div class="text-3xl font-bold">${cs.total || 0}</div>
      <div class="text-purple-100 text-sm mt-1">Total Complaints</div>
      <div class="text-xs mt-2 text-purple-100">🔴 ${cs.open_count || 0} Open</div>
    </div>
    <div class="stat-card" style="background:linear-gradient(135deg,#92400e,#f59e0b)">
      <div class="text-3xl font-bold">${cnt.employees || 0}</div>
      <div class="text-yellow-100 text-sm mt-1">Staff Members</div>
      <div class="text-xs mt-2 text-yellow-100">${cnt.kyc_complete || 0} KYC Complete</div>
    </div>
  </div>

  <!-- Complaint Pipeline -->
  <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
    ${[['Open','open_count','#fef3c7','#92400e'],['Assigned','assigned_count','#dbeafe','#1e40af'],['Scheduled','scheduled_count','#e0e7ff','#5b21b6'],['Resolved','resolved_count','#d1fae5','#065f46'],['Closed','closed_count','#f3f4f6','#374151']].map(([label,key,bg,color]) => `
    <div class="card p-4 text-center">
      <div class="text-2xl font-bold" style="color:${color}">${cs[key] || 0}</div>
      <div class="text-xs font-semibold mt-1" style="color:${color}">${label}</div>
    </div>`).join('')}
  </div>

  <div class="grid md:grid-cols-2 gap-6 mb-6">
    <!-- Recent Complaints -->
    <div class="card p-5">
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-bold text-gray-800">Recent Complaints</h3>
        <button onclick="navigate('complaints')" class="text-blue-600 text-sm hover:underline">View All</button>
      </div>
      <div class="space-y-2">
        ${(d.recent_complaints || []).map(c => `
        <div class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer complaint-card complaint-${c.status.toLowerCase()}"
             onclick="showComplaintDetail(${c.id})">
          <div class="w-2 h-2 rounded-full ${c.status==='Open'?'bg-yellow-400':c.status==='Assigned'?'bg-blue-400':c.status==='Resolved'?'bg-green-400':'bg-gray-400'}"></div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium truncate">${c.complaint_no} – Unit ${c.unit_no}</div>
            <div class="text-xs text-gray-400">${c.category_name} · ${formatDate(c.created_at)}</div>
          </div>
          ${statusBadge(c.status)}
        </div>`).join('')}
      </div>
    </div>

    <!-- Category Breakdown + Workload -->
    <div class="space-y-4">
      <div class="card p-5">
        <h3 class="font-bold text-gray-800 mb-3">Active by Category</h3>
        ${(d.by_category || []).map(cat => `
        <div class="flex items-center gap-3 mb-2">
          <div class="text-sm w-32 truncate">${cat.name}</div>
          <div class="flex-1 bg-gray-100 rounded-full h-2">
            <div class="bg-blue-600 h-2 rounded-full" style="width:${Math.min(100, (cat.count / Math.max(1, cs.total || 1)) * 100)}%"></div>
          </div>
          <div class="text-sm font-bold text-blue-700 w-8">${cat.count}</div>
        </div>`).join('')}
        ${!(d.by_category?.length) ? '<p class="text-gray-400 text-sm">No active complaints</p>' : ''}
      </div>
      <div class="card p-5">
        <h3 class="font-bold text-gray-800 mb-3">Staff Workload</h3>
        ${(d.employee_workload || []).map(e => `
        <div class="flex items-center justify-between mb-2">
          <div class="text-sm">${e.name}</div>
          <div class="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">${e.count} active</div>
        </div>`).join('')}
        ${!(d.employee_workload?.length) ? '<p class="text-gray-400 text-sm">All clear!</p>' : ''}
      </div>
    </div>
  </div>

  <div class="flex gap-4 flex-wrap">
    <button onclick="navigate('complaints')" class="btn-primary"><i class="fas fa-plus mr-2"></i>New Complaint</button>
    <button onclick="navigate('customers')" class="btn-secondary"><i class="fas fa-users mr-2"></i>Customer Master</button>
    <button onclick="navigate('kyc-tracker')" class="btn-secondary"><i class="fas fa-id-card mr-2"></i>KYC Tracker</button>
  </div>`
}

async function loadEmployeeDashboard() {
  const r = await api('GET', '/dashboard/employee')
  if (!r?.ok) return
  const d = r.data
  const stats = d.stats || {}

  document.getElementById('pageContent').innerHTML = `
  <h1 class="text-2xl font-bold text-gray-800 mb-6"><i class="fas fa-hard-hat mr-2 text-blue-900"></i>My Dashboard</h1>

  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    ${[['Assigned to Me','total_assigned','#1e3a5f'],['Pending','pending','#f59e0b'],['Scheduled','scheduled','#8b5cf6'],['Resolved','resolved','#10b981']].map(([label,key,color]) => `
    <div class="card p-4 text-center">
      <div class="text-3xl font-bold" style="color:${color}">${stats[key] || 0}</div>
      <div class="text-gray-500 text-sm mt-1">${label}</div>
    </div>`).join('')}
  </div>

  ${d.today_visits?.length ? `
  <div class="card p-5 mb-6 border-l-4 border-purple-500">
    <h3 class="font-bold text-gray-800 mb-3"><i class="fas fa-calendar-day mr-2 text-purple-500"></i>Today's Visits (${d.today_visits.length})</h3>
    ${d.today_visits.map(c => `
    <div class="flex items-center justify-between p-3 bg-purple-50 rounded-lg mb-2">
      <div>
        <div class="font-semibold text-sm">${c.complaint_no} – Unit ${c.unit_no}</div>
        <div class="text-xs text-gray-500">${c.category_name} · ${c.visit_time || 'Time TBD'}</div>
      </div>
      <button onclick="showComplaintDetail(${c.id})" class="btn-primary btn-sm">View</button>
    </div>`).join('')}
  </div>` : ''}

  <div class="card p-5">
    <h3 class="font-bold text-gray-800 mb-4">My Assigned Complaints</h3>
    ${(d.assigned_complaints || []).length === 0 ? `<p class="text-gray-400 text-center py-8">No complaints assigned</p>` :
      renderComplaintTable(d.assigned_complaints)}
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
  <h1 class="text-2xl font-bold text-gray-800 mb-6"><i class="fas fa-home mr-2 text-blue-900"></i>My Dashboard</h1>

  <div class="grid md:grid-cols-3 gap-4 mb-6">
    <div class="card p-5 col-span-1">
      <div class="flex items-center gap-4 mb-4">
        <div class="w-14 h-14 bg-blue-900 rounded-full flex items-center justify-center text-white text-xl font-bold">
          ${(cust.name || 'U').charAt(0)}
        </div>
        <div>
          <div class="font-bold text-gray-800">${cust.name}</div>
          <div class="text-blue-600 font-semibold">Unit ${cust.unit_no}</div>
          <div class="text-xs text-gray-400">${cust.particulars}</div>
        </div>
      </div>
      <div class="text-sm text-gray-600 space-y-1">
        <div><i class="fas fa-envelope mr-2 text-gray-400"></i>${cust.email || '—'}</div>
        <div><i class="fas fa-phone mr-2 text-gray-400"></i>${cust.mobile1 || '—'}</div>
        <div><i class="fas fa-ruler-combined mr-2 text-gray-400"></i>${cust.billing_area} ${cust.area_unit}</div>
      </div>
    </div>

    <div class="card p-5 col-span-2">
      <h3 class="font-bold text-gray-800 mb-3">My Complaints Summary</h3>
      <div class="grid grid-cols-3 gap-3 mb-4">
        ${[['Total',stats.total,'#1e3a5f'],['Open',stats.open_count,'#f59e0b'],['Resolved',stats.resolved,'#10b981']].map(([label,val,color]) => `
        <div class="text-center p-3 rounded-lg bg-gray-50">
          <div class="text-2xl font-bold" style="color:${color}">${val || 0}</div>
          <div class="text-xs text-gray-500">${label}</div>
        </div>`).join('')}
      </div>
      <button onclick="showRegisterComplaint()" class="btn-primary w-full">
        <i class="fas fa-plus mr-2"></i>Register New Complaint
      </button>
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
  <div class="flex flex-wrap justify-between items-center mb-6 gap-4">
    <h1 class="text-2xl font-bold text-gray-800"><i class="fas fa-exclamation-circle mr-2 text-blue-900"></i>Complaints</h1>
    <div class="flex gap-3 flex-wrap">
      <select id="filterStatus" onchange="filterComplaints()" class="form-input w-40">
        <option value="">All Status</option>
        <option value="Open">Open</option>
        <option value="Assigned">Assigned</option>
        <option value="Scheduled">Scheduled</option>
        <option value="Resolved">Resolved</option>
        <option value="Closed">Closed</option>
      </select>
      <select id="filterCat" onchange="filterComplaints()" class="form-input w-44">
        <option value="">All Categories</option>
        ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
      </select>
      <button onclick="showRegisterComplaint()" class="btn-primary">
        <i class="fas fa-plus mr-1"></i>New Complaint
      </button>
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
  <div class="flex justify-between items-start mb-4">
    <div>
      <h2 class="text-xl font-bold text-gray-800">${c.complaint_no}</h2>
      <div class="flex items-center gap-2 mt-1">
        ${statusBadge(c.status)}
        <span class="${priorityColor(c.priority)} text-sm font-semibold">${c.priority} Priority</span>
      </div>
    </div>
    <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-xl"></i></button>
  </div>

  <div class="grid md:grid-cols-2 gap-4 mb-4">
    <div class="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
      <div><span class="text-gray-500">Unit:</span> <strong>Unit ${c.unit_no}</strong></div>
      <div><span class="text-gray-500">Category:</span> <strong>${c.category_name}</strong></div>
      <div><span class="text-gray-500">Resident:</span> ${c.customer_name || '—'}</div>
      <div><span class="text-gray-500">Registered:</span> ${formatDateTime(c.created_at)}</div>
      ${c.assigned_to_name ? `<div><span class="text-gray-500">Assigned To:</span> <strong>${c.assigned_to_name}</strong></div>` : ''}
      ${c.visit_date ? `<div><span class="text-gray-500">Visit:</span> ${formatDate(c.visit_date)} ${c.visit_time || ''}</div>` : ''}
      ${c.resolved_at ? `<div><span class="text-gray-500">Resolved:</span> ${formatDateTime(c.resolved_at)}</div>` : ''}
    </div>
    <div>
      <div class="text-sm font-semibold text-gray-700 mb-2">Description:</div>
      <p class="text-gray-600 text-sm bg-gray-50 rounded-lg p-3">${c.description}</p>
      ${c.photo_data ? `<img src="${c.photo_data}" class="photo-preview mt-2" onclick="window.open('${c.photo_data}')"/>` : ''}
    </div>
  </div>

  ${c.resolution_notes ? `
  <div class="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
    <div class="font-semibold text-green-800 text-sm mb-1"><i class="fas fa-check-circle mr-1"></i>Resolution Notes</div>
    <p class="text-green-700 text-sm">${c.resolution_notes}</p>
    ${c.resolution_photo_data ? `<img src="${c.resolution_photo_data}" class="photo-preview mt-2" onclick="window.open('${c.resolution_photo_data}')"/>` : ''}
  </div>` : ''}

  <!-- Actions -->
  <div class="space-y-3">
    ${isAdmin && c.status === 'Open' ? `
    <div class="border rounded-lg p-3">
      <div class="font-semibold text-sm mb-2">Assign Complaint</div>
      <div class="flex gap-2">
        <select id="assignEmpId" class="form-input flex-1">
          <option value="">Select Employee</option>
          ${employeeList.map(e => `<option value="${e.id}">${e.name} (${e.department || e.role})</option>`).join('')}
        </select>
        <button onclick="assignComplaint(${c.id})" class="btn-primary btn-sm">Assign</button>
      </div>
    </div>` : ''}

    ${isAdmin && c.status === 'Assigned' ? `
    <div class="border rounded-lg p-3">
      <div class="font-semibold text-sm mb-2">Re-Assign</div>
      <div class="flex gap-2">
        <select id="assignEmpId" class="form-input flex-1">
          ${employeeList.map(e => `<option value="${e.id}" ${e.id == c.assigned_to_employee_id ? 'selected' : ''}>${e.name}</option>`).join('')}
        </select>
        <button onclick="assignComplaint(${c.id})" class="btn-primary btn-sm">Update</button>
      </div>
    </div>` : ''}

    ${isAssignedEmp && (c.status === 'Assigned') ? `
    <div class="border rounded-lg p-3">
      <div class="font-semibold text-sm mb-2"><i class="fas fa-calendar mr-1"></i>Schedule Visit</div>
      <div class="flex gap-2">
        <input type="date" id="visitDate" class="form-input" value="${c.visit_date || ''}"/>
        <input type="time" id="visitTime" class="form-input" value="${c.visit_time || ''}"/>
        <button onclick="scheduleVisit(${c.id})" class="btn-primary btn-sm">Schedule</button>
      </div>
    </div>` : ''}

    ${isAssignedEmp && (c.status === 'Assigned' || c.status === 'Scheduled') ? `
    <div class="border-2 border-green-200 rounded-lg p-3">
      <div class="font-semibold text-sm mb-2 text-green-800"><i class="fas fa-check-double mr-1"></i>Mark as Resolved</div>
      <textarea id="resNotes" class="form-input mb-2" rows="2" placeholder="Resolution notes..."></textarea>
      <label class="form-label text-xs">Upload Resolution Photo</label>
      <input type="file" id="resPhoto" accept="image/*" class="form-input mb-2"/>
      <button onclick="resolveComplaint(${c.id})" class="btn-success w-full">Mark Resolved</button>
    </div>` : ''}

    ${isAdmin && c.status === 'Resolved' ? `
    <button onclick="closeComplaint(${c.id})" class="btn-primary btn-sm">Close Complaint</button>` : ''}
  </div>

  <!-- Audit Trail -->
  ${audit_trail.length > 0 ? `
  <div class="mt-5">
    <div class="font-semibold text-sm text-gray-700 mb-3"><i class="fas fa-history mr-1"></i>Activity Timeline</div>
    <div class="timeline">
      ${audit_trail.map(a => `
      <div class="timeline-item">
        <div class="text-sm font-medium text-gray-700">${a.description}</div>
        <div class="text-xs text-gray-400">${formatDateTime(a.created_at)} · ${a.actor_name || 'System'}</div>
      </div>`).join('')}
    </div>
  </div>` : ''}
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
  const catR = await api('GET', '/complaints/categories/list')
  const categories = catR?.data?.categories || []

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

  showModal(`
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-xl font-bold text-gray-800"><i class="fas fa-plus-circle mr-2 text-blue-600"></i>Register Complaint</h2>
    <button onclick="closeModal()" class="text-gray-400"><i class="fas fa-times text-xl"></i></button>
  </div>

  ${unitSelector}

  <div class="mb-4">
    <label class="form-label">Category *</label>
    <div class="grid grid-cols-2 gap-3">
      ${categories.map(cat => `
      <label class="cursor-pointer">
        <input type="radio" name="catId" value="${cat.id}" class="hidden peer"/>
        <div class="peer-checked:ring-2 peer-checked:ring-blue-600 peer-checked:bg-blue-50 border rounded-lg p-3 text-center hover:bg-gray-50 transition">
          <div class="text-2xl mb-1"><i class="fas ${cat.icon || 'fa-tools'}"></i></div>
          <div class="text-sm font-medium">${cat.name}</div>
        </div>
      </label>`).join('')}
    </div>
  </div>

  <div class="mb-4">
    <label class="form-label">Priority</label>
    <select id="compPriority" class="form-input">
      <option value="Normal">Normal</option>
      <option value="Low">Low</option>
      <option value="High">High</option>
      <option value="Urgent">Urgent</option>
    </select>
  </div>

  <div class="mb-4">
    <label class="form-label">Description *</label>
    <textarea id="compDesc" class="form-input" rows="3" placeholder="Describe the issue in detail..."></textarea>
  </div>

  <div class="mb-4">
    <label class="form-label">Upload Photo (Optional)</label>
    <input type="file" id="compPhoto" accept="image/*" class="form-input"/>
    <div id="photoPreviewCont" class="mt-2 hidden">
      <img id="photoPreview" class="photo-preview"/>
    </div>
  </div>

  <button onclick="submitComplaint()" class="btn-primary w-full py-3">
    <i class="fas fa-paper-plane mr-2"></i>Submit Complaint
  </button>`)

  document.getElementById('compPhoto')?.addEventListener('change', async (e) => {
    const f = e.target.files[0]
    if (f) {
      const data = await fileToBase64(f)
      document.getElementById('photoPreview').src = data
      document.getElementById('photoPreviewCont').classList.remove('hidden')
    }
  })
}

async function submitComplaint() {
  const unit_id = parseInt(document.getElementById('compUnitId')?.value)
  const catEl = document.querySelector('input[name="catId"]:checked')
  const category_id = catEl ? parseInt(catEl.value) : null
  const description = document.getElementById('compDesc').value.trim()
  const priority = document.getElementById('compPriority').value
  const photoFile = document.getElementById('compPhoto').files[0]

  if (!unit_id) { toast('Select a unit', 'error'); return }
  if (!category_id) { toast('Select a category', 'error'); return }
  if (!description) { toast('Enter description', 'error'); return }

  let photo_data = null
  if (photoFile) photo_data = await fileToBase64(photoFile)

  const r = await api('POST', '/complaints', { unit_id, category_id, description, priority, photo_data })
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
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold text-gray-800"><i class="fas fa-home mr-2 text-blue-900"></i>Unit Registry</h1>
    <div class="flex gap-2">
      <input type="text" id="unitSearch" placeholder="Search unit, owner..." class="form-input w-48" oninput="filterUnits(this.value)"/>
      <select id="unitFilter" onchange="filterUnits(document.getElementById('unitSearch').value)" class="form-input w-44">
        <option value="">All Status</option>
        <option value="occupied">Occupied</option>
        <option value="vacant">Vacant</option>
        <option value="construction">Under Construction</option>
      </select>
    </div>
  </div>

  <div class="grid grid-cols-4 gap-4 mb-6">
    ${[['Total',total,'#1e3a5f'],['Occupied',occupied,'#10b981'],['Vacant',vacant,'#6b7280'],['Under Const.',construction,'#f59e0b']].map(([l,v,c]) => `
    <div class="card p-4 text-center">
      <div class="text-2xl font-bold" style="color:${c}">${v}</div>
      <div class="text-gray-500 text-xs mt-1">${l}</div>
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
        <button onclick="closeModal();navigate('kyc-tracker',{customerId:${owner.id},entityType:'customer'})" class="mt-2 btn-primary btn-sm w-full">Manage KYC</button>
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
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold text-gray-800"><i class="fas fa-users mr-2 text-blue-900"></i>Customer Master</h1>
    <div class="flex gap-3">
      <input type="text" id="custSearch" placeholder="Search by name, unit, email..." class="form-input w-56" oninput="searchCustomers(this.value)"/>
      <button onclick="showAddCustomer()" class="btn-primary"><i class="fas fa-plus mr-1"></i>Add Customer</button>
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
    <button onclick="uploadKyc('tenant',${tenant.id},'tenancy_contract')" class="btn-secondary btn-sm mt-2">Manage Tenant KYC</button>
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

// ── KYC Upload ───────────────────────────────────────────────
function uploadKyc(entityType, entityId, docType) {
  const labels = {
    aadhar: 'Aadhar Card', pan: 'PAN Card', photo: 'Photograph',
    sale_deed: 'Sale Deed', maintenance_agreement: 'Maintenance Agreement',
    tenancy_contract: 'Tenancy Contract', police_verification: 'Police Verification'
  }
  showModal(`
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-lg font-bold">Upload: ${labels[docType] || docType}</h2>
    <button onclick="closeModal()" class="text-gray-400"><i class="fas fa-times"></i></button>
  </div>
  <div class="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
    <i class="fas fa-info-circle mr-1"></i>Upload a clear scan or photo of the document. Supported: JPEG, PNG, PDF (as image).
  </div>
  <label class="form-label">Select File *</label>
  <input type="file" id="kycFile" accept="image/*,application/pdf" class="form-input mb-4"/>
  <div id="kycPreviewCont" class="hidden mb-4">
    <img id="kycPreview" class="max-h-48 rounded-lg border"/>
  </div>
  <button onclick="submitKyc('${entityType}',${entityId},'${docType}')" class="btn-primary w-full">Upload Document</button>
  `)

  document.getElementById('kycFile').addEventListener('change', async (e) => {
    const f = e.target.files[0]
    if (f && f.type.startsWith('image/')) {
      const data = await fileToBase64(f)
      document.getElementById('kycPreview').src = data
      document.getElementById('kycPreviewCont').classList.remove('hidden')
    }
  })
}

async function submitKyc(entityType, entityId, docType) {
  const file = document.getElementById('kycFile').files[0]
  if (!file) { toast('Select a file', 'error'); return }
  const file_data = await fileToBase64(file)
  const r = await api('POST', `/kyc/${entityType}/${entityId}`, {
    doc_type: docType, file_name: file.name, file_data
  })
  if (r?.ok) { toast(r.data.message, 'success'); closeModal() }
  else toast(r?.data?.error || 'Upload failed', 'error')
}

// ── KYC Tracker ───────────────────────────────────────────────
async function loadKycTracker() {
  const r = await api('GET', '/kyc/tracker/summary')
  if (!r?.ok) return
  const { owners = [], tenants = [] } = r.data

  document.getElementById('pageContent').innerHTML = `
  <h1 class="text-2xl font-bold text-gray-800 mb-6"><i class="fas fa-id-card mr-2 text-blue-900"></i>KYC Tracker</h1>

  <div class="flex gap-2 mb-4">
    <button onclick="showKycTab('owners')" id="tab-owners" class="btn-primary btn-sm">Owners (${owners.length})</button>
    <button onclick="showKycTab('tenants')" id="tab-tenants" class="px-3 py-1 rounded-md text-sm bg-gray-200 text-gray-700">Tenants (${tenants.length})</button>
  </div>

  <div id="kycTabOwners" class="card overflow-hidden">
    <div class="p-4 bg-gray-50 border-b">
      <input type="text" placeholder="Search owner..." class="form-input w-64" oninput="filterKycTable('owners', this.value)"/>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left font-semibold">Unit</th>
            <th class="px-4 py-3 text-left font-semibold">Owner</th>
            <th class="px-4 py-3 text-center font-semibold">Aadhar</th>
            <th class="px-4 py-3 text-center font-semibold">PAN</th>
            <th class="px-4 py-3 text-center font-semibold">Photo</th>
            <th class="px-4 py-3 text-center font-semibold">Sale Deed</th>
            <th class="px-4 py-3 text-center font-semibold">Maint. Agr.</th>
            <th class="px-4 py-3 text-center font-semibold">Completion</th>
          </tr>
        </thead>
        <tbody id="kycOwnersBody">
          ${owners.map(o => {
            const done = [o.has_aadhar,o.has_pan,o.has_photo,o.has_sale_deed,o.has_maint_agr].filter(Boolean).length
            const pct = Math.round(done/5*100)
            return `<tr class="table-row border-t">
              <td class="px-4 py-2 font-bold text-blue-900">Unit ${o.unit_no}</td>
              <td class="px-4 py-2">${o.name}</td>
              ${[o.has_aadhar,o.has_pan,o.has_photo,o.has_sale_deed,o.has_maint_agr].map(v => `<td class="px-4 py-2 text-center">${v ? '<i class="fas fa-check-circle text-green-500"></i>' : '<i class="fas fa-times-circle text-red-400"></i>'}</td>`).join('')}
              <td class="px-4 py-2 text-center">
                <div class="flex items-center gap-2">
                  <div class="flex-1 bg-gray-100 rounded-full h-2">
                    <div class="h-2 rounded-full ${pct===100?'bg-green-500':pct>=60?'bg-yellow-400':'bg-red-400'}" style="width:${pct}%"></div>
                  </div>
                  <span class="text-xs font-bold ${pct===100?'text-green-600':pct>=60?'text-yellow-600':'text-red-500'}">${pct}%</span>
                </div>
              </td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <div id="kycTabTenants" class="card overflow-hidden hidden">
    <div class="p-4 bg-gray-50 border-b">
      <input type="text" placeholder="Search tenant..." class="form-input w-64" oninput="filterKycTable('tenants', this.value)"/>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-4 py-3 text-left font-semibold">Unit</th>
            <th class="px-4 py-3 text-left font-semibold">Tenant</th>
            <th class="px-4 py-3 text-center">Contract</th>
            <th class="px-4 py-3 text-center">Aadhar</th>
            <th class="px-4 py-3 text-center">PAN</th>
            <th class="px-4 py-3 text-center">Photo</th>
            <th class="px-4 py-3 text-center">Police Verif.</th>
            <th class="px-4 py-3 text-left">Expiry</th>
            <th class="px-4 py-3 text-center">Completion</th>
          </tr>
        </thead>
        <tbody>
          ${tenants.map(t => {
            const done = [t.has_contract,t.has_aadhar,t.has_pan,t.has_photo,t.has_police].filter(Boolean).length
            const pct = Math.round(done/5*100)
            const exp = t.tenancy_expiry
            const expDate = exp ? new Date(exp) : null
            const isExpired = expDate && expDate < new Date()
            return `<tr class="table-row border-t">
              <td class="px-4 py-2 font-bold text-blue-900">Unit ${t.unit_no}</td>
              <td class="px-4 py-2">${t.name}</td>
              ${[t.has_contract,t.has_aadhar,t.has_pan,t.has_photo,t.has_police].map(v => `<td class="px-4 py-2 text-center">${v ? '<i class="fas fa-check-circle text-green-500"></i>' : '<i class="fas fa-times-circle text-red-400"></i>'}</td>`).join('')}
              <td class="px-4 py-2 ${isExpired?'text-red-600 font-semibold':'text-gray-500'} text-xs">${exp ? formatDate(exp) : '—'}</td>
              <td class="px-4 py-2 text-center">
                <div class="flex items-center gap-1">
                  <div class="flex-1 bg-gray-100 rounded-full h-2 w-16">
                    <div class="h-2 rounded-full ${pct===100?'bg-green-500':pct>=60?'bg-yellow-400':'bg-red-400'}" style="width:${pct}%"></div>
                  </div>
                  <span class="text-xs font-bold">${pct}%</span>
                </div>
              </td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`
}

function showKycTab(tab) {
  document.getElementById('kycTabOwners').classList.toggle('hidden', tab !== 'owners')
  document.getElementById('kycTabTenants').classList.toggle('hidden', tab !== 'tenants')
  document.getElementById('tab-owners').className = tab === 'owners' ? 'btn-primary btn-sm' : 'px-3 py-1 rounded-md text-sm bg-gray-200 text-gray-700'
  document.getElementById('tab-tenants').className = tab === 'tenants' ? 'btn-primary btn-sm' : 'px-3 py-1 rounded-md text-sm bg-gray-200 text-gray-700'
}

function filterKycTable(type, val) {
  const bodyId = type === 'owners' ? 'kycOwnersBody' : null
  const tbody = document.querySelector(type === 'tenants' ? '#kycTabTenants tbody' : '#kycOwnersBody')
  if (!tbody) return
  tbody.querySelectorAll('tr').forEach(row => {
    row.style.display = !val || row.textContent.toLowerCase().includes(val.toLowerCase()) ? '' : 'none'
  })
}

// ── Employees ─────────────────────────────────────────────────
async function loadEmployees() {
  const r = await api('GET', '/employees')
  if (!r?.ok) return
  const employees = r.data.employees || []

  document.getElementById('pageContent').innerHTML = `
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold text-gray-800"><i class="fas fa-user-tie mr-2 text-blue-900"></i>Employee Management</h1>
    ${currentUser.role === 'admin' ? `<button onclick="showAddEmployee()" class="btn-primary"><i class="fas fa-plus mr-1"></i>Add Employee</button>` : ''}
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
  <div class="flex justify-between items-center mb-4">
    <h2 class="text-xl font-bold">Add Employee</h2>
    <button onclick="closeModal()" class="text-gray-400"><i class="fas fa-times"></i></button>
  </div>
  <div class="grid md:grid-cols-2 gap-4">
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
  <button onclick="addEmployee()" class="btn-primary w-full mt-4">Add Employee</button>
  `)
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

// ── Modal ─────────────────────────────────────────────────────
function showModal(content) {
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.id = 'modalOverlay'
  overlay.innerHTML = `<div class="modal">${content}</div>`
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
  showRegisterComplaint, submitComplaint, filterComplaints,
  showUnitDetail, filterUnits, showRegisterComplaintForUnit, showAddComplaintForUnit: showRegisterComplaintForUnit,
  showCustomerDetail, showEditCustomer, showAddCustomer, addCustomer, updateCustomer, deleteCustomer,
  showAddTenant, addTenant, searchCustomers,
  uploadKyc, submitKyc, showKycTab, filterKycTable,
  showAddEmployee, addEmployee, showEditEmployee, updateEmployee, showEmpDetails, showResetEmpPwd, resetEmpPwd,
  showModal, closeModal, loadKycTracker
})
