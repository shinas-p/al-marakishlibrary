const { query } = require('./config/database');
require('dotenv').config();

async function checkAdmins() {
    try {
        const admins = await query('SELECT id, username, password, role, status FROM admin');
        console.log(JSON.stringify(admins, null, 2));
        process.exit(0);
    } catch (error) {
        console.error('Error checking admins:', error);
        process.exit(1);
    }
}

checkAdmins();
