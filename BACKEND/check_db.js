const { query } = require('./config/database');
async function check() {
    try {
        const cols = await query('SHOW COLUMNS FROM fine_payments');
        let output = '--- Columns in fine_payments ---\n';
        cols.forEach(c => {
            output += `${c.Field} | ${c.Type}\n`;
        });

        const tables = await query('SHOW TABLES');
        output += '\n--- All tables ---\n';
        tables.forEach(t => {
            output += `${Object.values(t)[0]}\n`;
        });

        require('fs').writeFileSync('results.txt', output);
        console.log('Results written to results.txt');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit(0);
    }
}
check();
