const { query, queryOne } = require('./config/database');

async function checkDb() {
    try {
        console.log('--- Database Check ---');

        const adminCount = await queryOne('SELECT COUNT(*) as count FROM admin');
        console.log('Admins count:', adminCount.count);

        const owner = await queryOne("SELECT username FROM admin WHERE role = 'owner'");
        console.log('Owner username:', owner ? owner.username : 'NONE');

        const settingsCount = await queryOne('SELECT COUNT(*) as count FROM system_settings');
        console.log('Settings count:', settingsCount.count);

        if (settingsCount.count === 0) {
            console.log('WARNING: system_settings table is EMPTY!');
        } else {
            const sampleSettings = await query('SELECT category, setting_key FROM system_settings LIMIT 5');
            console.log('Sample settings:', sampleSettings);
        }

    } catch (err) {
        console.error('DB Check failed:', err);
    } finally {
        process.exit();
    }
}

checkDb();
