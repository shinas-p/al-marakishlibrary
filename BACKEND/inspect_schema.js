const { query } = require('./config/database');
const fs = require('fs');

async function inspectSchema() {
    try {
        let output = '';
        const tables = ['users', 'books', 'transactions', 'reservations', 'book_suggestions', 'custom_fines', 'fine_payments', 'fines', 'activity_logs', 'admin'];
        for (const table of tables) {
            try {
                output += `\n--- Table: ${table} ---\n`;
                const columns = await query(`DESCRIBE ${table}`);
                output += JSON.stringify(columns, null, 2) + '\n';
            } catch (e) {
                output += `Error reading table ${table}: ${e.message}\n`;
            }
        }
        fs.writeFileSync('schema_output.txt', output);
        console.log('Schema written to schema_output.txt');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

inspectSchema();
