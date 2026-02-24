-- ============================================================
-- Emperium City Grievance Redressal System - DB Schema
-- ============================================================

-- Units table (seeded from Excel)
CREATE TABLE IF NOT EXISTS units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_no TEXT UNIQUE NOT NULL,
  particulars TEXT DEFAULT 'Vacant',
  area_unit TEXT DEFAULT 'Sq.Yd',
  billing_area REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Customers (Owners) table
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  mobile1 TEXT,
  mobile2 TEXT,
  address TEXT,
  password_hash TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (unit_id) REFERENCES units(id)
);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_unit ON customers(unit_id);

-- Tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  mobile1 TEXT,
  mobile2 TEXT,
  tenancy_start DATE,
  tenancy_expiry DATE,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (unit_id) REFERENCES units(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
CREATE INDEX IF NOT EXISTS idx_tenants_unit ON tenants(unit_id);

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  mobile TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee', -- employee | sub_admin | admin
  department TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);

-- KYC Documents table
CREATE TABLE IF NOT EXISTS kyc_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL, -- customer | tenant
  entity_id INTEGER NOT NULL,
  doc_type TEXT NOT NULL, -- aadhar | pan | photo | sale_deed | maintenance_agreement | tenancy_contract | police_verification
  file_name TEXT,
  file_url TEXT,
  file_data TEXT, -- base64 encoded for small files
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  uploaded_by_employee_id INTEGER,
  FOREIGN KEY (uploaded_by_employee_id) REFERENCES employees(id)
);
CREATE INDEX IF NOT EXISTS idx_kyc_entity ON kyc_documents(entity_type, entity_id);

-- Complaint Categories (Master)
CREATE TABLE IF NOT EXISTS complaint_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

-- Complaints table
CREATE TABLE IF NOT EXISTS complaints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  complaint_no TEXT UNIQUE NOT NULL,
  unit_id INTEGER NOT NULL,
  customer_id INTEGER,
  tenant_id INTEGER,
  category_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  photo_url TEXT,
  photo_data TEXT, -- base64
  status TEXT NOT NULL DEFAULT 'Open', -- Open | Assigned | Scheduled | In Progress | Resolved | Closed
  priority TEXT DEFAULT 'Normal', -- Low | Normal | High | Urgent
  assigned_to_employee_id INTEGER,
  assigned_at DATETIME,
  assigned_by_employee_id INTEGER,
  visit_date DATE,
  visit_time TEXT,
  resolved_at DATETIME,
  resolved_by_employee_id INTEGER,
  resolution_notes TEXT,
  resolution_photo_url TEXT,
  resolution_photo_data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (unit_id) REFERENCES units(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (category_id) REFERENCES complaint_categories(id),
  FOREIGN KEY (assigned_to_employee_id) REFERENCES employees(id),
  FOREIGN KEY (assigned_by_employee_id) REFERENCES employees(id),
  FOREIGN KEY (resolved_by_employee_id) REFERENCES employees(id)
);
CREATE INDEX IF NOT EXISTS idx_complaints_unit ON complaints(unit_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned ON complaints(assigned_to_employee_id);

-- Audit Trail table
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL, -- created | updated | deleted | assigned | resolved | kyc_uploaded | login
  entity_type TEXT NOT NULL, -- complaint | customer | tenant | kyc | employee
  entity_id INTEGER,
  description TEXT,
  actor_type TEXT, -- customer | employee
  actor_id INTEGER,
  actor_name TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_type TEXT NOT NULL, -- customer | employee
  recipient_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info', -- info | success | warning | alert
  is_read INTEGER DEFAULT 0,
  complaint_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (complaint_id) REFERENCES complaints(id)
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_type, recipient_id, is_read);

-- Property History table
CREATE TABLE IF NOT EXISTS property_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL,
  event_type TEXT NOT NULL, -- owner_change | tenant_change | kyc_update | occupancy_change
  description TEXT,
  old_value TEXT,
  new_value TEXT,
  changed_by_employee_id INTEGER,
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (unit_id) REFERENCES units(id),
  FOREIGN KEY (changed_by_employee_id) REFERENCES employees(id)
);
CREATE INDEX IF NOT EXISTS idx_property_history_unit ON property_history(unit_id);
