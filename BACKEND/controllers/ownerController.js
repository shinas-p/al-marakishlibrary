/**
 * ================================================
 * OWNER SETTINGS CONTROLLER
 * ================================================
 * Complete system-wide settings management (Owner Only)
 */

const { query, queryOne } = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

/**
 * Get All System Settings (Grouped by Category)
 */
const getAllSettings = async (req, res) => {
    try {
        const settings = await query(
            'SELECT * FROM system_settings ORDER BY category, setting_key'
        );

        // Group by category
        const grouped = settings.reduce((acc, setting) => {
            if (!acc[setting.category]) {
                acc[setting.category] = [];
            }
            acc[setting.category].push({
                key: setting.setting_key,
                value: setting.setting_value,
                dataType: setting.data_type,
                description: setting.description,
                isOwnerOnly: setting.is_owner_only
            });
            return acc;
        }, {});

        res.json({
            success: true,
            settings: grouped
        });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
};

/**
 * Get Settings by Category
 */
const getSettingsByCategory = async (req, res) => {
    try {
        const { category } = req.params;

        const settings = await query(
            'SELECT setting_key AS `key`, setting_value AS value, data_type AS dataType, description FROM system_settings WHERE category = ?',
            [category]
        );

        res.json({
            success: true,
            category,
            settings
        });
    } catch (error) {
        console.error('Get category settings error:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
};

/**
 * Update System Setting
 */
const updateSetting = async (req, res) => {
    try {
        const { key, value } = req.body;

        if (!key) {
            return res.status(400).json({ error: 'Setting key is required' });
        }

        // Check if setting exists
        const setting = await queryOne(
            'SELECT * FROM system_settings WHERE setting_key = ?',
            [key]
        );

        if (!setting) {
            return res.status(404).json({ error: 'Setting not found' });
        }

        // Check if owner-only
        if (setting.is_owner_only && req.user.role !== 'owner') {
            return res.status(403).json({ error: 'Owner role required to change this setting' });
        }

        // Update setting
        await query(
            'UPDATE system_settings SET setting_value = ?, updated_by = ?, updated_at = NOW() WHERE setting_key = ?',
            [value, req.user.id, key]
        );

        // Log the change
        await query(
            `INSERT INTO activity_logs (user_id, user_type, user_role, action_type, action_category, 
       action_description, ip_address, status, severity)
       VALUES (?, 'admin', ?, 'update_setting', 'system', ?, ?, 'success', 'medium')`,
            [req.user.id, req.user.role, `Changed setting: ${key} = ${value}`, req.ip]
        );

        res.json({
            success: true,
            message: 'Setting updated successfully',
            key,
            value
        });
    } catch (error) {
        console.error('Update setting error:', error);
        res.status(500).json({ error: 'Failed to update setting' });
    }
};

const { logActivity } = require('../helpers/adminHelper');

/**
 * Update Multiple Settings at Once
 */
const updateBulkSettings = async (req, res) => {
    try {
        const { settings, category = 'system' } = req.body;

        if (!settings) {
            return res.status(400).json({ error: 'Settings data is required' });
        }

        let settingsArray = [];
        if (Array.isArray(settings)) {
            settingsArray = settings;
        } else if (typeof settings === 'object') {
            settingsArray = Object.keys(settings).map(key => ({ key, value: settings[key] }));
        }

        if (settingsArray.length === 0) {
            return res.status(400).json({ error: 'No settings provided to update' });
        }

        let updatedCount = 0;
        for (const { key, value } of settingsArray) {
            // Re-verify existence to prevent creating orphaned settings
            const exists = await queryOne('SELECT id FROM system_settings WHERE setting_key = ?', [key]);
            if (exists) {
                await query(
                    'UPDATE system_settings SET setting_value = ?, updated_by = ? WHERE setting_key = ?',
                    [value, req.user.id, key]
                );
                updatedCount++;
            }
        }

        // Log bulk update
        await logActivity({
            action: 'BULK_UPDATE_SETTINGS',
            category: category,
            description: `Updated ${updatedCount} settings in category: ${category}`,
            metadata: { count: updatedCount, category },
            severity: 'high'
        }, req);

        res.json({
            success: true,
            message: `${updatedCount} settings updated successfully`
        });
    } catch (error) {
        console.error('Bulk update settings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
};

/**
 * Get System Health Status
 */
const getSystemHealth = async (req, res) => {
    try {
        const health = {
            server: {
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                nodeVersion: process.version,
                platform: process.platform,
                cpuUsage: process.cpuUsage()
            },
            database: {
                status: 'connected',
                size: null,
                tableCount: null
            },
            storage: {
                uploadsSize: null,
                backupsSize: null
            }
        };

        // Get database size
        let dbSizeMb = 0;
        let tableCount = 0;
        try {
            const dbStats = await queryOne(`
                SELECT 
                    ROUND((pg_database_size(current_database()) / (1024.0 * 1024.0))::numeric, 2) AS size_mb,
                    (SELECT count(*)::int FROM information_schema.tables WHERE table_schema = 'public') AS table_count
            `);
            dbSizeMb = dbStats?.size_mb || 0;
            tableCount = dbStats?.table_count || 0;
        } catch (e) {
            try {
                const dbStatsFallback = await queryOne(`
                    SELECT 
                        SUM(data_length + index_length) / 1024 / 1024 AS size_mb,
                        COUNT(*) AS table_count
                    FROM information_schema.TABLES 
                    WHERE table_schema = 'public'
                `);
                dbSizeMb = dbStatsFallback?.size_mb || 0;
                tableCount = dbStatsFallback?.table_count || 0;
            } catch (fallbackErr) {
                dbSizeMb = 0;
                tableCount = 0;
            }
        }

        health.database.size = dbSizeMb;
        health.database.tableCount = tableCount;

        // Get uploads directory size
        try {
            const uploadsPath = path.join(__dirname, '../uploads');
            const uploadsStats = await fs.stat(uploadsPath);
            health.storage.uploadsSize = uploadsStats.size / 1024 / 1024; // MB
        } catch (e) {
            health.storage.uploadsSize = 0;
        }

        res.json({
            success: true,
            health
        });
    } catch (error) {
        console.error('Get system health error:', error);
        res.status(500).json({ error: 'Failed to fetch system health' });
    }
};

/**
 * Create Database Backup
 */
const createBackup = async (req, res) => {
    try {
        const backupName = `backup_${Date.now()}.sql`;
        const backupPath = path.join(__dirname, '../backups', backupName);

        // Create backups directory if it doesn't exist
        await fs.mkdir(path.join(__dirname, '../backups'), { recursive: true });

        // Generate database backup SQL
        const tablesResult = await query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
        let dumpSql = `-- AL-MARAKISH DATABASE BACKUP\n-- Generated At: ${new Date().toISOString()}\n\n`;

        for (const row of tablesResult) {
            const table = row.table_name || Object.values(row)[0];
            const rows = await query(`SELECT * FROM "${table}"`);
            if (rows && rows.length > 0) {
                dumpSql += `-- Table: ${table}\n`;
                for (const r of rows) {
                    const keys = Object.keys(r);
                    const values = keys.map(k => {
                        const val = r[k];
                        if (val === null || val === undefined) return 'NULL';
                        if (typeof val === 'number') return val;
                        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
                        if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
                        return `'${String(val).replace(/'/g, "''")}'`;
                    });
                    dumpSql += `INSERT INTO "${table}" ("${keys.join('", "')}") VALUES (${values.join(', ')});\n`;
                }
                dumpSql += '\n';
            }
        }

        await fs.writeFile(backupPath, dumpSql, 'utf8');

        // Get file size
        const stats = await fs.stat(backupPath);

        // Record backup in database
        await query(
            `INSERT INTO system_backups (backup_name, backup_type, file_path, file_size, created_by, status)
             VALUES (?, 'manual', ?, ?, ?, 'completed')`,
            [backupName, backupPath, stats.size, req.user.id]
        );

        // Log activity
        await query(
            `INSERT INTO activity_logs (user_id, user_type, user_role, action_type, action_category, 
             action_description, ip_address, status, severity)
             VALUES (?, 'admin', ?, 'create_backup', 'maintenance', ?, ?, 'success', 'high')`,
            [req.user.id, req.user.role, `Created database backup: ${backupName}`, req.ip]
        );

        res.json({
            success: true,
            message: 'Backup created successfully',
            backup: {
                name: backupName,
                size: stats.size,
                path: backupPath
            }
        });
    } catch (error) {
        console.error('Create backup error:', error);
        res.status(500).json({ error: 'Failed to create backup: ' + error.message });
    }
};

/**
 * List All Backups
 */
const listBackups = async (req, res) => {
    try {
        const backups = await query(
            `SELECT b.*, a.full_name AS created_by_name 
       FROM system_backups b
       LEFT JOIN admin a ON b.created_by = a.id
       ORDER BY b.created_at DESC`
        );

        res.json({
            success: true,
            backups
        });
    } catch (error) {
        console.error('List backups error:', error);
        res.status(500).json({ error: 'Failed to fetch backups' });
    }
};

/**
 * Database Cleanup & Optimization
 */
const optimizeDatabase = async (req, res) => {
    try {
        // Get all tables
        const tables = await query('SHOW TABLES');
        const tableNames = tables.map(t => Object.values(t)[0]);

        // Optimize each table
        for (const table of tableNames) {
            await query(`OPTIMIZE TABLE ${table}`);
        }

        // Log activity
        await query(
            `INSERT INTO activity_logs (user_id, user_type, user_role, action_type, action_category, 
       action_description, ip_address, status, severity)
       VALUES (?, 'admin', ?, 'optimize_database', 'maintenance', ?, ?, 'success', 'medium')`,
            [req.user.id, req.user.role, `Optimized ${tableNames.length} tables`, req.ip]
        );

        res.json({
            success: true,
            message: `Optimized ${tableNames.length} tables`,
            tables: tableNames
        });
    } catch (error) {
        console.error('Optimize database error:', error);
        res.status(500).json({ error: 'Failed to optimize database' });
    }
};

/**
 * Clean Old Logs
 */
const cleanOldLogs = async (req, res) => {
    try {
        const retentionDays = await queryOne(
            'SELECT setting_value FROM system_settings WHERE setting_key = ?',
            ['log_retention_days']
        );

        const days = parseInt(retentionDays?.setting_value || 90);

        const deletedActivity = await query(
            "DELETE FROM activity_logs WHERE created_at < NOW() - (? * INTERVAL '1 day')",
            [days]
        );

        const deletedSecurity = await query(
            "DELETE FROM security_logs WHERE created_at < NOW() - (? * INTERVAL '1 day')",
            [days]
        );

        res.json({
            success: true,
            message: 'Old logs cleaned successfully',
            deleted: {
                activityLogs: deletedActivity.affectedRows || 0,
                securityLogs: deletedSecurity.affectedRows || 0
            }
        });
    } catch (error) {
        console.error('Clean logs error:', error);
        res.status(500).json({ error: 'Failed to clean logs' });
    }
};

// Upload Branding Asset (Logo, QR Code)
const uploadBrandingAsset = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { key } = req.body;
        if (!key) {
            return res.status(400).json({ error: 'Setting key is required' });
        }

        const filename = req.file.filename;

        // Update the setting in the database
        await query(
            'UPDATE system_settings SET setting_value = ?, updated_by = ? WHERE setting_key = ?',
            [filename, req.user.id, key]
        );

        res.json({
            success: true,
            message: 'Media uploaded successfully',
            filename: filename
        });
    } catch (error) {
        console.error('Upload branding asset error:', error);
        res.status(500).json({ error: 'Failed to upload media assets' });
    }
};

module.exports = {
    getAllSettings,
    getSettingsByCategory,
    updateSetting,
    updateBulkSettings,
    getSystemHealth,
    createBackup,
    listBackups,
    optimizeDatabase,
    cleanOldLogs,
    uploadBrandingAsset
};
