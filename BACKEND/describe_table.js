const { query } = require('./config/database');

async function describeTable() {
    try {
        const columns = await query('DESCRIBE system_settings');
        console.log(JSON.stringify(columns, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

describeTable();
