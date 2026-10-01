const { query } = require('../config/database');

/**
 * Get activity logs with filters (Unified Audit Logs)
 */
const getActivityLogs = async (req, res) => {
    try {
        const {
            user_id,
            category,
            action,
            target_type,
            severity,
            search,
            start_date,
            end_date,
            limit = 100,
            offset = 0
        } = req.query;

        // Security: Non-owners can only see their own logs
        const isOwner = req.user.role === 'owner';

        let sql = `SELECT * FROM activity_logs WHERE 1=1`;
        const params = [];

        if (!isOwner) {
            sql += " AND user_id = ? AND user_type = 'admin'";
            params.push(req.user.id);
        } else if (user_id) {
            sql += " AND user_id = ?";
            params.push(user_id);
        }

        if (category) {
            sql += " AND action_category = ?";
            params.push(category);
        }

        if (action) {
            sql += " AND action_type = ?";
            params.push(action);
        }

        if (target_type) {
            sql += " AND target_type = ?";
            params.push(target_type);
        }

        if (severity) {
            sql += " AND severity = ?";
            params.push(severity);
        }

        if (search) {
            sql += " AND (action_description LIKE ? OR target_name LIKE ? OR user_name LIKE ?)";
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        if (start_date && end_date) {
            sql += " AND created_at BETWEEN ? AND ?";
            params.push(start_date + ' 00:00:00', end_date + ' 23:59:59');
        }

        // Count total for pagination
        const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
        const [totalResult] = await query(countSql, params);
        const total = totalResult.total;

        // Add sorting and limit
        sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
        params.push(parseInt(limit), parseInt(offset));

        const logs = await query(sql, params);

        // Fetch dynamic filter options for the UI
        const [categories, actions, targetTypes, users] = await Promise.all([
            query("SELECT DISTINCT action_category FROM activity_logs WHERE action_category IS NOT NULL"),
            query("SELECT DISTINCT action_type FROM activity_logs"),
            query("SELECT DISTINCT target_type FROM activity_logs WHERE target_type IS NOT NULL"),
            isOwner ? query("SELECT DISTINCT user_id, user_name, user_role FROM activity_logs WHERE user_name IS NOT NULL") : Promise.resolve([])
        ]);

        res.json({
            success: true,
            total,
            logs,
            filters: {
                categories: categories.map(c => c.action_category),
                actions: actions.map(a => a.action_type),
                targetTypes: targetTypes.map(t => t.target_type),
                users: users
            }
        });
    } catch (error) {
        console.error('Get activity logs error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch activity logs' });
    }
};

/**
 * Get Audit Stats for Owner Dashboard
 */
const getAuditStats = async (req, res) => {
    try {
        if (req.user.role !== 'owner') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const [userActivity, frequentEdits, suspiciousActivity] = await Promise.all([
            // Who is most active
            query(`
                SELECT user_name, user_role, COUNT(*) as count 
                FROM activity_logs 
                WHERE created_at > (NOW() - INTERVAL '30 DAY')
                GROUP BY user_id, user_name, user_role 
                ORDER BY count DESC 
                LIMIT 5
            `),
            // Frequent edits (suspicious pattern)
            query(`
                SELECT target_name, target_type, COUNT(*) as edit_count
                FROM activity_logs
                WHERE (action_type LIKE '%UPDATE%' OR action_type LIKE '%EDIT%')
                AND created_at > (NOW() - INTERVAL '7 DAY')
                GROUP BY target_id, target_name, target_type
                HAVING COUNT(*) > 3
                ORDER BY edit_count DESC
            `),
            // Failed logins or high severity actions
            query(`
                SELECT * FROM activity_logs 
                WHERE (severity IN ('high', 'critical') OR status = 'failed')
                ORDER BY created_at DESC 
                LIMIT 10
            `)
        ]);

        res.json({
            success: true,
            stats: {
                topActiveUsers: userActivity,
                frequentEdits,
                criticalEvents: suspiciousActivity
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch audit stats' });
    }
};

/**
 * Get Book Issue Audit Logs
 */
const getBookIssueAudit = async (req, res) => {
    try {
        const {
            admin_id,
            source,
            action_type,
            status,
            start_date,
            end_date,
            search,
            limit = 50,
            offset = 0
        } = req.query;

        let sql = `SELECT * FROM book_issue_audit WHERE 1=1`;
        const params = [];

        if (admin_id && admin_id !== 'all') {
            sql += " AND admin_id = ?";
            params.push(admin_id);
        }

        if (source && source !== 'all') {
            sql += " AND action_source = ?";
            params.push(source);
        }

        if (action_type) {
            sql += " AND action_type = ?";
            params.push(action_type);
        }

        if (status) {
            sql += " AND current_status = ?";
            params.push(status);
        }

        if (start_date && end_date) {
            sql += " AND issued_at BETWEEN ? AND ?";
            params.push(start_date + ' 00:00:00', end_date + ' 23:59:59');
        }

        if (search) {
            sql += " AND (book_title LIKE ? OR student_name LIKE ? OR accession_number LIKE ? OR student_ad_no LIKE ?)";
            const p = `%${search}%`;
            params.push(p, p, p, p);
        }

        // Stats for the header
        const statsSql = `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN action_type = 'issue' THEN 1 ELSE 0 END) as issues,
                SUM(CASE WHEN action_type = 'return' THEN 1 ELSE 0 END) as returns,
                SUM(CASE WHEN is_rolled_back = true THEN 1 ELSE 0 END) as rolled_back
            FROM book_issue_audit
        `;

        const [records, stats, admins, sources] = await Promise.all([
            query(sql + " ORDER BY issued_at DESC LIMIT ? OFFSET ?", [...params, parseInt(limit), parseInt(offset)]),
            queryOne(statsSql),
            query("SELECT DISTINCT admin_id, admin_name FROM book_issue_audit WHERE admin_name IS NOT NULL"),
            query("SELECT DISTINCT action_source FROM book_issue_audit")
        ]);

        const totalResult = await query(sql.replace('SELECT *', 'SELECT COUNT(*) as total'), params);

        res.json({
            success: true,
            logs: records,
            total: totalResult[0].total,
            stats,
            filters: {
                admins,
                sources: sources.map(s => s.action_source)
            }
        });
    } catch (error) {
        console.error('Audit Log Error:', error);
        res.status(500).json({ success: false, error: 'Database error' });
    }
};

/**
 * Rollback a Transaction Audit Record
 */
const rollbackTransaction = async (req, res) => {
    const { id } = req.params;
    const { beginTransaction, commit, rollback } = require('../config/database');
    const connection = await beginTransaction();

    try {
        const audit = await queryOne("SELECT * FROM book_issue_audit WHERE id = ?", [id]);
        if (!audit) {
            await rollback(connection);
            return res.status(404).json({ error: 'Audit record not found' });
        }

        if (audit.is_rolled_back) {
            await rollback(connection);
            return res.status(400).json({ error: 'Already rolled back' });
        }

        // Logic to reverse based on action_type
        if (audit.action_type === 'issue') {
            // Reversing an issue = returning the book
            await connection.execute("UPDATE transactions SET status = 'Returned', return_date = NOW() WHERE id = ?", [audit.transaction_id]);
            await connection.execute("UPDATE books SET count = count + 1 WHERE id = ?", [audit.book_id]);
        } else if (audit.action_type === 'return') {
            // Reversing a return = making it borrowed again
            await connection.execute("UPDATE transactions SET status = 'Borrowed', return_date = NULL WHERE id = ?", [audit.transaction_id]);
            await connection.execute("UPDATE books SET count = count - 1 WHERE id = ?", [audit.book_id]);
        }

        await connection.execute("UPDATE book_issue_audit SET is_rolled_back = true WHERE id = ?", [id]);

        const { logActivity } = require('../helpers/adminHelper');
        await logActivity({
            action: 'ROLLBACK_AUDIT',
            category: 'system',
            targetId: audit.id,
            targetType: 'audit',
            targetName: `Audit ID: ${id}`,
            description: `Rolled back ${audit.action_type} for ${audit.book_title}`,
            severity: 'high'
        }, req);

        await commit(connection);
        res.json({ success: true, message: 'Transaction rolled back successfully' });
    } catch (error) {
        await rollback(connection);
        console.error('Rollback error:', error);
        res.status(500).json({ error: 'Failed to rollback transaction' });
    }
};

module.exports = {
    getActivityLogs,
    getAuditStats,
    getBookIssueAudit,
    rollbackTransaction
};
