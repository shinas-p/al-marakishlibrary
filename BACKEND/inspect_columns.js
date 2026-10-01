const { query } = require('./config/database');

async function describeTable(tableName) {
    try {
        const columns = await query(`DESCRIBE ${tableName}`);
        console.log(JSON.stringify(columns, null, 2));
    } catch (error) {
        console.error('Error describing table:', error);
    } finally {
        process.exit();
    }
}

describeTable(process.argv[2] || 'transactions');
