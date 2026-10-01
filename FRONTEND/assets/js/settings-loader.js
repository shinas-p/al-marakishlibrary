/**
 * Dynamic Settings Loader for UI
 * Fetches library settings from API and updates all UI elements
 */

// Cache for settings to avoid repeated API calls
let cachedSettings = null;
let lastSettingsFetch = 0;
const SETTINGS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch settings from API
 */
async function fetchSettings(forceRefresh = false) {
    const now = Date.now();

    // Return cached if still valid
    if (!forceRefresh && cachedSettings && (now - lastSettingsFetch) < SETTINGS_CACHE_TTL) {
        return cachedSettings;
    }

    try {
        // Try to fetch from API (will work for logged-in users)
        const response = await apiRequest('/settings', { noRedirect: true });

        if (response.success && response.flat) {
            const settings = {};
            response.flat.forEach(s => {
                settings[s.setting_key] = s.setting_value;
            });

            cachedSettings = settings;
            lastSettingsFetch = now;
            return settings;
        }
    } catch (error) {
        // Fallback to public settings
        try {
            const response = await fetch('/api/settings/public');
            const data = await response.json();
            if (data.success && data.settings) {
                cachedSettings = data.settings;
                lastSettingsFetch = now;
                return data.settings;
            }
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    }

    // Return cached or defaults
    return cachedSettings || getDefaultSettings();
}

/**
 * Get default settings (fallback)
 */
function getDefaultSettings() {
    return {
        library_name: 'AL MARAKISH LIBRARY',
        library_short_name: 'AML',
        library_logo: '/logo.png',
        primary_color: '#a047f8',
        secondary_color: '#ffffff'
    };
}

/**
 * Apply settings to current page
 */
async function applySettings() {
    const settings = await fetchSettings();

    // Update library name in all elements with class 'dynamic-library-name'
    const nameElements = document.querySelectorAll('.dynamic-library-name, .sb-title');
    nameElements.forEach(el => {
        if (settings.library_name) {
            el.textContent = settings.library_name;
        }
    });

    // Update library logo in all img elements with class 'dynamic-library-logo'
    const logoElements = document.querySelectorAll('.dynamic-library-logo');
    logoElements.forEach(el => {
        if (settings.library_logo) {
            el.src = settings.library_logo.startsWith('/')
                ? settings.library_logo
                : `/uploads/settings/${settings.library_logo}`;
        }
    });

    // Update primary color if applicable
    if (settings.primary_color) {
        document.documentElement.style.setProperty('--primary-color', settings.primary_color);
    }

    // Store in localStorage for offline use
    localStorage.setItem('library_settings', JSON.stringify(settings));

    return settings;
}

/**
 * Get a single setting value
 */
async function getSingleSetting(key, defaultValue = null) {
    const settings = await fetchSettings();
    return settings[key] !== undefined ? settings[key] : defaultValue;
}

/**
 * Initialize settings on page load
 */
document.addEventListener('DOMContentLoaded', () => {
    // Apply settings immediately
    applySettings();

    // Listen for settings update events
    window.addEventListener('settings-updated', () => {
        cachedSettings = null; // Clear cache
        applySettings(); // Reapply
    });
});

// Export functions for use in other scripts
if (typeof window !== 'undefined') {
    window.librarySettings = {
        fetch: fetchSettings,
        apply: applySettings,
        get: getSingleSetting,
        refresh: () => {
            cachedSettings = null;
            return applySettings();
        }
    };
}
