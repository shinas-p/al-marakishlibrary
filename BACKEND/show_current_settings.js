const { query } = require('./config/database');

async function showCurrentSettings() {
    console.log('\n📋 Current Library Settings:\n');

    try {
        const settings = await query(`
      SELECT setting_key, setting_value
      FROM system_settings
      WHERE setting_key IN ('library_name', 'library_logo', 'library_short_name', 'max_renewals', 'loan_period_days', 'borrow_max_books_student')
      ORDER BY setting_key
    `);

        console.log('┌────────────────────────────┬──────────────────────────────────────┐');
        console.log('│ Setting                    │ Current Value                        │');
        console.log('├────────────────────────────┼──────────────────────────────────────┤');

        settings.forEach(s => {
            const key = s.setting_key.padEnd(26);
            const value = (s.setting_value || '').substring(0, 36).padEnd(36);
            console.log(`│ ${key} │ ${value} │`);
        });

        console.log('└────────────────────────────┴──────────────────────────────────────┘');

        console.log('\n✅ To change library name, run:');
        console.log('   UPDATE system_settings SET setting_value = \'Your Library Name\' WHERE setting_key = \'library_name\';');
        console.log('\n📝 The sidebar will automatically show the new name from database!');
        console.log('   (May take up to 5 minutes due to cache, or refresh by restarting server)\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    process.exit(0);
}

showCurrentSettings();
