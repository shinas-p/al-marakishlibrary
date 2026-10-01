// Sidebar Component JavaScript
// Handles sidebar toggle, active state, submenus, and user info

/**
 * Toggle sidebar submenu dropdown
 * @param {Event} event - The click event object
 * @param {string} id - The submenu identifier (e.g., 'payments', 'tools')
 */
function toggleSubmenu(event, id) {
    if (event) event.preventDefault();

    const submenu = document.getElementById('submenu-' + id);
    const arrow = document.getElementById('arrow-' + id);

    if (!submenu || !arrow) return;

    // Close other submenus
    document.querySelectorAll('.sb-submenu').forEach(menu => {
        if (menu.id !== 'submenu-' + id) menu.classList.remove('open');
    });
    document.querySelectorAll('.sb-arrow').forEach(arr => {
        if (arr.id !== 'arrow-' + id) arr.classList.remove('rotated');
    });

    // Toggle current
    submenu.classList.toggle('open');
    arrow.classList.toggle('rotated');
}

/**
 * Initialize all sidebar features
 * This can be called manually if the sidebar is loaded via AJAX
 */
function initSidebar() {
    console.log('Initializing sidebar...');
    const sidebar = document.getElementById('app-sidebar');
    if (!sidebar) return;

    const logoutLink = document.getElementById('logoutLink');
    const profileName = document.getElementById('profileName');
    const profileRole = document.getElementById('profileRole');
    const profileImage = document.getElementById('profileImage');
    const mobileToggle = document.getElementById('mobileMenuToggle');
    const mobileClose = document.getElementById('mobileCloseSidebar');

    // Set active state based on URL
    const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
    document.querySelectorAll('.sb-item[data-page]').forEach(item => {
        if (item.getAttribute('data-page') === currentPage || (currentPage === '' && item.getAttribute('data-page') === 'dashboard')) {
            item.classList.add('sb-active');
        }
    });

    // Populate profile info and apply role-based visibility
    const userStr = localStorage.getItem('user');
    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            const userRole = user.role || 'admin';

            if (profileName) profileName.textContent = user.full_name || 'Admin';
            if (profileRole) {
                const roleDisplay = userRole.charAt(0).toUpperCase() + userRole.slice(1);
                profileRole.textContent = roleDisplay;

                // Add role-specific styling
                if (userRole === 'owner') {
                    profileRole.style.color = '#f59e0b';
                } else if (userRole === 'admin') {
                    profileRole.style.color = '#9c4dff';
                } else {
                    profileRole.style.color = '#10b981';
                }
            }

            if (profileImage) {
                if (user.profile_photo) {
                    profileImage.src = `/uploads/users/${user.profile_photo}`;
                } else if (user.full_name) {
                    const names = user.full_name.trim().split(' ');
                    const initials = names.length >= 2 ? names[0][0] + names[1][0] : names[0].substring(0, 2);
                    const svg = `<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="40" fill="#9c4dff"/><text x="50%" y="50%" text-anchor="middle" dy=".35em" fill="white" font-size="16" font-family="sans-serif" font-weight="600">${initials.toUpperCase()}</text></svg>`;
                    profileImage.src = 'data:image/svg+xml;base64,' + btoa(svg);
                }
            }

            // ================================================
            // ROLE-BASED VISIBILITY SYSTEM
            // ================================================
            // Hide/show sidebar elements based on user role

            const roleHierarchy = {
                'owner': ['owner', 'admin', 'assistant'],
                'admin': ['admin', 'assistant'],
                'assistant': ['assistant']
            };

            const allowedRoles = roleHierarchy[userRole] || ['assistant'];

            // Process all elements with data-role attribute
            document.querySelectorAll('[data-role]').forEach(element => {
                const requiredRole = element.getAttribute('data-role');

                if (allowedRoles.includes(requiredRole)) {
                    element.style.display = ''; // Show
                } else {
                    element.style.display = 'none'; // Hide
                }
            });

            // Automatic sync for admin profile (to keep photo consistent)
            if (user.type === 'admin' || user.role === 'owner' || user.role === 'admin' || user.role === 'assistant') {
                // We'll do a background sync to avoid delays
                syncAdminProfile(profileName, profileRole, profileImage);
            }

            console.log(`Sidebar configured for role: ${userRole}`);

        } catch (e) { console.error('Sidebar profile error:', e); }
    }

    // Logout
    if (logoutLink) {
        logoutLink.onclick = (e) => {
            e.preventDefault();
            if (confirm('Logout?')) {
                // Set a flag to prevent auto-redirect on login page
                localStorage.setItem('just_logged_out', 'true');

                // Small delay to ensure flag is set before clearing
                setTimeout(() => {
                    // Clear all authentication data
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    sessionStorage.clear();

                    // Redirect to login
                    window.location.href = '/admin/login.html';
                }, 100);
            }
        };
    }

    // Mobile Toggle
    if (mobileToggle) {
        mobileToggle.onclick = () => sidebar.classList.add('open');
    }

    if (mobileClose) {
        mobileClose.onclick = () => sidebar.classList.remove('open');
    }

    // Load Notifications for Admins/Owners
    const userStr2 = localStorage.getItem('user');
    if (userStr2) {
        const user = JSON.parse(userStr2);
        if (user.role === 'owner' || user.role === 'admin') {
            loadNotifications();
            // Refresh every 2 minutes
            setInterval(loadNotifications, 120000);
        }
    }
}

/**
 * Fetch notification counts and update sidebar badges
 */
async function loadNotifications() {
    try {
        const response = await apiRequest('/dashboard/notifications');
        if (response.success && response.notifications) {
            const n = response.notifications;

            // Requests Badge (Reservations + Payments Request + Registrations + Suggestions)
            // Note: payments here refers to payments inside the requests tab? Or generally?
            // "Payments" item is in Requests tab, so let's include it if desired. 
            // But usually "Requests" badge should probably just sum up its children.
            // Requests subitems: Reservations, Book Suggestions, Registrations, Payments

            const requestsTotal = n.reservations + n.suggestions + n.registrations + n.payments;

            updateBadge('badge-requests', requestsTotal);

            // Sub-badges
            updateBadge('badge-reservations', n.reservations);
            updateBadge('badge-suggestions', n.suggestions);
            updateBadge('badge-registrations', n.registrations);
            updateBadge('badge-requests-payments', n.payments);

            // Payments Badge (Main Payments Section)
            updateBadge('badge-payments', n.payments);
            updateBadge('badge-payments-verify', n.payments);

            console.log('Notifications updated:', n);
        }
    } catch (error) {
        console.warn('Failed to load notifications:', error);
    }
}

/**
 * Background sync admin profile to keep data like photo consistent
 */
async function syncAdminProfile(nameEl, roleEl, imgEl) {
    // Only sync once every 30 minutes unless photo is missing
    const lastSync = localStorage.getItem('last_profile_sync');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const now = Date.now();

    if (lastSync && (now - parseInt(lastSync)) < 1800000 && user.profile_photo) {
        return; // Already synced recently
    }

    try {
        const response = await apiRequest('/admin/profile', { noRedirect: true });
        if (response.success && response.admin) {
            const admin = response.admin;
            localStorage.setItem('last_profile_sync', now.toString());

            // Update localStorage
            const cached = JSON.parse(localStorage.getItem('user') || '{}');
            localStorage.setItem('user', JSON.stringify({ ...cached, ...admin }));

            // Update UI elements if they exist
            if (nameEl) nameEl.textContent = admin.full_name || '@' + admin.username;
            if (roleEl) roleEl.textContent = admin.role.charAt(0).toUpperCase() + admin.role.slice(1);
            if (imgEl && admin.profile_photo) {
                imgEl.src = `/uploads/users/${admin.profile_photo}`;
            }
        }
    } catch (e) {
        console.log('Profile sync skipped:', e.message);
    }
}

function updateBadge(id, count) {
    const badge = document.getElementById(id);
    if (!badge) return;

    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

// Function to load the sidebar into its container
function loadSidebar() {
    const container = document.getElementById('sidebar-container');
    if (container) {
        fetch(`/admin/sidebar.html?v=${new Date().getTime()}`)
            .then(res => res.text())
            .then(html => {
                container.innerHTML = html;
                initSidebar();
            })
            .catch(err => console.error('Sidebar load failed:', err));
    } else {
        initSidebar();
    }
}

// Auto-init on page load
document.addEventListener('DOMContentLoaded', () => {
    loadSidebar();
});
