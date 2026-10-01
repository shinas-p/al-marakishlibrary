const { query } = require('./config/database');

async function fixDatabase() {
    try {
        console.log('Starting database fix...');

        // 1. Create activity_logs if missing
        await query(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT DEFAULT NULL,
                user_type VARCHAR(50) DEFAULT 'admin',
                user_role VARCHAR(50) DEFAULT NULL,
                action_type VARCHAR(100) NOT NULL,
                action_category VARCHAR(100) DEFAULT 'general',
                action_description TEXT,
                ip_address VARCHAR(45) DEFAULT NULL,
                user_agent TEXT DEFAULT NULL,
                status VARCHAR(20) DEFAULT 'success',
                severity VARCHAR(20) DEFAULT 'low',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('✅ activity_logs table ready');

        // 2. Create security_logs if missing
        await query(`
            CREATE TABLE IF NOT EXISTS security_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                event_type VARCHAR(100) NOT NULL,
                description TEXT,
                ip_address VARCHAR(45) DEFAULT NULL,
                user_agent TEXT DEFAULT NULL,
                severity VARCHAR(20) DEFAULT 'medium',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('✅ security_logs table ready');

        // 3. Create system_backups if missing
        await query(`
            CREATE TABLE IF NOT EXISTS system_backups (
                id INT AUTO_INCREMENT PRIMARY KEY,
                backup_name VARCHAR(255) NOT NULL,
                backup_type VARCHAR(50) DEFAULT 'manual',
                file_path VARCHAR(500) DEFAULT NULL,
                file_size BIGINT DEFAULT 0,
                status VARCHAR(50) DEFAULT 'completed',
                created_by INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('✅ system_backups table ready');

        // 4. Add missing columns to admin table
        const adminCols = await query('SHOW COLUMNS FROM admin');
        const adminColNames = adminCols.map(c => c.Field);

        if (!adminColNames.includes('last_login')) {
            await query('ALTER TABLE admin ADD COLUMN last_login TIMESTAMP NULL DEFAULT NULL');
            console.log('✅ Added last_login to admin');
        }
        if (!adminColNames.includes('locked_until')) {
            await query('ALTER TABLE admin ADD COLUMN locked_until TIMESTAMP NULL DEFAULT NULL');
            console.log('✅ Added locked_until to admin');
        }
        if (!adminColNames.includes('profile_photo')) {
            await query('ALTER TABLE admin ADD COLUMN profile_photo VARCHAR(255) DEFAULT NULL');
            console.log('✅ Added profile_photo to admin');
        }
        if (!adminColNames.includes('deleted_at')) {
            await query('ALTER TABLE admin ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL');
            console.log('✅ Added deleted_at to admin');
        }
        if (!adminColNames.includes('phone')) {
            await query('ALTER TABLE admin ADD COLUMN phone VARCHAR(20) DEFAULT NULL');
            console.log('✅ Added phone to admin');
        }

        // 5. Check if 'settings' table should be unified with 'system_settings'
        // The code seems to use 'system_settings'.

        console.log('Database fix completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error fixing database:', error);
        process.exit(1);
    }
}

fixDatabase();
