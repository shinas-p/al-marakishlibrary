const { query, queryOne } = require('../config/database');
const { logAdminActivity } = require('../helpers/adminHelper');

/**
 * Get all settings
 */
const getSettings = async (req, res) => {
  try {
    const { group } = req.query;

    let sql = 'SELECT * FROM system_settings WHERE 1=1';
    const params = [];

    if (group) {
      sql += ' AND setting_group = ?';
      params.push(group);
    }

    sql += ' ORDER BY setting_group, setting_key';

    const settings = await query(sql, params);

    // Group by setting_group
    const grouped = {};
    settings.forEach(setting => {
      if (!grouped[setting.setting_group]) {
        grouped[setting.setting_group] = [];
      }
      grouped[setting.setting_group].push(setting);
    });

    res.json({ success: true, settings: grouped, flat: settings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

/**
 * Get single setting
 */
const getSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const setting = await queryOne('SELECT * FROM system_settings WHERE setting_key = ?', [key]);

    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    // Parse value based on type
    let value = setting.setting_value;
    if (setting.setting_type === 'integer') {
      value = parseInt(value);
    } else if (setting.setting_type === 'boolean') {
      value = value === '1' || value === 'true';
    } else if (setting.setting_type === 'json') {
      value = JSON.parse(value);
    }

    res.json({ success: true, setting: { ...setting, parsed_value: value } });
  } catch (error) {
    console.error('Get setting error:', error);
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
};

/**
 * Update setting
 */
const updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;
    const adminId = req.user.id;

    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }

    // Get existing setting
    const existing = await queryOne('SELECT * FROM system_settings WHERE setting_key = ?', [key]);

    if (!existing) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    // Check permissions
    const canEdit = existing.can_edit_role === 'all' ||
      (existing.can_edit_role === 'admin' && (req.user.role === 'admin' || req.user.role === 'owner')) ||
      (existing.can_edit_role === 'owner' && req.user.role === 'owner');

    if (!canEdit) {
      return res.status(403).json({ error: 'Insufficient permissions to edit this setting' });
    }

    // Convert value to string based on type
    let stringValue = value;
    if (existing.setting_type === 'boolean') {
      stringValue = value ? '1' : '0';
    } else if (existing.setting_type === 'integer') {
      stringValue = String(parseInt(value));
    } else if (existing.setting_type === 'json') {
      stringValue = JSON.stringify(value);
    }

    // Update setting
    await query(
      `UPDATE system_settings 
       SET setting_value = ?, updated_by = ?, updated_at = NOW() 
       WHERE setting_key = ?`,
      [stringValue, adminId, key]
    );

    // Log history
    await query(
      `INSERT INTO system_settings_history (setting_key, old_value, new_value, changed_by) 
       VALUES (?, ?, ?, ?)`,
      [key, existing.setting_value, stringValue, adminId]
    );

    await logAdminActivity(adminId, 'update_setting', `Updated setting: ${key}`);

    res.json({ success: true, message: 'Setting updated successfully' });
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
};

/**
 * Update bulk settings
 */
const updateBulkSettings = async (req, res) => {
  try {
    const { settings } = req.body;
    const adminId = req.user.id;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object is required' });
    }

    const updates = [];
    for (const [key, value] of Object.entries(settings)) {
      const existing = await queryOne('SELECT * FROM system_settings WHERE setting_key = ?', [key]);
      if (existing) {
        let stringValue = value;
        if (existing.setting_type === 'boolean') {
          stringValue = value ? '1' : '0';
        } else if (existing.setting_type === 'integer') {
          stringValue = String(parseInt(value));
        } else if (existing.setting_type === 'json') {
          stringValue = JSON.stringify(value);
        }

        await query(
          `UPDATE system_settings 
           SET setting_value = ?, updated_by = ?, updated_at = NOW() 
           WHERE setting_key = ?`,
          [stringValue, adminId, key]
        );

        await query(
          `INSERT INTO system_settings_history (setting_key, old_value, new_value, changed_by) 
           VALUES (?, ?, ?, ?)`,
          [key, existing.setting_value, stringValue, adminId]
        );

        updates.push(key);
      }
    }

    await logAdminActivity(adminId, 'update_bulk_settings', `Updated ${updates.length} settings`);

    res.json({ success: true, message: `Updated ${updates.length} settings`, updated: updates });
  } catch (error) {
    console.error('Update bulk settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

/**
 * Get public-safe settings (No admin check)
 */
const getPublicSettings = async (req, res) => {
  try {
    const publicKeys = [
      'library_name', 'library_short_name', 'library_logo', 'library_address', 'library_website',
      'payment_enable_online', 'payment_enable_qr', 'payment_upi_id', 'payment_qr_code',
      'currency_symbol', 'currency_code', 'primary_color', 'secondary_color', 'fine_per_day_student'
    ];

    const settings = await query(
      'SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (?)',
      [publicKeys]
    );

    const flat = {};
    settings.forEach(s => flat[s.setting_key] = s.setting_value);

    res.json({ success: true, settings: flat });
  } catch (error) {
    console.error('Get public settings error:', error);
    res.status(500).json({ error: 'Failed to fetch public settings' });
  }
};

module.exports = {
  getSettings,
  getSetting,
  updateSetting,
  updateBulkSettings,
  getPublicSettings
};
