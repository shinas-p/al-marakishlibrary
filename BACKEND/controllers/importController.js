const xlsx = require('xlsx');
const { query, queryOne, beginTransaction, commit, rollback } = require('../config/database');
const { logAdminActivity } = require('../helpers/adminHelper');

/**
 * Production-Ready User Import
 * Fixes 38-row limit and SQL undefined errors.
 */
const importUsers = async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const connection = await beginTransaction();
    const result = { success: true, inserted: 0, skipped: 0, failed: [] };

    try {
        // Safe Reading: Read ALL rows including blanks to prevent early termination
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet, {
            header: 1,
            blankrows: true,
            defval: null
        });

        if (rows.length < 2) throw new Error("Excel file is empty");

        // Dynamic Mapping
        const header = rows[0];
        const findCol = (terms) => header.findIndex(h => h && terms.some(t => h.toString().toLowerCase().includes(t)));

        const map = {
            ad_no: findCol(['admission', 'ad no', 'id no', 'ad_no']),
            name: findCol(['name', 'student name', 'full name']),
            dob: findCol(['dob', 'birth', 'date of birth']),
            class: findCol(['class', 'section', 'grade']),
            address: findCol(['address']),
            contact: findCol(['contact', 'phone', 'mobile']),
            blood: findCol(['blood']),
            password: findCol(['password'])
        };

        // Fallback for standard template if headers not found
        if (map.ad_no === -1) map.ad_no = 0;
        if (map.name === -1) map.name = 1;
        if (map.dob === -1) map.dob = 2;
        if (map.class === -1) map.class = 3;

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const excelRow = i + 1;

            // Skip truly empty rows
            if (!row || row.every(cell => cell === null || cell === '')) continue;

            // Null-Safe Normalizer (No undefined allowed)
            const get = (idx) => {
                if (idx === -1 || row[idx] === undefined || row[idx] === null) return null;
                const val = row[idx].toString().trim();
                return val === '' ? null : val;
            };

            const ad_no = get(map.ad_no);
            const name = get(map.name);
            const section = get(map.class);
            const rawDob = row[map.dob];

            // STRICT VALIDATION (The 4 Required Fields)
            if (!ad_no || !name || !section || !rawDob) {
                let missing = [];
                if (!ad_no) missing.push("Admission No");
                if (!name) missing.push("Student Name");
                if (!section) missing.push("Class/Section");
                if (!rawDob) missing.push("Date of Birth");

                result.skipped++;
                result.failed.push({
                    row: excelRow,
                    identifier: ad_no || `Row ${excelRow}`,
                    reason: `Missing Required: ${missing.join(', ')}`,
                    status: 'skipped'
                });
                continue;
            }

            // Date Conversion
            let finalDob = null;
            let dobPass = '';
            if (rawDob) {
                try {
                    const d = (typeof rawDob === 'number') ?
                        new Date(Math.round((rawDob - 25569) * 86400 * 1000)) :
                        new Date(rawDob);
                    if (!isNaN(d.getTime())) {
                        finalDob = d.toISOString().split('T')[0];
                        dobPass = `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;
                    }
                } catch (e) { }
            }

            if (!finalDob) {
                result.skipped++;
                result.failed.push({ row: excelRow, identifier: ad_no, reason: "Invalid Date of Birth format", status: 'skipped' });
                continue;
            }

            // Optional Fields -> Guaranteed NULL
            const address = get(map.address);
            const contact = get(map.contact);
            const blood = get(map.blood);
            const password = get(map.password) || dobPass || '123456';

            try {
                // Duplicate check
                const existing = await queryOne('SELECT id FROM users WHERE ad_no = ?', [ad_no]);
                if (existing) {
                    result.skipped++;
                    result.failed.push({ row: excelRow, identifier: ad_no, reason: "Duplicate Admission No", status: 'skipped' });
                    continue;
                }

                await connection.execute(
                    `INSERT INTO users (ad_no, full_name, date_of_birth, address, contact, blood_group, section, password, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
                    [ad_no, name, finalDob, address, contact, blood, section, password]
                );
                result.inserted++;
            } catch (err) {
                result.failed.push({ row: excelRow, identifier: ad_no, reason: err.message, status: 'failed' });
            }
        }

        await commit(connection);
        await logAdminActivity(req.user.id, 'import_users', `Imported ${result.inserted} users`);
        res.json(result);
    } catch (error) {
        await rollback(connection);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Production-Ready Book Import
 */
const importBooks = async (req, res) => {
    console.log(`📥 [Import] Starting books import. File: ${req.file ? req.file.originalname : 'none'}`);
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const result = { success: true, inserted: 0, skipped: 0, failed: [] };

    try {
        console.log('📄 [Import] Parsing Excel...');
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, blankrows: true, defval: null });

        console.log(`📊 [Import] Rows to process: ${rows.length - 1}`);
        if (rows.length < 2) throw new Error("Excel file is empty");

        const header = rows[0];
        const findCol = (terms) => header.findIndex(h => h && terms.some(t => h.toString().toLowerCase().includes(t)));

        const map = {
            acc: findCol(['acc', 'accession', 'id', 'admission']),
            title: findCol(['title', 'book name', 'name']),
            author: findCol(['author', 'writer']),
            isbn: findCol(['isbn']),
            cat: findCol(['category', 'type', 'genre']),
            count: findCol(['count', 'quantity', 'total', 'copy']),
            lang: findCol(['language', 'lang']),
            call_no: findCol(['call', 'call no', 'call number']),
            publisher: findCol(['publisher', 'pub'])
        };

        // Fallback mapping
        if (map.acc === -1) map.acc = 0;
        if (map.title === -1) map.title = header.length > 3 ? 3 : 1;

        console.log('🗺️ [Import] Map:', JSON.stringify(map));

        // Pre-fetch all accession numbers
        const existingBooks = await query('SELECT accession_number FROM books');
        const existingAccs = new Set(existingBooks.map(b => b.accession_number ? b.accession_number.toString().trim() : ''));

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const excelRow = i + 1;

            if (!row || row.every(cell => cell === null || cell === '')) continue;

            const get = (idx) => {
                if (idx === -1 || row[idx] === undefined || row[idx] === null) return null;
                const val = row[idx].toString().trim();
                return val === '' ? null : val;
            };

            const accRaw = get(map.acc);
            const title = get(map.title);

            if (!title) {
                result.skipped++;
                result.failed.push({ row: excelRow, identifier: accRaw || 'Unknown', reason: "Missing Title", status: 'skipped' });
                continue;
            }

            try {
                const acc_val = accRaw || `ACC${Date.now()}${i}`;

                if (existingAccs.has(acc_val.toString().trim())) {
                    result.skipped++;
                    result.failed.push({ row: excelRow, identifier: acc_val, reason: "Duplicate Accession No", status: 'skipped' });
                    continue;
                }

                const data = {
                    acc: acc_val,
                    title: title,
                    author: get(map.author),
                    cat: get(map.cat) || 'General',
                    isbn: get(map.isbn),
                    count: parseInt(get(map.count)) || 1,
                    lang: get(map.lang) || 'English',
                    call: get(map.call_no),
                    pub: get(map.publisher)
                };

                await query(
                    `INSERT INTO books (accession_number, book_number, title, author, category, status, isbn, count, language, call_number, publisher)
                     VALUES (?, ?, ?, ?, ?, 'Available', ?, ?, ?, ?, ?)`,
                    [data.acc, data.acc, data.title, data.author, data.cat, data.isbn, data.count, data.lang, data.call, data.pub]
                );

                existingAccs.add(acc_val.toString().trim());
                result.inserted++;

            } catch (err) {
                console.error(`❌ [Row ${excelRow}] Error:`, err.message);
                result.failed.push({ row: excelRow, identifier: accRaw || 'Unknown', reason: err.message, status: 'failed' });
            }
        }

        console.log(`✅ [Import] Completed. Inserted: ${result.inserted}`);
        await logAdminActivity(req.user.id, 'import_books', `Imported ${result.inserted} books`);
        res.json(result);

    } catch (error) {
        console.error('💥 [Import] Fatal:', error);
        res.status(500).json({ error: error.message });
    }
};

const downloadSample = (req, res) => {
    try {
        const { type } = req.params;
        let data = (type === 'users') ?
            [['Admission No', 'Full Name', 'Date of Birth', 'Class', 'Address', 'Contact', 'Blood', 'Password'], ['AD001', 'John Doe', '2005-15-05', 'Grade 10', 'Main St', '9876543210', 'O+', '']] :
            [['ACC No', 'ISBN', 'Call No', 'Title', 'Author', 'Category', 'Count', 'Language', 'Publisher'], ['ACC101', '978123456789', '813.54', 'The Great Gatsby', 'F. Scott Fitzgerald', 'Fiction', '1', 'English', 'Scribner']];

        const ws = xlsx.utils.aoa_to_sheet(data);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, "Sample");

        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Sample_${type}.xlsx`);
        res.send(buffer);
        console.log(`📤 [Sample] Downloaded ${type} sample`);
    } catch (error) {
        console.error('Sample download error:', error);
        res.status(500).send('Error generating sample');
    }
};

module.exports = { importUsers, importBooks, downloadSample };
