-- ============================================================
-- Migration 0005: KYC Document Review Status
-- Adds resident self-upload capability + admin review workflow
-- status: 'pending_review' | 'approved' | 'rejected'
-- ============================================================

-- Add review fields to kyc_document_history
ALTER TABLE kyc_document_history ADD COLUMN status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE kyc_document_history ADD COLUMN uploaded_by_customer_id INTEGER REFERENCES customers(id);
ALTER TABLE kyc_document_history ADD COLUMN reviewed_by_employee_id INTEGER REFERENCES employees(id);
ALTER TABLE kyc_document_history ADD COLUMN reviewed_at DATETIME;
ALTER TABLE kyc_document_history ADD COLUMN review_remarks TEXT;

-- Also update kyc_documents to track review status
ALTER TABLE kyc_documents ADD COLUMN status TEXT NOT NULL DEFAULT 'approved';

-- Index for quick pending-review queries
CREATE INDEX IF NOT EXISTS idx_kyc_hist_status ON kyc_document_history(status);
CREATE INDEX IF NOT EXISTS idx_kyc_hist_customer ON kyc_document_history(uploaded_by_customer_id);
