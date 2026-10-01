-- Migration 004: Seed Reference & Configuration Data

-- 1. Seed Permissions
INSERT INTO permissions (permission_key, permission_name, category, description) VALUES
-- Books Mandate
('view_books', 'View Books Catalog', 'books', 'Allows viewing the catalog and search'),
('manage_books', 'Add and Edit Books', 'books', 'Allows adding new books and editing existing ones'),
('delete_books', 'Delete Books', 'books', 'Allows deleting books from the catalogue'),
('bulk_books', 'Bulk Book Management', 'books', 'Allows bulk editing and batch actions on books'),
('import_books', 'Import Books from Excel/CSV', 'books', 'Allows batch importing books from spreadsheet files'),

-- Students / Users Mandate
('view_users', 'View Student Records', 'users', 'Allows viewing student profiles and list'),
('manage_users', 'Register and Edit Students', 'users', 'Allows registering and editing student details'),
('delete_users', 'Delete Students', 'users', 'Allows removing student records'),
('bulk_users', 'Bulk Student Management', 'users', 'Allows bulk operations on student accounts'),

-- Circulation Mandate
('issue_books', 'Manual Book Issue (Check-Out)', 'circulation', 'Allows issuing books to students'),
('return_books', 'Process Book Returns (Check-In)', 'circulation', 'Allows checking in returned books'),
('renew_books', 'Approve Renewal Requests', 'circulation', 'Allows renewing issued book loan periods'),

-- Fines Mandate
('view_fines', 'View Fine Records', 'fines', 'Allows viewing outstanding and collected fines'),
('manage_fines', 'Assign Fines to Students', 'fines', 'Allows creating manual and custom fine entries'),
('waive_fines', 'Waive or Reduce Fines', 'fines', 'Allows reducing or waiving assessed fines'),
('verify_payments', 'Verify Payment Submissions', 'fines', 'Allows approving or rejecting fine payments'),

-- System Settings Mandate
('view_settings', 'View System Settings', 'settings', 'Allows viewing system configuration'),
('manage_settings', 'Update System Settings', 'settings', 'Allows updating system parameters and rules'),
('change_appearance', 'Change Theme & Appearance', 'settings', 'Allows modifying library colors and branding'),

-- Reports & Audits Mandate
('view_activity_logs', 'View Admin Activity Logs', 'reports', 'Allows viewing audit logs of admin actions'),
('view_audit_trail', 'View Book Issue Audit Trail', 'reports', 'Allows viewing the complete issue/return history'),
('view_reports', 'Generate Reports', 'reports', 'Allows accessing reporting dashboards and stats'),
('export_reports', 'Export Data to Excel/PDF', 'reports', 'Allows exporting reporting data to spreadsheets or PDF'),

-- Advanced Features Mandate
('print_labels', 'Print Book Labels', 'advanced', 'Allows generating and printing barcode spine labels'),
('send_notifications', 'Send System Notifications', 'advanced', 'Allows creating announcements and alerts'),
('manage_registrations', 'Approve Student Registrations', 'advanced', 'Allows reviewing online sign-up requests'),

-- Administration Mandate
('manage_admins', 'Manage Admin Accounts', 'administration', 'Allows creating and editing administrative staff accounts'),
('delete_admins', 'Delete Admin Accounts', 'administration', 'Allows removing administrative staff accounts'),
('edit_permissions', 'Edit Admin Permissions', 'administration', 'Allows altering role permissions and matrix'),
('toggle_readonly', 'Toggle Read-Only Mode', 'administration', 'Allows enabling maintenance or read-only mode')
ON CONFLICT (permission_key) DO NOTHING;

-- 2. Seed Role Permissions
-- Assistant Role: basic catalog, students, circulation, label printing
INSERT INTO role_permissions (role, permission_id)
SELECT 'assistant', id FROM permissions WHERE permission_key IN (
    'view_books', 'manage_books', 'view_users', 'manage_users',
    'issue_books', 'return_books', 'renew_books',
    'view_fines', 'verify_payments',
    'view_audit_trail', 'print_labels'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Admin Role: everything except root administrative actions
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions WHERE permission_key NOT IN (
    'delete_admins', 'edit_permissions', 'toggle_readonly'
)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Owner Role: all permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'owner', id FROM permissions
ON CONFLICT (role, permission_id) DO NOTHING;

-- 3. Seed System Settings
INSERT INTO system_settings (category, setting_key, setting_value, data_type, setting_type, setting_group, description, is_owner_only, can_edit_role) VALUES
('appearance', 'library_name', 'Al Marakish Library', 'string', 'string', 'general', 'Public name of the library', 0, 'owner'),
('system', 'library_short_name', 'AML', 'string', 'string', 'general', 'Library abbreviation', 0, 'owner'),
('system', 'library_email', 'library@example.com', 'string', 'string', 'general', 'Contact email', 0, 'owner'),
('system', 'library_phone', '+91 1234567890', 'string', 'string', 'general', 'Contact phone', 0, 'owner'),
('system', 'library_logo', '', 'string', 'file', 'general', 'Library logo filename', 0, 'owner'),
('system', 'currency_symbol', '₹', 'string', 'string', 'general', 'Default currency symbol', 0, 'owner'),
('system', 'currency_code', 'INR', 'string', 'string', 'general', 'Currency code (ISO 4217)', 0, 'owner'),
('system', 'borrow_max_books_student', '2', 'string', 'integer', 'borrowing', 'Max books for students', 0, 'owner'),
('system', 'borrow_duration_student', '14', 'string', 'integer', 'borrowing', 'Borrow period for students (days)', 0, 'owner'),
('system', 'loan_period_days', '7', 'string', 'integer', 'circulation', 'Default loan period in days', 0, 'owner'),
('system', 'max_renewals', '2', 'string', 'integer', 'circulation', 'Maximum allowed renewals per book loan', 0, 'owner'),
('system', 'fine_enabled', '1', 'string', 'boolean', 'fines', 'Enable fine system globally', 0, 'owner'),
('system', 'fine_per_day_student', '5', 'string', 'integer', 'fines', 'Daily fine for students', 0, 'owner'),
('system', 'fine_max_limit', '500', 'string', 'integer', 'fines', 'Maximum fine per book', 0, 'owner'),
('system', 'fine_grace_period', '0', 'string', 'integer', 'payment', 'Number of days after due date before fines start', 0, 'owner'),
('system', 'max_fine_allowed', '100', 'string', 'integer', 'payment', 'Max fine allowed before borrowing is blocked', 0, 'owner'),
('system', 'payment_enable_online', '1', 'string', 'boolean', 'payment', 'Enable online fine payments', 0, 'owner'),
('system', 'payment_enable_qr', '1', 'string', 'boolean', 'payment', 'Enable QR code payments', 0, 'owner'),
('system', 'payment_upi_id', 'shinas@upi', 'string', 'string', 'payment', 'UPI ID for payments', 0, 'owner'),
('system', 'payment_qr_code', '', 'string', 'file', 'payment', 'QR code image for payments', 0, 'owner'),
('circulation', 'issued_books_limit', '5', 'number', 'string', 'general', 'Maximum books a student can borrow', 0, 'owner'),
('circulation', 'fine_per_day', '5', 'number', 'string', 'general', 'Fine amount per day for overdue books', 0, 'owner'),
('circulation', 'borrow_duration_days', '7', 'number', 'string', 'general', 'Default borrow duration in days', 0, 'owner'),
('security', 'max_login_attempts', '5', 'number', 'string', 'general', 'Max failed logins before lockout', 1, 'owner'),
('maintenance', 'log_retention_days', '365', 'number', 'string', 'general', 'Days to keep activity logs', 1, 'owner'),
('system', 'library_website', '', 'string', 'string', 'general', 'Official library website URL', 0, 'owner'),
('system', 'library_address', '', 'string', 'string', 'general', 'Physical address of the library', 0, 'owner'),
('system', 'maintenance_mode', '0', 'string', 'boolean', 'security', 'When ON, only owners can access the system', 0, 'owner'),
('system', 'student_self_registration', '1', 'string', 'boolean', 'security', 'Allow students to create their own accounts', 0, 'owner'),
('system', 'primary_color', '#a047f8', 'string', 'string', 'appearance', 'Main brand color for the student portal', 0, 'owner'),
('system', 'system_timezone', 'Asia/Kolkata', 'string', 'string', 'general', 'System timezone for logs and deadlines', 0, 'owner'),
('system', 'secondary_color', '#ffffff', 'string', 'string', 'appearance', 'Secondary brand color/gradients', 0, 'owner'),
('system', 'announcement_text', '', 'string', 'string', 'general', 'Text to show on the student portal home', 0, 'owner'),
('system', 'facebook_url', '', 'string', 'string', 'appearance', 'Library Facebook page URL', 0, 'owner'),
('system', 'email_notifications', '1', 'string', 'boolean', 'general', 'Send email alerts for overdue books', 0, 'owner'),
('system', 'twitter_url', '', 'string', 'string', 'appearance', 'Library Twitter profile URL', 0, 'owner'),
('system', 'kiosk_auto_return', '1', 'string', 'boolean', 'circulation', 'Allow books to be returned via Kiosk without staff intervention', 0, 'owner'),
('system', 'holiday_mode', '0', 'string', 'boolean', 'circulation', 'When ON, no fines are charged for return dates', 0, 'owner'),
('system', 'session_timeout', '60', 'string', 'integer', 'security', 'Admin session timeout in minutes', 0, 'owner'),
('system', 'library_bio', 'A modern library for knowledge seekers.', 'string', 'string', 'appearance', 'Short description of the library', 0, 'owner'),
('system', 'instagram_url', '', 'string', 'string', 'appearance', 'Library Instagram profile URL', 0, 'owner'),

-- Label Printing Settings
('printing', 'label_lib_font_size', '8', 'number', 'number', 'printing', 'Font size for library name on labels (mm)', 0, 'owner'),
('printing', 'label_title_font_size', '7', 'number', 'number', 'printing', 'Font size for book title on labels (mm)', 0, 'owner'),
('printing', 'label_acc_font_size', '9', 'number', 'number', 'printing', 'Font size for accession number on labels (mm)', 0, 'owner'),
('printing', 'label_barcode_height', '10', 'number', 'number', 'printing', 'Height of the barcode on labels (mm)', 0, 'owner'),
('printing', 'label_show_lib_name', 'true', 'boolean', 'boolean', 'printing', 'Show library name on labels', 0, 'owner'),
('printing', 'label_show_title', 'true', 'boolean', 'boolean', 'printing', 'Show book title on labels', 0, 'owner'),
('printing', 'label_show_author', 'false', 'boolean', 'boolean', 'printing', 'Show author on labels', 0, 'owner'),
('printing', 'label_show_isbn', 'false', 'boolean', 'boolean', 'printing', 'Show ISBN on labels', 0, 'owner'),
('printing', 'label_show_publisher', 'false', 'boolean', 'boolean', 'printing', 'Show publisher on labels', 0, 'owner'),
('printing', 'label_show_call_no', 'false', 'boolean', 'boolean', 'printing', 'Show call number on labels', 0, 'owner'),
('printing', 'label_show_barcode', 'true', 'boolean', 'boolean', 'printing', 'Show barcode (scannable) on labels', 0, 'owner'),
('printing', 'label_show_acc_no', 'true', 'boolean', 'boolean', 'printing', 'Show accession number text on labels', 0, 'owner'),
('printing', 'label_call_prefix', 'AML', 'string', 'string', 'printing', 'Prefix for call numbers (e.g. AML)', 0, 'owner'),
('printing', 'label_multiline_call', 'true', 'boolean', 'boolean', 'printing', 'Split call number into 4 lines', 0, 'owner'),
('printing', 'top_margin_mm', '12', 'number', 'number', 'printing', 'Top margin in mm', 0, 'owner'),
('printing', 'side_margin_mm', '5', 'number', 'number', 'printing', 'Side margin in mm', 0, 'owner'),
('printing', 'vertical_pitch_mm', '21', 'number', 'number', 'printing', 'Vertical pitch in mm', 0, 'owner'),
('printing', 'horizontal_pitch_mm', '40', 'number', 'number', 'printing', 'Horizontal pitch in mm', 0, 'owner'),
('printing', 'label_height_mm', '21', 'number', 'number', 'printing', 'Label height in mm', 0, 'owner'),
('printing', 'label_width_mm', '38', 'number', 'number', 'printing', 'Label width in mm', 0, 'owner'),
('printing', 'label_columns', '5', 'number', 'integer', 'printing', 'Label columns per page', 0, 'owner'),
('printing', 'label_rows', '13', 'number', 'integer', 'printing', 'Label rows per page', 0, 'owner'),
('printing', 'page_size', 'A4', 'string', 'string', 'printing', 'Page size for label printing', 0, 'owner'),
('printing', 'barcode_scale', '2', 'number', 'integer', 'printing', 'Barcode scaling factor', 0, 'owner')
ON CONFLICT (setting_key) DO NOTHING;

-- Also seed into legacy settings table
INSERT INTO settings (setting_key, setting_value, setting_group)
SELECT setting_key, setting_value, setting_group FROM system_settings
ON CONFLICT (setting_key) DO NOTHING;

-- 4. Initial System Administrator / Owner Accounts
INSERT INTO admin (username, password, full_name, role, status) VALUES
('owner', 'owner123', 'System Owner', 'owner', 'active'),
('admin', 'admin123', 'Administrator', 'admin', 'active'),
('muflih', '1234', 'Muflih (Librarian)', 'admin', 'active')
ON CONFLICT (username) DO NOTHING;
