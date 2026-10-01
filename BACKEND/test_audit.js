const { query } = require('./config/database');

async function testAuditData() {
    try {
        const audit = await query("SELECT * FROM book_issue_audit LIMIT 5");
        console.log("Audit Records:", JSON.stringify(audit, null, 2));

        const stats = await query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN action_type = 'issue' THEN 1 ELSE 0 END) as issues,
                SUM(CASE WHEN action_type = 'return' THEN 1 ELSE 0 END) as returns,
                SUM(CASE WHEN is_rolled_back = 1 THEN 1 ELSE 0 END) as rolled_back
            FROM book_issue_audit
        `);
        console.log("Stats:", stats);

        const filters = await query(`
            SELECT DISTINCT admin_name FROM book_issue_audit WHERE admin_name IS NOT NULL
        `);
        console.log("Admins:", filters);

    } catch (e) {
        console.error(e);
    }
    process.exit();
}

testAuditData();
