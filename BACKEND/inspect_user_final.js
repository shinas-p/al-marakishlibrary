const { query } = require('./config/database');

async function inspect() {
    try {
        const users = await query("SELECT id, full_name, ad_no FROM users WHERE ad_no = 'STU001'");
        console.log('User:', users);
        if (users.length > 0) {
            const id = users[0].id;
            const trans = await query("SELECT id, fine, fine_status FROM transactions WHERE user_id = ? AND fine > 0", [id]);
            // JSON stringify to avoid cutoff
            console.log('Transactions:', JSON.stringify(trans));
            const custom = await query("SELECT id, fine_amount, status FROM custom_fines WHERE student_id = ?", [id]);
            console.log('CustomFines:', JSON.stringify(custom));
        }
    } catch (e) { console.error(e); }
    process.exit();
}
inspect();
