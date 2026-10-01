const { query } = require('./config/database');
const bcrypt = require('bcryptjs');

async function showAdminCredentials() {
    console.log('\n==============================================');
    console.log('   ADMIN LOGIN CREDENTIALS');
    console.log('==============================================\n');

    try {
        const admins = await query('SELECT id, username, full_name, role, status FROM admin WHERE status = "active"');

        if (admins.length === 0) {
            console.log('❌ No active admin users found in database.\n');
            process.exit(1);
        }

        console.log('Available Admin Accounts:\n');

        admins.forEach((admin, index) => {
            console.log(`${index + 1}. Username: ${admin.username}`);
            console.log(`   Full Name: ${admin.full_name}`);
            console.log(`   Role: ${admin.role}`);
            console.log(`   Status: ${admin.status}`);
            console.log('   ---------------------------------');
        });

        console.log('\n📝 KNOWN PASSWORDS (from database analysis):');
        console.log('   - username: "muflih" → password: "1234"');
        console.log('   - username: "owner" → password: (bcrypt hashed - unknown)');
        console.log('   - username: "admin" → password: (bcrypt hashed - unknown)');

        console.log('\n💡 TIP: If you don\'t know the password for "owner" or "admin",');
        console.log('   use username: "muflih" with password: "1234" to login.');

        console.log('\n🔧 Or create a new admin with a plain password by running:');
        console.log('   node create_admin.js');

        console.log('\n==============================================\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    process.exit(0);
}

showAdminCredentials();
