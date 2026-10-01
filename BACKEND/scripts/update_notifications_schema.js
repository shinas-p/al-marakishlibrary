const { query } = require('../config/database');

async function updateSchema() {
    try {
        console.log('Creating announcements table...');
        await query(`
            CREATE TABLE IF NOT EXISTS announcements (
                id INT PRIMARY KEY AUTO_INCREMENT,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                target_role ENUM('student', 'admin', 'assistant', 'all') NOT NULL DEFAULT 'all',
                created_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at DATE NULL
            )
        `);

        console.log('Creating user_notifications table...');
        await query(`
            CREATE TABLE IF NOT EXISTS user_notifications (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                type ENUM('info', 'success', 'warning', 'error') DEFAULT 'info',
                is_read BOOLEAN DEFAULT FALSE,
                link VARCHAR(255) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        console.log('Schema updated successfully.');
    } catch (error) {
        console.error('Schema update failed:', error);
    }
    process.exit();
}

updateSchema();
