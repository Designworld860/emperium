-- ============================================================
-- Migration 0002: KYC Document History Table
-- Every upload is stored as a new row — nothing is overwritten.
-- The latest version per (entity_type, entity_id, doc_type) is
-- the active document; older rows form the full audit trail.
-- ============================================================

CREATE TABLE IF NOT EXISTS kyc_document_history (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type           TEXT    NOT NULL,           -- 'customer' | 'tenant'
  entity_id             INTEGER NOT NULL,
  doc_type              TEXT    NOT NULL,
  file_name             TEXT,
  file_data             TEXT,                        -- base64 data-url
  remarks               TEXT,                        -- optional note at upload time
  version               INTEGER NOT NULL DEFAULT 1,  -- auto-incremented per doc slot
  uploaded_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  uploaded_by_employee_id INTEGER,
  FOREIGN KEY (uploaded_by_employee_id) REFERENCES employees(id)
);

CREATE INDEX IF NOT EXISTS idx_kyc_hist_entity
  ON kyc_document_history(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_kyc_hist_slot
  ON kyc_document_history(entity_type, entity_id, doc_type);
