const { query } = require('../config/database');

/**
 * Get books for label selection
 */
const getLabelSelectionBooks = async (req, res) => {
    try {
        const { sort = 'accession_number', order = 'ASC', limit = 500 } = req.query;

        // Validate sort column
        const allowedSorts = ['id', 'accession_number', 'book_number', 'title', 'author'];
        const sortCol = allowedSorts.includes(sort) ? sort : 'accession_number';
        const sortOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

        const books = await query(
            `SELECT id, accession_number, title, author, category, language, call_number, isbn, publisher FROM books ORDER BY ${sortCol} ${sortOrder} LIMIT ?`,
            [parseInt(limit)]
        );

        // Fetch label settings
        const settingsRaw = await query("SELECT setting_key, setting_value FROM system_settings");
        const settings = {};
        settingsRaw.forEach(s => settings[s.setting_key] = s.setting_value);

        res.json({
            success: true,
            books,
            settings: {
                top_margin: settings.top_margin_mm || 12,
                side_margin: settings.side_margin_mm || 5,
                vertical_pitch: settings.vertical_pitch_mm || 21,
                horizontal_pitch: settings.horizontal_pitch_mm || 40,
                label_height: settings.label_height_mm || 21,
                label_width: settings.label_width_mm || 38,
                columns: settings.label_columns || 5,
                rows: settings.label_rows || 13,
                page_size: settings.page_size || 'A4',
                barcode_scale: settings.barcode_scale || 2,
                barcode_height: settings.label_barcode_height || 10,
                lib_font_size: settings.label_lib_font_size || 8,
                title_font_size: settings.label_title_font_size || 7,
                acc_font_size: settings.label_acc_font_size || 9,
                show_lib_name: settings.label_show_lib_name === 'true',
                show_title: settings.label_show_title === 'true',
                show_author: settings.label_show_author === 'true',
                show_isbn: settings.label_show_isbn === 'true',
                show_publisher: settings.label_show_publisher === 'true',
                show_call_no: settings.label_show_call_no === 'true',
                show_barcode: settings.label_show_barcode === 'true',
                show_acc_no: settings.label_show_acc_no === 'true',
                call_prefix: settings.label_call_prefix || '',
                multiline_call: settings.label_multiline_call === 'true',
                library_name: settings.library_name || 'AL MARAKISH LIBRARY',
                library_short_name: settings.library_short_name || 'AML',
                lib_short_font_size: settings.label_lib_short_font_size || 7,
                call_font_size: settings.label_call_font_size || 10
            }
        });
    } catch (error) {
        console.error('Get label books error:', error);
        res.status(500).json({ error: 'Failed to fetch books for labels' });
    }
};

module.exports = {
    getLabelSelectionBooks
};
