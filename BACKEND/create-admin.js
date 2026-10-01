// Fix admin table and create user
require('dotenv').config();
const mysql = require('mysql2/promise');

async function createAdmin() {
    let connection;

    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'almarakish_db'
        });

        console.log('✅ Connected to database');

        // Add status column if it doesn't exist
        try {
            await connection.execute(`
                ALTER TABLE admin ADD COLUMN status VARCHAR(20) DEFAULT 'active'
            `);
            console.log('✅ Added status column');
        } catch (err) {
            if (err.code !== 'ER_DUP_FIELDNAME') {
                console.log('ℹ️  Status column might already exist');
            }
        }

        // Plain text password
        const hashedPassword = 'admin123';

        // Delete existing admin
        await connection.execute('DELETE FROM admin WHERE username = ?', ['admin']);

        // Try to insert with status, fallback to without status
        try {
            await connection.execute(
                `INSERT INTO admin (username, password, full_name, role, status) 
                 VALUES (?, ?, ?, ?, ?)`,
                ['admin', hashedPassword, 'Administrator', 'admin', 'active']
            );
        } catch (err) {
            // If status column still doesn't work, try without it
            await connection.execute(
                `INSERT INTO admin (username, password, full_name, role) 
                 VALUES (?, ?, ?, ?)`,
                ['admin', hashedPassword, 'Administrator', 'admin']
            );
        }

        console.log('');
        console.log('🎉 ========================================');
        console.log('   ADMIN USER CREATED!');
        console.log('========================================');
        console.log('');
        console.log('📝 Login with:');
        console.log('   Username: admin');
        console.log('   Password: admin123');
        console.log('');
        console.log('🌐 URL: http://localhost:5000/admin/login-converted.html');
        console.log('========================================');

        // Verify
        const [users] = await connection.execute(
            'SELECT * FROM admin WHERE username = ?',
            ['admin']
        );

        if (users.length > 0) {
            console.log('');
            console.log('✅ User verified:');
            console.log(users[0]);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (connection) await connection.end();
    }
}

createAdmin();
