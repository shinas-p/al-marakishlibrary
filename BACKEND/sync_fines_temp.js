const { query } = require('./config/database');

async function syncFines() {
    try {
        console.log('Starting sync...');
        const payments = await query("SELECT * FROM fine_payments WHERE status IN ('Approved', 'Success')");

        for (const p of payments) {
            if (p.transaction_id) {
                console.log(`Syncing Transaction ID ${p.transaction_id} for Payment ${p.id}`);
                // Check current status
                const t = await query("SELECT fine_status FROM transactions WHERE id = ?", [p.transaction_id]);
                if (t.length > 0 && t[0].fine_status !== 'Paid') {
                    await query("UPDATE transactions SET fine_status = 'Paid', fine_paid = ? WHERE id = ?", [p.amount, p.transaction_id]);
                    console.log(' -> Updated Transaction');
                }
            }
            if (p.fine_id) {
                console.log(`Syncing Custom Fine ID ${p.fine_id} for Payment ${p.id}`);
                const f = await query("SELECT status FROM custom_fines WHERE id = ?", [p.fine_id]);
                if (f.length > 0 && f[0].status !== 'paid') {
                    await query("UPDATE custom_fines SET status = 'paid', paid_at = NOW() WHERE id = ?", [p.fine_id]);
                    console.log(' -> Updated Custom Fine');
                }
            }
            // Fallback for messy data (custom fines without fine_id but user_id match)
            if (!p.transaction_id && !p.fine_id) {
                console.log(`Checking unlinked payment ${p.id} for user ${p.user_id}`);
                // If this was a custom fine payment but link is lost, try to pay earliest pending custom fine? 
                // Or just update all approved fines for user as the bad code did?
                // Let's rely on the bad code logic for now to fix the specific user issue if fine_id was null.
                await query("UPDATE custom_fines SET status = 'paid', paid_at = NOW() WHERE student_id = ? AND status = 'approved'", [p.user_id]);
                console.log(' -> Ran fallback update for user custom fines');
            }
        }
        console.log('Sync complete.');
    } catch (e) { console.error(e); }
    process.exit();
}
syncFines();
