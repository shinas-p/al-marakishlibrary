const { query, queryOne } = require('./config/database');
const fs = require('fs');

async function testAdminLogin() {
    let output = '🔍 Testing Admin Login...\n\n';

    try {
        // Check admin table structure
        output += '1. Checking admin table structure:\n';
        const structure = await query('DESCRIBE admin');
        output += JSON.stringify(structure, null, 2) + '\n\n';

        // Check all admin users
        output += '2. Listing all admin users:\n';
        const admins = await query('SELECT id, username, password, full_name, role, status FROM admin');
        output += JSON.stringify(admins, null, 2) + '\n\n';

        // Test login with a specific username/password
        output += '3. Testing login attempt:\n';
        const testUsername = 'admin'; // Change this to your username
        const testPassword = 'admin123'; // Change this to your password

        const admin = await queryOne(
            'SELECT id, username, password, full_name, role, status FROM admin WHERE username = ?',
            [testUsername]
        );

        if (!admin) {
            output += `❌ No admin found with username: ${testUsername}\n`;
        } else {
            output += `✅ Admin found:\n`;
            output += JSON.stringify(admin, null, 2) + '\n\n';
            output += `Password match: ${admin.password === testPassword ? '✅ YES' : '❌ NO'}\n`;
            output += `Expected: "${testPassword}"\n`;
            output += `Database: "${admin.password}"\n`;
            output += `Status: ${admin.status}\n`;
        }

        fs.writeFileSync('admin_login_test.txt', output);
        console.log('✅ Test complete! Check admin_login_test.txt for results.');

    } catch (error) {
        output += '❌ Error: ' + error.message + '\n';
        fs.writeFileSync('admin_login_test.txt', output);
        console.error('❌ Error:', error.message);
    }

    process.exit(0);
}

testAdminLogin();
