const { query, queryOne } = require('../config/database');

// In-memory cache for settings (refreshes every 5 minutes)
let settingsCache = null;
let lastFetch = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get all settings from database or cache
 */
async function getSettings(forceRefresh = false) {
    const now = Date.now();

    // Return cached settings if still valid
    if (!forceRefresh && settingsCache && (now - lastFetch) < CACHE_TTL) {
        return settingsCache;
    }

    try {
        const rows = await query('SELECT setting_key, setting_value, setting_type FROM system_settings');

        const settings = {};
        rows.forEach(row => {
            let value = row.setting_value;

            // Parse value based on type
            if (row.setting_type === 'integer') {
                value = parseInt(value) || 0;
            } else if (row.setting_type === 'boolean') {
                value = value === '1' || value === 'true' || value === true;
            } else if (row.setting_type === 'json') {
                try {
                    value = JSON.parse(value);
                } catch (e) {
                    value = null;
                }
            }

            settings[row.setting_key] = value;
        });

        // Cache the settings
        settingsCache = settings;
        lastFetch = now;

        return settings;
    } catch (error) {
        console.error('Failed to load settings:', error);
        return settingsCache || {}; // Return cached or empty object
    }
}

/**
 * Get a single setting value
 */
async function getSetting(key, defaultValue = null) {
    const settings = await getSettings();
    return settings[key] !== undefined ? settings[key] : defaultValue;
}

/**
 * Update a setting value
 */
async function updateSetting(key, value, adminId = null) {
    try {
        // Get setting type
        const setting = await queryOne('SELECT setting_type FROM system_settings WHERE setting_key = ?', [key]);

        if (!setting) {
            throw new Error(`Setting '${key}' not found`);
        }

        // Convert value to string based on type
        let stringValue = value;
        if (setting.setting_type === 'boolean') {
            stringValue = value ? '1' : '0';
        } else if (setting.setting_type === 'integer') {
            stringValue = String(parseInt(value));
        } else if (setting.setting_type === 'json') {
            stringValue = JSON.stringify(value);
        } else {
            stringValue = String(value);
        }

        // Update in database
        await query(
            'UPDATE system_settings SET setting_value = ?, updated_by = ?, updated_at = NOW() WHERE setting_key = ?',
            [stringValue, adminId, key]
        );

        // Clear cache to force refresh
        settingsCache = null;

        return true;
    } catch (error) {
        console.error('Failed to update setting:', error);
        throw error;
    }
}

/**
 * Get settings for a specific group
 */
async function getSettingsByGroup(group) {
    const allSettings = await getSettings();
    const rows = await query('SELECT setting_key FROM system_settings WHERE setting_group = ?', [group]);

    const filtered = {};
    rows.forEach(row => {
        if (allSettings[row.setting_key] !== undefined) {
            filtered[row.setting_key] = allSettings[row.setting_key];
        }
    });

    return filtered;
}

/**
 * Refresh cache (call this after bulk updates)
 */
function refreshCache() {
    settingsCache = null;
    lastFetch = 0;
}

module.exports = {
    getSettings,
    getSetting,
    updateSetting,
    getSettingsByGroup,
    refreshCache
};
