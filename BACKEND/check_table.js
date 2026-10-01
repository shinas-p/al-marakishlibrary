const { query } = require('./config/database');

async function checkTableStructure() {
    console.log('\n🔍 Checking system_settings table structure...\n');

    try {
        const structure = await query('DESCRIBE system_settings');
        console.log('Table Columns:');
        structure.forEach(col => {
            console.log(`  - ${col.Field} (${col.Type})`);
        });
    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    process.exit(0);
}

checkTableStructure();
