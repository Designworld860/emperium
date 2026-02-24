-- ═══════════════════════════════════════════════════════════════
-- Migration 0004: Unit Status + Internal Complaints
-- ═══════════════════════════════════════════════════════════════

-- 1. Add unit_status column (standardized, separate from particulars)
ALTER TABLE units ADD COLUMN unit_status TEXT NOT NULL DEFAULT 'Vacant';

-- Normalise existing particulars into unit_status
UPDATE units SET unit_status = 'Occupied by Owner'   WHERE UPPER(particulars) LIKE '%OCCUPIED%' AND UPPER(particulars) NOT LIKE '%TENANT%';
UPDATE units SET unit_status = 'Occupied by Tenant'  WHERE UPPER(particulars) LIKE '%TENANT%';
UPDATE units SET unit_status = 'Under Construction'  WHERE UPPER(particulars) LIKE '%CONSTRUCTION%';
UPDATE units SET unit_status = 'Vacant'              WHERE unit_status = 'Vacant';   -- no-op, keeps default

-- 2. Internal complaints table
CREATE TABLE IF NOT EXISTS internal_complaints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  complaint_no TEXT UNIQUE NOT NULL,
  reported_by_employee_id INTEGER NOT NULL REFERENCES employees(id),
  category TEXT NOT NULL DEFAULT 'General',
  sub_category TEXT,
  description TEXT NOT NULL,
  photo_data TEXT,
  priority TEXT NOT NULL DEFAULT 'Normal',
  status TEXT NOT NULL DEFAULT 'Pending',
  assigned_to_employee_id INTEGER REFERENCES employees(id),
  assigned_at DATETIME,
  resolution_notes TEXT,
  resolved_at DATETIME,
  resolved_by_employee_id INTEGER REFERENCES employees(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Internal complaint audit logs (reuse audit_logs table — entity_type = 'internal_complaint')
-- No new table needed; audit_logs already has entity_type TEXT

-- 4. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ic_reporter ON internal_complaints(reported_by_employee_id);
CREATE INDEX IF NOT EXISTS idx_ic_status   ON internal_complaints(status);
CREATE INDEX IF NOT EXISTS idx_ic_assigned ON internal_complaints(assigned_to_employee_id);
