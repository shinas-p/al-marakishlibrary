const { query, queryOne } = require('./config/database');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

async function createOrUpdateAdmin() {
    console.log('\n==============================================');
    console.log('   CREATE OR UPDATE ADMIN USER');
    console.log('==============================================\n');

    try {
        const action = await askQuestion('Do you want to (1) Create new admin or (2) Reset password? [1/2]: ');

        if (action === '1') {
            // Create new admin
            const username = await askQuestion('Enter username: ');
            const password = await askQuestion('Enter password: ');
            const fullName = await askQuestion('Enter full name: ');
            const role = await askQuestion('Enter role (owner/admin/assistant) [admin]: ') || 'admin';

            // Check if username exists
            const existing = await queryOne('SELECT id FROM admin WHERE username = ?', [username]);
            if (existing) {
                console.log('\n❌ Username already exists!');
                rl.close();
                process.exit(1);
            }

            // Insert new admin with plain text password
            await query(
                'INSERT INTO admin (username, password, full_name, role, status) VALUES (?, ?, ?, ?, ?)',
                [username, password, fullName, role, 'active']
            );

            console.log('\n✅ Admin user created successfully!');
            console.log(`   Username: ${username}`);
            console.log(`   Password: ${password}`);
            console.log(`   Full Name: ${fullName}`);
            console.log(`   Role: ${role}`);

        } else if (action === '2') {
            // Reset password
            const username = await askQuestion('Enter username to reset: ');
            const newPassword = await askQuestion('Enter new password: ');

            // Check if user exists
            const existing = await queryOne('SELECT id FROM admin WHERE username = ?', [username]);
            if (!existing) {
                console.log('\n❌ Username not found!');
                rl.close();
                process.exit(1);
            }

            // Update password (plain text)
            await query(
                'UPDATE admin SET password = ? WHERE username = ?',
                [newPassword, username]
            );

            console.log('\n✅ Password updated successfully!');
            console.log(`   Username: ${username}`);
            console.log(`   New Password: ${newPassword}`);

        } else {
            console.log('\n❌ Invalid option!');
        }

        console.log('\n==============================================\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    rl.close();
    process.exit(0);
}

createOrUpdateAdmin();
