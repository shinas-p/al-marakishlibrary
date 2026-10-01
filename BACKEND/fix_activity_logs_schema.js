const { query } = require('./config/database');

async function fix() {
    try {
        console.log('--- Fixing Database Schema ---');

        // 1. Fix activity_logs table
        const columns = await query('SHOW COLUMNS FROM activity_logs');
        const colNames = columns.map(c => c.Field);

        if (!colNames.includes('metadata')) {
            await query('ALTER TABLE activity_logs ADD COLUMN metadata LONGTEXT DEFAULT NULL AFTER action_description');
            console.log('✅ Added metadata column to activity_logs');
        } else {
            console.log('ℹ️ metadata column already exists in activity_logs');
        }

        // 2. Ensure other columns from migrate_audit_logs.js are there
        const columnsToAdd = [
            { name: 'user_name', type: 'VARCHAR(255) DEFAULT NULL' },
            { name: 'target_id', type: 'INT DEFAULT NULL' },
            { name: 'target_type', type: 'VARCHAR(50) DEFAULT NULL' },
            { name: 'target_name', type: 'VARCHAR(255) DEFAULT NULL' }
        ];

        for (const col of columnsToAdd) {
            if (!colNames.includes(col.name)) {
                await query(`ALTER TABLE activity_logs ADD COLUMN ${col.name} ${col.type}`);
                console.log(`✅ Added column ${col.name} to activity_logs`);
            }
        }

        // 3. Check for any other missing tables or issues
        console.log('--- Verification ---');
        const tables = await query('SHOW TABLES');
        console.log('Existing tables:', tables.map(t => Object.values(t)[0]).join(', '));

        console.log('Done!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Fix failed:', error);
        process.exit(1);
    }
}

fix();
