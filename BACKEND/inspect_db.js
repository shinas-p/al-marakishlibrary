const { query } = require('./config/database');

async function inspect() {
    try {
        const tables = await query('SHOW TABLES');
        console.log('Tables:', tables.map(t => Object.values(t)[0]).join(', '));

        const borrowReq = await query('SHOW COLUMNS FROM borrow_requests');
        console.log('\nborrow_requests columns:', borrowReq.map(c => c.Field).join(', '));

        const books = await query('SHOW COLUMNS FROM books');
        console.log('\nbooks columns:', books.map(c => c.Field).join(', '));

    } catch (e) {
        console.error('Inspection failed:', e.message);
    }
    process.exit();
}
inspect();
