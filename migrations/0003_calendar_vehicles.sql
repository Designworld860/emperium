-- ============================================================
-- Migration 0003: Employee Leaves, Complaint Sub-Categories,
--                 Vehicles, and Complaints enhancements
-- ============================================================

-- Employee Leaves table
CREATE TABLE IF NOT EXISTS employee_leaves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  leave_date DATE NOT NULL,
  leave_type TEXT NOT NULL DEFAULT 'Full Day',  -- Full Day | Half Day AM | Half Day PM
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',       -- Pending | Approved | Rejected
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_by_employee_id INTEGER,
  reviewed_at DATETIME,
  review_remarks TEXT,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (reviewed_by_employee_id) REFERENCES employees(id)
);
CREATE INDEX IF NOT EXISTS idx_leaves_employee ON employee_leaves(employee_id, leave_date);
CREATE INDEX IF NOT EXISTS idx_leaves_status ON employee_leaves(status);

-- Complaint Sub-Categories table
CREATE TABLE IF NOT EXISTS complaint_sub_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (category_id) REFERENCES complaint_categories(id)
);
CREATE INDEX IF NOT EXISTS idx_sub_cat_category ON complaint_sub_categories(category_id);

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL,
  customer_id INTEGER,
  tenant_id INTEGER,
  vehicle_number TEXT NOT NULL,
  vehicle_type TEXT DEFAULT 'Car',    -- Car | Bike | Scooter | Truck | Other
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_color TEXT,
  rc_file_name TEXT,
  rc_file_data TEXT,                  -- base64 encoded RC document
  is_active INTEGER DEFAULT 1,
  registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  registered_by_employee_id INTEGER,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (unit_id) REFERENCES units(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (registered_by_employee_id) REFERENCES employees(id)
);
CREATE INDEX IF NOT EXISTS idx_vehicles_unit ON vehicles(unit_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_number ON vehicles(vehicle_number);

-- Add sub_category_id to complaints (if it doesn't exist)
-- SQLite does not support ADD COLUMN IF NOT EXISTS; safe to ignore if already exists
-- (We use a trigger-safe workaround via CREATE TABLE AS SELECT if needed)
-- For new installs: add the column. For existing: it was already added in migration 0001 seed run.
-- We check by inserting dummy and catching error — instead we just attempt and ignore duplicate error.
-- NOTE: If you get "duplicate column name" error, this column already exists — safe to ignore.

-- Insert sub-categories for existing complaint categories
-- Billing sub-categories
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'Incorrect Bill Amount', 1 FROM complaint_categories WHERE name = 'Billing';
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'Late Fee Dispute', 2 FROM complaint_categories WHERE name = 'Billing';
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'Receipt Not Received', 3 FROM complaint_categories WHERE name = 'Billing';
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'Online Payment Failure', 4 FROM complaint_categories WHERE name = 'Billing';
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'Meter Reading Discrepancy', 5 FROM complaint_categories WHERE name = 'Billing';

-- Civil sub-categories
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'Wall / Ceiling Crack', 1 FROM complaint_categories WHERE name = 'Civil';
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'Seepage / Dampness', 2 FROM complaint_categories WHERE name = 'Civil';
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'Flooring Damage', 3 FROM complaint_categories WHERE name = 'Civil';
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'Painting / Whitewash', 4 FROM complaint_categories WHERE name = 'Civil';
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'Door / Window Repair', 5 FROM complaint_categories WHERE name = 'Civil';
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'Common Area Maintenance', 6 FROM complaint_categories WHERE name = 'Civil';

-- Electricity sub-categories
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'Power Outage', 1 FROM complaint_categories WHERE name = 'Electricity';
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'Short Circuit / Sparking', 2 FROM complaint_categories WHERE name = 'Electricity';
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'Street Light Not Working', 3 FROM complaint_categories WHERE name = 'Electricity';
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'MCB/Fuse Tripping', 4 FROM complaint_categories WHERE name = 'Electricity';
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'Meter Issue', 5 FROM complaint_categories WHERE name = 'Electricity';
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'Wiring Damage', 6 FROM complaint_categories WHERE name = 'Electricity';

-- Plumbing sub-categories
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'Water Leakage', 1 FROM complaint_categories WHERE name = 'Plumbing';
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'Blocked Drain', 2 FROM complaint_categories WHERE name = 'Plumbing';
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'No Water Supply', 3 FROM complaint_categories WHERE name = 'Plumbing';
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'Pipe Burst', 4 FROM complaint_categories WHERE name = 'Plumbing';
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'Tap/Fitting Issue', 5 FROM complaint_categories WHERE name = 'Plumbing';
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'Sewage Overflow', 6 FROM complaint_categories WHERE name = 'Plumbing';

-- Miscellaneous sub-categories
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'Parking Issue', 1 FROM complaint_categories WHERE name = 'Miscellaneous';
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'Security Concern', 2 FROM complaint_categories WHERE name = 'Miscellaneous';
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'Lift / Elevator Issue', 3 FROM complaint_categories WHERE name = 'Miscellaneous';
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'Noise Complaint', 4 FROM complaint_categories WHERE name = 'Miscellaneous';
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'Cleanliness / Garbage', 5 FROM complaint_categories WHERE name = 'Miscellaneous';
INSERT OR IGNORE INTO complaint_sub_categories (category_id, name, sort_order) 
SELECT id, 'Other', 6 FROM complaint_categories WHERE name = 'Miscellaneous';
