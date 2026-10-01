const { query } = require('./config/database');
async function check() {
    try {
        const settings = await query('SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE "%fine%"');
        settings.forEach(s => console.log(`${s.setting_key}: ${s.setting_value}`));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
