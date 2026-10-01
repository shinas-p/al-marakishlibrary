const { query } = require('./config/database');

async function migrateAuditLogs() {
    try {
        console.log('--- Audit Log System Migration ---');

        // 1. Create centralized activity_logs table if not exists with improved structure
        await query(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT DEFAULT NULL,
                user_name VARCHAR(255) DEFAULT NULL,
                user_role VARCHAR(50) DEFAULT NULL,
                user_type ENUM('admin', 'student', 'system') DEFAULT 'admin',
                action_type VARCHAR(100) NOT NULL,
                action_category VARCHAR(100) DEFAULT 'general',
                target_id INT DEFAULT NULL,
                target_type VARCHAR(50) DEFAULT NULL,
                target_name VARCHAR(255) DEFAULT NULL,
                action_description TEXT,
                metadata LONGTEXT DEFAULT NULL,
                ip_address VARCHAR(45) DEFAULT NULL,
                user_agent TEXT DEFAULT NULL,
                status VARCHAR(20) DEFAULT 'success',
                severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'low',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX (user_id),
                INDEX (action_type),
                INDEX (action_category),
                INDEX (target_id),
                INDEX (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('✅ activity_logs table created or verified');

        // 2. Add missing columns if table already exists (for existing systems)
        const columns = await query('SHOW COLUMNS FROM activity_logs');
        const colNames = columns.map(c => c.Field);

        const columnsToAdd = [
            { name: 'user_name', type: 'VARCHAR(255) DEFAULT NULL' },
            { name: 'target_id', type: 'INT DEFAULT NULL' },
            { name: 'target_type', type: 'VARCHAR(50) DEFAULT NULL' },
            { name: 'target_name', type: 'VARCHAR(255) DEFAULT NULL' },
            { name: 'metadata', type: 'LONGTEXT DEFAULT NULL' }
        ];

        for (const col of columnsToAdd) {
            if (!colNames.includes(col.name)) {
                await query(`ALTER TABLE activity_logs ADD COLUMN ${col.name} ${col.type}`);
                console.log(`✅ Added column ${col.name}`);
            }
        }

        console.log('Migration Completed Successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration Failed:', error);
        process.exit(1);
    }
}

migrateAuditLogs();
