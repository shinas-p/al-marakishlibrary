const { query, beginTransaction, commit, rollback } = require('./config/database');

async function migrateSettings() {
    const connection = await beginTransaction();
    try {
        console.log('Starting settings migration...');

        // Check if category column exists
        const columns = await query('DESCRIBE system_settings');
        const hasCategory = columns.some(c => c.Field === 'category' || c.Field === 'Category');

        if (!hasCategory) {
            console.log('Adding "category" column to system_settings...');
            await query('ALTER TABLE system_settings ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT "system" AFTER id');
        }

        // Check for other missing columns
        const hasDataType = columns.some(c => c.Field === 'data_type');
        if (!hasDataType) {
            console.log('Adding "data_type" column...');
            await query("ALTER TABLE system_settings ADD COLUMN data_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string' AFTER setting_value");
        }

        const hasIsOwnerOnly = columns.some(c => c.Field === 'is_owner_only');
        if (!hasIsOwnerOnly) {
            console.log('Adding "is_owner_only" column...');
            await query("ALTER TABLE system_settings ADD COLUMN is_owner_only BOOLEAN DEFAULT FALSE AFTER description");
        }

        // Seed with default values if empty or to ensure standard keys exist
        console.log('Seeding default settings...');
        const defaults = [
            ['circulation', 'issued_books_limit', '5', 'number', 'Maximum books a student can borrow', 0],
            ['circulation', 'fine_per_day', '5', 'number', 'Fine amount per day for overdue books', 0],
            ['circulation', 'borrow_duration_days', '7', 'number', 'Default borrow duration in days', 0],
            ['appearance', 'library_name', 'Al Marakish Library', 'string', 'Public name of the library', 0],
            ['security', 'max_login_attempts', '5', 'number', 'Max failed logins before lockout', 1],
            ['maintenance', 'log_retention_days', '90', 'number', 'Days to keep activity logs', 1]
        ];

        for (const [cat, key, val, type, desc, ownerOnly] of defaults) {
            await query(`
                INSERT INTO system_settings (category, setting_key, setting_value, data_type, description, is_owner_only)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                category = VALUES(category),
                data_type = VALUES(data_type),
                description = VALUES(description),
                is_owner_only = VALUES(is_owner_only)
            `, [cat, key, val, type, desc, ownerOnly]);
        }

        console.log('Migration COMPLETED successfully.');
    } catch (err) {
        console.error('Migration FAILED:', err);
    } finally {
        process.exit();
    }
}

migrateSettings();
