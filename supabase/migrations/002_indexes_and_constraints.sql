-- Migration 002: Indexes and Constraints

-- Books Indexes
CREATE INDEX IF NOT EXISTS idx_books_accession ON books (accession_number);
CREATE INDEX IF NOT EXISTS idx_books_title ON books (title);
CREATE INDEX IF NOT EXISTS idx_books_author ON books (author);
CREATE INDEX IF NOT EXISTS idx_books_category ON books (category);
CREATE INDEX IF NOT EXISTS idx_books_language ON books (language);
CREATE INDEX IF NOT EXISTS idx_books_status ON books (status);
CREATE INDEX IF NOT EXISTS idx_books_isbn ON books (isbn);

-- Users Indexes
CREATE INDEX IF NOT EXISTS idx_users_ad_no ON users (ad_no);
CREATE INDEX IF NOT EXISTS idx_users_full_name ON users (full_name);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);
CREATE INDEX IF NOT EXISTS idx_users_type ON users (user_type);

-- Admin Indexes
CREATE INDEX IF NOT EXISTS idx_admin_username ON admin (username);
CREATE INDEX IF NOT EXISTS idx_admin_email ON admin (email);
CREATE INDEX IF NOT EXISTS idx_admin_role ON admin (role);
CREATE INDEX IF NOT EXISTS idx_admin_status ON admin (status);

-- Transactions Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_book_id ON transactions (book_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions (status);
CREATE INDEX IF NOT EXISTS idx_transactions_borrow_date ON transactions (borrow_date);
CREATE INDEX IF NOT EXISTS idx_transactions_due_date ON transactions (due_date);
CREATE INDEX IF NOT EXISTS idx_transactions_return_date ON transactions (return_date);
CREATE INDEX IF NOT EXISTS idx_transactions_fine_status ON transactions (fine_status);

-- Fines Indexes
CREATE INDEX IF NOT EXISTS idx_fines_user_id ON fines (user_id);
CREATE INDEX IF NOT EXISTS idx_fines_status ON fines (status);
CREATE INDEX IF NOT EXISTS idx_fines_transaction_id ON fines (transaction_id);

-- Custom Fines Indexes
CREATE INDEX IF NOT EXISTS idx_custom_fines_student_id ON custom_fines (student_id);
CREATE INDEX IF NOT EXISTS idx_custom_fines_status ON custom_fines (status);
CREATE INDEX IF NOT EXISTS idx_custom_fines_created_by ON custom_fines (created_by);

-- Fine Payments Indexes
CREATE INDEX IF NOT EXISTS idx_fine_payments_user_id ON fine_payments (user_id);
CREATE INDEX IF NOT EXISTS idx_fine_payments_transaction_id ON fine_payments (transaction_id);
CREATE INDEX IF NOT EXISTS idx_fine_payments_fine_id ON fine_payments (fine_id);
CREATE INDEX IF NOT EXISTS idx_fine_payments_status ON fine_payments (status);
CREATE INDEX IF NOT EXISTS idx_fine_payments_submitted_at ON fine_payments (submitted_at);

-- Borrow Requests Indexes
CREATE INDEX IF NOT EXISTS idx_borrow_requests_user_id ON borrow_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_borrow_requests_book_id ON borrow_requests (book_id);
CREATE INDEX IF NOT EXISTS idx_borrow_requests_status ON borrow_requests (status);

-- Student Registrations Indexes
CREATE INDEX IF NOT EXISTS idx_student_registrations_ad_no ON student_registrations (ad_no);
CREATE INDEX IF NOT EXISTS idx_student_registrations_status ON student_registrations (status);

-- Reservations Indexes
CREATE INDEX IF NOT EXISTS idx_reservations_student_id ON reservations (student_id);
CREATE INDEX IF NOT EXISTS idx_reservations_book_id ON reservations (book_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations (status);

-- Book Suggestions Indexes
CREATE INDEX IF NOT EXISTS idx_book_suggestions_student_id ON book_suggestions (student_id);
CREATE INDEX IF NOT EXISTS idx_book_suggestions_status ON book_suggestions (status);

-- Announcements Indexes
CREATE INDEX IF NOT EXISTS idx_announcements_target_role ON announcements (target_role);
CREATE INDEX IF NOT EXISTS idx_announcements_expires_at ON announcements (expires_at);

-- User Notifications Indexes
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_is_read ON user_notifications (is_read);

-- Activity Logs Indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON activity_logs (action_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_category ON activity_logs (action_category);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_severity ON activity_logs (severity);

-- Book Issue Audit Indexes
CREATE INDEX IF NOT EXISTS idx_book_issue_audit_transaction_id ON book_issue_audit (transaction_id);
CREATE INDEX IF NOT EXISTS idx_book_issue_audit_book_id ON book_issue_audit (book_id);
CREATE INDEX IF NOT EXISTS idx_book_issue_audit_user_id ON book_issue_audit (user_id);
CREATE INDEX IF NOT EXISTS idx_book_issue_audit_admin_id ON book_issue_audit (admin_id);
CREATE INDEX IF NOT EXISTS idx_book_issue_audit_action_type ON book_issue_audit (action_type);
CREATE INDEX IF NOT EXISTS idx_book_issue_audit_issued_at ON book_issue_audit (issued_at);

-- System Settings Indexes
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings (setting_key);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings (category);
CREATE INDEX IF NOT EXISTS idx_system_settings_group ON system_settings (setting_group);
