const { query, queryOne } = require('./config/database');

async function addMissingSettings() {
    console.log('\n🔧 Adding Missing Settings to Database...\n');

    const newSettings = [
        {
            setting_key: 'max_renewals',
            setting_value: '2',
            setting_group: 'circulation',
            setting_type: 'integer'
        },
        {
            setting_key: 'loan_period_days',
            setting_value: '7',
            setting_group: 'circulation',
            setting_type: 'integer'
        },
        {
            setting_key: 'library_short_name',
            setting_value: 'AML',
            setting_group: 'general',
            setting_type: 'string'
        }
    ];

    try {
        for (const setting of newSettings) {
            // Check if setting already exists
            const exists = await queryOne(
                'SELECT id FROM system_settings WHERE setting_key = ?',
                [setting.setting_key]
            );

            if (exists) {
                console.log(`⏭️  ${setting.setting_key} - Already exists (value: ${exists.setting_value || 'N/A'})`);
            } else {
                await query(
                    `INSERT INTO system_settings 
           (setting_key, setting_value, setting_group, setting_type) 
           VALUES (?, ?, ?, ?)`,
                    [
                        setting.setting_key,
                        setting.setting_value,
                        setting.setting_group,
                        setting.setting_type
                    ]
                );
                console.log(`✅ ${setting.setting_key} - Added with value: ${setting.setting_value}`);
            }
        }

        // Verify the settings
        console.log('\n📋 Current circulation settings:');
        const circSettings = await query(
            'SELECT setting_key, setting_value FROM system_settings WHERE setting_group = ? ORDER BY setting_key',
            ['circulation']
        );
        circSettings.forEach(s => {
            console.log(`   ${s.setting_key}: ${s.setting_value}`);
        });

        console.log('\n✅ Settings setup complete!\n');
    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    process.exit(0);
}

addMissingSettings();
