const { query } = require('./config/database');

async function checkTables() {
    try {
        const tables = await query('SHOW TABLES');
        const tableNames = tables.map(t => Object.values(t)[0]);
        console.log('Tables:', tableNames);

        if (tableNames.includes('notifications')) {
            console.log('notifications table exists.');
            const description = await query('DESCRIBE notifications');
            console.log('Structure:', description);
        } else {
            console.log('notifications table DOES NOT exist.');
        }
    } catch (err) {
        console.error(err);
    }
    process.exit();
}

checkTables();
