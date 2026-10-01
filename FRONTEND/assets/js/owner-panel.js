/**
 * ================================================
 * OWNER CONTROL PANEL - CENTRAL HELPER
 * ================================================
 */

// Protect route - owner only
(async function () {
    const isProtected = await protectRoute('owner');
    if (!isProtected) return;

    // Load components based on presence in current page
    if (document.getElementById('settings-pane-container')) loadSystemSettings();
    if (document.getElementById('adminsTableBody') || document.getElementById('adminsGrid')) loadAdmins();
    if (document.getElementById('healthGrid')) loadSystemHealth();
    if (document.getElementById('backupsTableBody')) loadBackups();
    if (document.getElementById('logsTableBody') && typeof loadLogs === 'undefined') loadActivityLogsSimplified();
})();

// ================================================
// SYSTEM SETTINGS
// ================================================

// State
let allSettings = {};
let currentTab = 'circulation';

async function loadSystemSettings() {
    try {
        const response = await apiRequest('/admin/owner/settings');
        if (response.success && response.settings) {
            allSettings = response.settings;
            displayTabSettings(currentTab);
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
        showToast('Failed to load settings', 'error');
    }
}

async function loadSecuritySettings() {
    if (Object.keys(allSettings).length === 0) await loadSystemSettings();
}

function switchSettingsTab(category, btn) {
    currentTab = category;

    // Update UI active state
    document.querySelectorAll('.settings-nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    displayTabSettings(category);
}

function displayTabSettings(category) {
    const container = document.getElementById('settings-pane-container');
    if (!container) return;

    // Flatten all settings into a single array for easier filtering
    let allItems = [];
    Object.values(allSettings).forEach(group => {
        if (Array.isArray(group)) allItems.push(...group);
    });

    // Remove duplicates by key and normalize to always have 'key' property
    const uniqueItems = Array.from(new Map(allItems.map(item => {
        const k = item.key || item.setting_key;
        return [k, { ...item, key: k }];
    })).values());

    // Define strict partitioning rules
    const filters = {
        circulation: (s) => {
            const k = (s.key || s.setting_key).toLowerCase();
            return k.includes('borrow') || k.includes('duration') || (k.includes('max_') && !k.includes('fine'));
        },
        appearance: (s) => {
            const k = (s.key || s.setting_key).toLowerCase();
            return k.includes('logo') || k.includes('name') || k.includes('email') ||
                k.includes('phone') || k.includes('address') || k.includes('website') || k.includes('color');
        },
        payments: (s) => {
            const k = (s.key || s.setting_key).toLowerCase();
            return k.includes('payment') || k.includes('upi') || k.includes('qr') || k.includes('fine') || k.includes('currency');
        },
        security: (s) => {
            const k = (s.key || s.setting_key).toLowerCase();
            return k.includes('security') || k.includes('maintenance') || k.includes('registration') || k.includes('auth') || k.includes('lockout');
        },
        social: (s) => {
            const k = (s.key || s.setting_key).toLowerCase();
            return k.includes('facebook') || k.includes('instagram') || k.includes('twitter') || k.includes('linkedin') || k.includes('social');
        },
        system: (s) => {
            // System is the catch-all for anything not matched by others
            const k = (s.key || s.setting_key).toLowerCase();
            const matchedAny = filters.circulation(s) || filters.appearance(s) || filters.payments(s) || filters.security(s) || filters.social(s);
            return !matchedAny || k.startsWith('system_') || k.includes('app_');
        }
    };

    let items = uniqueItems.filter(filters[category] || (() => true));

    const categoryMeta = {
        circulation: { name: 'Circulation Protocols', icon: 'fa-exchange-alt' },
        appearance: { name: 'Branding & presence', icon: 'fa-palette' },
        social: { name: 'Social Connect', icon: 'fa-share-alt' },
        payments: { name: 'Financial Integrity', icon: 'fa-credit-card' },
        security: { name: 'Privacy & Access', icon: 'fa-shield-alt' },
        system: { name: 'Advanced Core Config', icon: 'fa-cog' }
    };

    const meta = categoryMeta[category] || { name: category, icon: 'fa-cog' };

    container.innerHTML = `
        <div class="pane-header" style="padding: 30px; border-bottom: 1px solid var(--border);">
            <h2 style="font-family: 'Outfit', sans-serif; font-size: 20px; font-weight: 700; color: white; display: flex; align-items: center; gap: 12px; margin: 0;">
                <i class="fas ${meta.icon}" style="color: var(--primary);"></i> ${meta.name}
            </h2>
            ${category === 'payments' ? `<p style="color: var(--text-secondary); font-size: 14px; margin-top: 10px; opacity: 0.8;">Setup how students pay fines. Upload your QR code for instant scan-to-pay.</p>` : ''}
        </div>
        <div class="setting-items-list" style="padding: 10px 30px;">
            ${items.length > 0 ? items.map(setting => createSettingHTML(setting)).join('') : '<p style="padding: 40px; text-align: center; color: var(--text-secondary);">No settings found in this category.</p>'}
        </div>
        ${items.some(s => !s.key.includes('logo') && !s.key.includes('qr')) ? `
        <div class="pane-footer" style="padding: 25px 30px; border-top: 1px solid var(--border); display: flex; justify-content: center;">
            <button class="btn-primary" onclick="saveAllTabSettings()" style="width: 280px; padding: 14px 30px; font-weight: 700; border-radius: 12px; background: var(--primary); color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: 0.3s; box-shadow: 0 8px 20px rgba(156, 77, 255, 0.2);">
                <i class="fas fa-save"></i> Save All Changes
            </button>
        </div>` : ''}
    `;
}

function createSettingHTML(setting) {
    const { key, value, dataType, description } = setting;
    const name = formatSettingName(key);

    let controlHTML = '';
    const isBooleanLike = dataType === 'boolean' || key.includes('enable') || key.includes('active') || value === '0' || value === '1';
    const isMedia = key.includes('logo') || key.includes('qr');

    if (isMedia) {
        // Professional Upload Option
        const previewUrl = value ? (value.startsWith('http') ? value : `/uploads/branding/${value}`) : '/assets/images/qr-placeholder.png';
        controlHTML = `
            <div class="media-upload-wrapper">
                <div class="media-actions">
                    <input type="file" id="file_${key}" style="display: none;" accept="image/*" onchange="handleMediaUpload('${key}', this)">
                    <button class="btn btn-primary" onclick="document.getElementById('file_${key}').click()" style="padding: 8px 16px; font-size: 13px; border-radius: 10px; background: rgba(156, 77, 255, 0.1); border: 1px solid var(--primary); color: var(--primary); font-weight: 700;">
                        <i class="fas fa-cloud-upload-alt"></i> ${key.includes('qr') ? 'Change QR' : 'Change Logo'}
                    </button>
                </div>
                <div class="media-preview" onclick="document.getElementById('file_${key}').click()" style="margin: 0; border-radius: 10px; width: 60px; height: 60px;">
                    <img src="${previewUrl}" id="preview_${key}" onerror="this.src='/assets/images/qr-placeholder.png'">
                    <div class="media-overlay"><i class="fas fa-camera"></i></div>
                </div>
            </div>
        `;
    } else if (isBooleanLike && (value === '0' || value === '1' || value === 'true' || value === 'false' || !isNaN(value))) {
        const isChecked = value === 'true' || value === '1';
        controlHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span class="status-indicator" style="font-size: 10px; font-weight: 800; color: ${isChecked ? 'var(--success-green)' : 'var(--text-muted)'}">${isChecked ? 'ON' : 'OFF'}</span>
                <label class="toggle-switch">
                    <input type="checkbox" class="tab-setting-input" data-key="${key}" data-type="boolean" ${isChecked ? 'checked' : ''} 
                           onchange="this.parentElement.previousElementSibling.textContent = this.checked ? 'ON' : 'OFF'; this.parentElement.previousElementSibling.style.color = this.checked ? 'var(--success-green)' : 'var(--text-muted)'">
                    <span class="toggle-slider"></span>
                </label>
            </div>
        `;
    } else {
        let inputType = 'text';
        if (dataType === 'number') inputType = 'number';
        else if (key.includes('email')) inputType = 'email';
        else if (key.includes('phone')) inputType = 'tel';
        else if (key.includes('url') || key.includes('link')) inputType = 'url';
        else if (key.includes('color')) inputType = 'color';

        controlHTML = `
            <div class="input-wrapper">
                <input type="${inputType}" 
                       data-key="${key}"
                       data-type="text"
                       class="setting-input tab-setting-input ${inputType === 'color' ? 'color-input' : ''}" 
                       value="${escapeHtml(value)}" 
                       ${dataType === 'number' ? 'step="any"' : ''}
                       placeholder="Enter ${name.toLowerCase()}...">
                ${inputType === 'number' ? `<div class="unit-label">${getUnitLabel(key)}</div>` : ''}
            </div>
        `;
    }

    const icon = getSettingIcon(key);

    return `
        <div class="setting-item">
            <div class="setting-main">
                <div class="setting-icon-box"><i class="fas ${icon}"></i></div>
                <div class="setting-info">
                    <label class="setting-label">${name}</label>
                    ${description ? `<div class="setting-description">${description}</div>` : ''}
                </div>
            </div>
            <div class="setting-control">
                ${controlHTML}
            </div>
        </div>
    `;
}

async function saveAllTabSettings() {
    const btn = event.target.closest('button');
    const inputs = document.querySelectorAll('.tab-setting-input');
    const settings = [];
    inputs.forEach(input => {
        const key = input.dataset.key;
        const type = input.dataset.type;
        const value = type === 'boolean' ? (input.checked ? '1' : '0') : input.value;
        settings.push({ key, value });
    });

    if (settings.length === 0) return;

    const originalHTML = btn.innerHTML;
    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving All...';

        const response = await apiRequest('/admin/owner/settings/bulk', {
            method: 'PUT',
            body: JSON.stringify({ settings })
        });

        if (response.success) {
            showToast('All settings saved successfully', 'success');
            btn.innerHTML = '<i class="fas fa-check"></i> Saved!';
            btn.style.background = 'var(--success)';
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.disabled = false;
                btn.style.background = '';
                loadSystemSettings(); // Refresh data
            }, 2000);
        } else {
            throw new Error(response.error || 'Failed to save');
        }
    } catch (error) {
        console.error('Bulk save error:', error);
        showToast(error.message, 'error');
        btn.innerHTML = '<i class="fas fa-times"></i> Failed';
        btn.style.background = 'var(--danger)';
        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
            btn.style.background = '';
        }, 2000);
    }
}

async function handleMediaUpload(key, input) {
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];
    const preview = document.getElementById(`preview_${key}`);

    const reader = new FileReader();
    reader.onload = e => { if (preview) preview.src = e.target.result; };
    reader.readAsDataURL(file);

    const formData = new FormData();
    formData.append('key', key);
    formData.append('image', file);

    try {
        const response = await uploadFile('/admin/owner/upload', formData, {
            method: 'POST'
        });

        if (response.success) {
            showToast('Media uploaded successfully', 'success');
            loadSystemSettings();
        } else {
            showToast(response.error || 'Upload failed', 'error');
        }
    } catch (error) {
        showToast('System error during upload', 'error');
    }
}

function getUnitLabel(key) {
    if (key.includes('duration') || key.includes('days') || key.includes('grace')) return 'Days';
    if (key.includes('fine') || key.includes('limit') || key.includes('allowed')) return 'Amt';
    if (key.includes('max') && !key.includes('fine') && !key.includes('attempts')) return 'Qty';
    if (key.includes('timeout') || key.includes('session')) return 'Mins';
    if (key.includes('attempts')) return 'Tries';
    return '';
}

function getSettingIcon(key) {
    if (!key) return 'fa-dot-circle';
    if (key.includes('duration')) return 'fa-clock';
    if (key.includes('fine')) return 'fa-receipt';
    if (key.includes('limit') || key.includes('allowed')) return 'fa-sliders-h';
    if (key.includes('name')) return 'fa-signature';
    if (key.includes('logo')) return 'fa-image';
    if (key.includes('email')) return 'fa-envelope';
    if (key.includes('phone')) return 'fa-phone';
    if (key.includes('address')) return 'fa-map-marker-alt';
    if (key.includes('website')) return 'fa-globe';
    if (key.includes('currency')) return 'fa-coins';
    if (key.includes('qr')) return 'fa-qrcode';
    if (key.includes('upi')) return 'fa-mobile-alt';
    if (key.includes('payment')) return 'fa-credit-card';
    if (key.includes('maintenance')) return 'fa-tools';
    if (key.includes('registration')) return 'fa-user-plus';
    if (key.includes('timezone')) return 'fa-globe-asia';
    if (key.includes('color')) return 'fa-eye-dropper';
    if (key.includes('facebook')) return 'fa-facebook';
    if (key.includes('instagram')) return 'fa-instagram';
    if (key.includes('twitter')) return 'fa-twitter';
    if (key.includes('kiosk')) return 'fa-desktop';
    if (key.includes('auto')) return 'fa-robot';
    if (key.includes('timeout') || key.includes('security')) return 'fa-user-lock';
    if (key.includes('attempts')) return 'fa-shield-alt';
    if (key.includes('bio') || key.includes('description')) return 'fa-align-left';
    if (key.includes('holiday')) return 'fa-calendar-day';
    if (key.includes('announcement')) return 'fa-bullhorn';
    return 'fa-dot-circle';
}

function formatSettingName(key) {
    if (!key) return 'Unknown Setting';
    return key.replace(/_/g, ' ')
        .replace(/library/gi, '')
        .replace(/payment/gi, '')
        .replace(/\b\w/g, l => l.toUpperCase())
        .trim();
}

async function updateSetting(key, value) {
    try {
        const response = await apiRequest('/admin/owner/settings', {
            method: 'PUT',
            body: JSON.stringify({ key, value: String(value) })
        });
        if (response.success) showToast('Setting updated successfully', 'success');
    } catch (error) {
        showToast('Update failed!', 'error');
    }
}

// ================================================
// ADMIN MANAGEMENT
// ================================================

async function loadAdmins() {
    try {
        const response = await apiRequest('/admin/owner/admins');
        if (!response.success || !response.admins) return;

        const tbody = document.getElementById('adminsTableBody');
        const grid = document.getElementById('adminsGrid');

        // SORT: Owner first, then others (ascending by ID or default DB order)
        response.admins.sort((a, b) => {
            if (a.role === 'owner') return -1;
            if (b.role === 'owner') return 1;
            return a.id - b.id; // Ascending order for others
        });

        // Populate Table if exists (legacy support)
        if (tbody) {
            tbody.innerHTML = response.admins.map(admin => {
                const statusClass = admin.status === 'active' ? 'status-active' : 'status-disabled';
                return `
                <tr>
                    <td style="font-weight: 700; color: white; letter-spacing: 0.5px;">${escapeHtml(admin.username)}</td>
                    <td style="color: var(--text-secondary);">${escapeHtml(admin.full_name || '-')}</td>
                    <td><span class="badge-role badge-${admin.role}">${admin.role}</span></td>
                    <td>
                        <div class="status-pill ${statusClass}">
                            <span class="status-dot"></span>
                            <span>${admin.status}</span>
                        </div>
                    </td>
                    <td><span style="font-size: 13px; color: var(--text-secondary); opacity: 0.8;">${admin.last_login ? formatDate(admin.last_login) : 'Never'}</span></td>
                    <td>
                        <div style="display:flex; justify-content: flex-end; gap:12px; align-items: center;">
                            <select onchange="changeAdminRole(${admin.id}, this.value)" class="role-select">
                                <option value="assistant" ${admin.role === 'assistant' ? 'selected' : ''}>Assistant</option>
                                <option value="admin" ${admin.role === 'admin' ? 'selected' : ''}>Admin</option>
                                <option value="owner" ${admin.role === 'owner' ? 'selected' : ''}>Owner</option>
                            </select>
                            <button onclick="deleteAdmin(${admin.id}, '${admin.username}')" class="btn-action-round" title="Remove Admin">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `}).join('');
        }

        // Populate Grid if exists (High Command Interface)
        if (grid) {
            // Get current user from storage to mark as "YOU"
            const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

            grid.innerHTML = response.admins.map(admin => {
                const statusActive = admin.status === 'active';
                const initials = admin.full_name ? admin.full_name.split(' ')
                    .filter(n => n).map(n => n[0]).join('').toUpperCase().substring(0, 2)
                    : admin.username.substring(0, 2).toUpperCase();

                const isSelf = admin.id === currentUser.id || admin.username === currentUser.username;

                return `
                    <div class="admin-card ${isSelf ? 'self-card' : ''}">
                        <div class="card-profile">
                            <div class="avatar-box" ${admin.profile_photo ? `style="background-image: url('/uploads/profiles/${admin.profile_photo}')"` : ''}>
                                ${admin.profile_photo ? '' : initials}
                            </div>
                            <div class="name-meta">
                                <h3>${escapeHtml(admin.full_name || 'Commander')}</h3>
                                <span class="handle">@${escapeHtml(admin.username)}</span>
                                <span class="role-tag tag-${admin.role}">${admin.role}</span>
                            </div>
                        </div>
                        <div class="card-details">
                            <div class="info-row"><i class="fas fa-envelope"></i> ${escapeHtml(admin.email || 'No email')}</div>
                            <div class="info-row"><i class="fas fa-briefcase"></i> ${escapeHtml(admin.assignment || 'Unassigned')}</div>
                            <div class="info-row"><i class="fas fa-calendar-alt"></i> Joined: ${admin.created_at ? formatDate(admin.created_at).split(',')[0] : 'Unknown'}</div>
                            <div class="info-row status-info">
                                <i class="fas fa-shield-alt"></i> Status: 
                                <span class="status-badge">
                                    <span class="dot ${statusActive ? 'dot-active' : 'dot-inactive'}"></span> 
                                    ${statusActive ? 'Active' : 'Suspended'}
                                </span>
                            </div>
                        </div>
                        <div class="card-actions">
                            ${isSelf ? `
                                <button class="btn-card btn-self-label">YOU (${admin.role.toUpperCase()})</button>
                            ` : `
                                <button class="btn-card btn-edit" onclick="window.location.href='admin_permissions.html?id=${admin.id}'">
                                    <i class="fas fa-pen-to-square"></i> Edit / Perms
                                </button>
                                <button class="btn-card btn-suspend" onclick="toggleAdminStatus(${admin.id}, '${admin.status}')">
                                    <i class="fas fa-ban"></i> ${statusActive ? 'Suspend' : 'Activate'}
                                </button>
                                <button class="btn-card btn-delete" onclick="deleteAdmin(${admin.id}, '${admin.username}')" title="Delete Commander">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            `}
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Load admins error:', error);
        showToast('Failed to load High Command', 'error');
    }
}

async function changeAdminRole(id, role) {
    if (!confirm(`Change role to ${role}?`)) { loadAdmins(); return; }
    try {
        const res = await apiRequest(`/admin/owner/admins/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) });
        if (res.success) { showToast('Role updated', 'success'); loadAdmins(); }
    } catch (err) { showToast('Failed to update role', 'error'); }
}

async function deleteAdmin(id, name) {
    if (!confirm(`Delete admin "${name}"?`)) return;
    try {
        const res = await apiRequest(`/admin/owner/admins/${id}`, { method: 'DELETE' });
        if (res.success) { showToast('Admin deleted', 'success'); loadAdmins(); }
    } catch (err) { showToast('Failed to delete', 'error'); }
}

async function toggleAdminStatus(id, currentStatus) {
    const nextStatus = currentStatus === 'active' ? 'disabled' : 'active';
    if (!confirm(`Are you sure you want to ${nextStatus === 'active' ? 'activate' : 'suspend'} this account?`)) return;

    try {
        const res = await apiRequest(`/admin/owner/admins/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: nextStatus })
        });

        if (res.success) {
            showToast(`Account ${nextStatus === 'active' ? 'activated' : 'suspended'}`, 'success');
            loadAdmins();
        }
    } catch (err) {
        showToast('Failed to toggle status', 'error');
    }
}

// ================================================
// SYSTEM HEALTH
// ================================================

async function loadSystemHealth() {
    const grid = document.getElementById('healthGrid');
    if (!grid) return;
    try {
        const res = await apiRequest('/admin/owner/health');
        if (res.success && res.health) {
            const h = res.health;
            document.getElementById('uptime').textContent = formatUptime(h.server.uptime);
            document.getElementById('memory').textContent = (h.server.memoryUsage.heapUsed / 1024 / 1024).toFixed(1) + ' MB';
            document.getElementById('dbSize').textContent = h.database.size ? h.database.size.toFixed(2) + ' MB' : '0 MB';
            document.getElementById('tableCount').textContent = h.database.tableCount || '0';
        }
    } catch (err) { console.error(err); }
}

function formatUptime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
}

// ================================================
// BACKUPS & MAINTENANCE
// ================================================

async function loadBackups() {
    const tbody = document.getElementById('backupsTableBody');
    if (!tbody) return;
    try {
        const res = await apiRequest('/admin/owner/backups');
        if (res.success && res.backups) {
            tbody.innerHTML = res.backups.map(b => `
                <tr>
                    <td><i class="fas fa-file-code" style="color:#9c4dff"></i> ${escapeHtml(b.backup_name)}</td>
                    <td><span class="badge ${b.backup_type}">${b.backup_type}</span></td>
                    <td>${formatBytes(b.file_size)}</td>
                    <td>${escapeHtml(b.created_by_name || 'System')}</td>
                    <td><small>${formatDate(b.created_at)}</small></td>
                </tr>
            `).join('');
        }
    } catch (err) { console.error(err); }
}

async function createBackup() {
    const btn = event.target.closest('button');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    try {
        const res = await apiRequest('/admin/owner/backup', { method: 'POST' });
        if (res.success) { showToast('Backup created!', 'success'); loadBackups(); }
    } catch (err) { showToast('Backup failed', 'error'); }
    finally { btn.disabled = false; btn.innerHTML = originalText; }
}

async function optimizeDatabase() {
    if (!confirm('Optimize database?')) return;
    try {
        const res = await apiRequest('/admin/owner/optimize', { method: 'POST' });
        if (res.success) showToast(`Optimized ${res.tables.length} tables`, 'success');
    } catch (err) { showToast('Failed', 'error'); }
}

async function cleanLogs() {
    if (!confirm('Clear old logs?')) return;
    try {
        const res = await apiRequest('/admin/owner/logs/clean', { method: 'DELETE' });
        if (res.success) showToast('Logs cleaned', 'success');
    } catch (err) { showToast('Failed', 'error'); }
}

// ================================================
// UTILITIES
// ================================================

function formatBytes(b) {
    if (!b) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function filterSettings(query) {
    const q = query.toLowerCase();
    document.querySelectorAll('.setting-item').forEach(item => {
        const text = item.innerText.toLowerCase();
        if (text.includes(q)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function formatDate(ds) {
    if (!ds) return '-';
    return new Date(ds).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(t) {
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
}
