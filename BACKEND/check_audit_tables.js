const { query } = require('./config/database');
const fs = require('fs');

async function checkTables() {
    const results = {};
    const tables = ['admin_activity_logs', 'book_issue_audit', 'activity_logs', 'transaction_audit_logs'];

    for (const table of tables) {
        try {
            results[table] = await query(`DESC ${table}`);
        } catch (e) {
            results[table] = 'NOT FOUND';
        }
    }

    fs.writeFileSync('audit_tables_check.json', JSON.stringify(results, null, 2));
    process.exit();
}

checkTables();
