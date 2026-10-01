const { query, queryOne } = require('./config/database');

async function seedSettings() {
    try {
        const settings = [
            { key: 'label_lib_font_size', val: '8', cat: 'printing', type: 'number', desc: 'Font size for library name on labels (mm)' },
            { key: 'label_title_font_size', val: '7', cat: 'printing', type: 'number', desc: 'Font size for book title on labels (mm)' },
            { key: 'label_acc_font_size', val: '9', cat: 'printing', type: 'number', desc: 'Font size for accession number on labels (mm)' },
            { key: 'label_barcode_height', val: '10', cat: 'printing', type: 'number', desc: 'Height of the barcode on labels (mm)' },
            { key: 'label_show_lib_name', val: 'true', cat: 'printing', type: 'boolean', desc: 'Show library name on labels' },
            { key: 'label_show_title', val: 'true', cat: 'printing', type: 'boolean', desc: 'Show book title on labels' },
            { key: 'label_show_author', val: 'false', cat: 'printing', type: 'boolean', desc: 'Show author on labels' },
            { key: 'label_show_isbn', val: 'false', cat: 'printing', type: 'boolean', desc: 'Show ISBN on labels' },
            { key: 'label_show_publisher', val: 'false', cat: 'printing', type: 'boolean', desc: 'Show publisher on labels' },
            { key: 'label_show_call_no', val: 'false', cat: 'printing', type: 'boolean', desc: 'Show call number on labels' },
            { key: 'label_show_barcode', val: 'true', cat: 'printing', type: 'boolean', desc: 'Show barcode (scannable) on labels' },
            { key: 'label_show_acc_no', val: 'true', cat: 'printing', type: 'boolean', desc: 'Show accession number text on labels' },
            { key: 'label_call_prefix', val: 'AML', cat: 'printing', type: 'string', desc: 'Prefix for call numbers (e.g. AML)' },
            { key: 'label_multiline_call', val: 'true', cat: 'printing', type: 'boolean', desc: 'Split call number into 4 lines' }
        ];

        for (const s of settings) {
            const exists = await queryOne('SELECT id FROM system_settings WHERE setting_key = ?', [s.key]);
            if (!exists) {
                await query(
                    'INSERT INTO system_settings (setting_key, setting_value, category, data_type, description) VALUES (?, ?, ?, ?, ?)',
                    [s.key, s.val, s.cat, s.type, s.desc]
                );
                console.log(`✅ Seeded: ${s.key}`);
            }
        }
        console.log('Done!');
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

seedSettings();
