const { query } = require('./config/database');

async function checkSettings() {
    console.log('\n🔍 Checking System Settings...\n');

    try {
        // Check if settings table exists and has data
        const settings = await query('SELECT * FROM system_settings ORDER BY setting_group, setting_key LIMIT 20');

        if (settings.length === 0) {
            console.log('❌ No settings found in database. Settings table may need to be initialized.');
        } else {
            console.log(`✅ Found ${settings.length} settings in database (showing first 20):\n`);

            console.log('┌─────────────────────────┬───────────────────────────┬────────────────────────┐');
            console.log('│ Group                   │ Key                       │ Value                  │');
            console.log('├─────────────────────────┼───────────────────────────┼────────────────────────┤');

            settings.forEach(s => {
                const group = (s.setting_group || '').padEnd(23);
                const key = (s.setting_key || '').padEnd(25);
                const value = (s.setting_value || '').substring(0, 20).padEnd(22);
                console.log(`│ ${group} │ ${key} │ ${value} │`);
            });

            console.log('└─────────────────────────┴───────────────────────────┴────────────────────────┘');

            // Check specifically for library settings
            console.log('\n📚 Library-specific settings:');
            const libSettings = await query(`
        SELECT setting_key, setting_value 
        FROM system_settings 
        WHERE setting_key IN ('library_name', 'library_logo', 'max_renewals', 'max_books_per_student', 'loan_period_days')
      `);

            if (libSettings.length > 0) {
                libSettings.forEach(s => {
                    console.log(`   ${s.setting_key}: ${s.setting_value}`);
                });
            } else {
                console.log('   ❌ Core library settings not found. They may need to be added.');
            }
        }

        console.log('\n');
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.message.includes('Table') && error.message.includes("doesn't exist")) {
            console.log('\n⚠️  The system_settings table does not exist!');
            console.log('   You need to create it first.');
        }
    }

    process.exit(0);
}

checkSettings();
