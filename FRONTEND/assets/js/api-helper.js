/**
 * API Helper for Al Marakish Library System
 * Centralized API communication helper
 */

const API_CONFIG = {
  BASE_URL: window.location.origin.includes('local') || window.location.origin.includes('127.0.0.1')
    ? '/api'
    : `${window.location.origin}/api`,
  TIMEOUT: 30000, // 30 seconds
};

/**
 * Get stored JWT token
 */
function getToken() {
  return localStorage.getItem('token');
}

/**
 * Get stored user data
 */
function getUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
  return !!getToken();
}

/**
 * Logout user
 */
function logout() {
  const user = getUser();
  const isStudent = user && user.role === 'student';
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = isStudent ? '/student/login.html' : '/admin/login.html';
}

/**
 * Make authenticated API request
 * @param {string} endpoint - API endpoint (without base URL)
 * @param {object} options - Fetch options
 * @returns {Promise} - Response data
 */
async function apiRequest(endpoint, options = {}) {
  const token = getToken();

  // Enhanced FormData detection
  const isFormData = options.body instanceof FormData ||
    (options.body && typeof options.body.append === 'function');

  const config = {
    ...options,
    headers: {
      ...options.headers,
    },
  };

  // NEVER set Content-Type: application/json if sending FormData
  // Browser must set it automatically with the boundary for multipart requests
  if (isFormData) {
    if (config.headers['Content-Type']) {
      delete config.headers['Content-Type'];
    }
  }

  // Add authentication token
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  // Handle JSON body
  if (options.body && !isFormData) {
    if (typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
      if (!config.headers['Content-Type']) {
        config.headers['Content-Type'] = 'application/json';
      }
    } else if (typeof options.body === 'string') {
      // If it's a string, check if it's JSON and set header if missing
      if (!config.headers['Content-Type'] && (options.body.trim().startsWith('{') || options.body.trim().startsWith('['))) {
        config.headers['Content-Type'] = 'application/json';
      }
    }
  }

  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, config);

    let data;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { error: 'Non-JSON response received', details: text.substring(0, 200) };
    }

    // Handle unauthorized
    if (response.status === 401 && !options.noRedirect) {
      logout();
      throw new Error('Session expired. Please login again.');
    }

    // Handle errors
    if (!response.ok) {
      const mainError = data.error || data.message || `HTTP error! status: ${response.status}`;
      const details = data.details ? `\n\nDetails: ${data.details}` : '';
      throw new Error(`🚨 ${mainError}${details}`);
    }

    return data;
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
}

/**
 * Upload file with authentication
 * @param {string} endpoint - API endpoint
 * @param {FormData} formData - Form data with files
 * @param {object} options - Optional fetch options
 */
async function uploadFile(endpoint, formData, options = {}) {
  const token = getToken();

  const config = {
    method: options.method || 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...options.headers
    },
    body: formData, // FormData automatically sets Content-Type to multipart/form-data
    ...options
  };

  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, config);

    // Safety check for response content type
    let data;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { error: 'Server returned non-JSON response', details: text.substring(0, 200) };
    }

    if (response.status === 401 && !options.noRedirect) {
      logout();
      throw new Error('Session expired. Please login again.');
    }

    if (!response.ok) {
      const mainError = data.error || data.message || `Upload failed with status: ${response.status}`;
      const details = data.details ? `\n\nDetails: ${data.details}` : '';
      throw new Error(`🚨 ${mainError}${details}`);
    }

    return data;
  } catch (error) {
    console.error('Upload Error:', error);
    throw error;
  }
}

/**
 * Show loading state
 */
function showLoading(element, text = 'Loading...') {
  if (element) {
    element.disabled = true;
    element.dataset.originalText = element.textContent;
    element.textContent = text;
  }
}

/**
 * Hide loading state
 */
function hideLoading(element) {
  if (element && element.dataset.originalText) {
    element.disabled = false;
    element.textContent = element.dataset.originalText;
  }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  // Style
  Object.assign(toast.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '16px 24px',
    borderRadius: '12px',
    color: 'white',
    fontWeight: '600',
    fontSize: '15px',
    zIndex: '99999',
    animation: 'slideIn 0.3s ease',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    maxWidth: '400px',
  });

  // Color based on type
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
  };
  toast.style.background = colors[type] || colors.info;

  document.body.appendChild(toast);

  // Auto remove after 5 seconds
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

/**
 * Format date
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format currency
 */
function formatCurrency(amount) {
  return `₹${parseFloat(amount).toFixed(2)}`;
}

/**
 * Protect route (require authentication)
 */
function protectRoute(requiredRole = null) {
  if (!isAuthenticated()) {
    const isStudentPath = window.location.pathname.includes('/student/');
    window.location.href = isStudentPath ? '/student/login.html' : '/admin/login.html';
    return false;
  }

  const user = getUser();
  if (!user) {
    logout();
    return false;
  }

  // If on admin path, but user is student, and no role specified - assume assistant is required
  const isAdminPath = window.location.pathname.includes('/admin/');
  if (isAdminPath && user.role === 'student' && !requiredRole) {
    requiredRole = 'assistant';
  }

  const roleHierarchy = {
    'owner': 100,
    'admin': 50,
    'assistant': 10,
    'student': 1
  };

  const userLevel = roleHierarchy[user.role] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;

  if (requiredRole && userLevel < requiredLevel) {
    // Hide content immediately
    document.body.innerHTML = `
        <div style="height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #080c14; color: white; font-family: 'Inter', sans-serif;">
            <i class="fas fa-user-shield" style="font-size: 64px; color: #ef4444; margin-bottom: 24px;"></i>
            <h1 style="margin-bottom: 16px;">Access Denied</h1>
            <p style="color: #94a3b8;">You do not have permission to access this area.</p>
            <p style="margin-top: 24px; font-size: 14px; color: #64748b;">Redirecting to your dashboard...</p>
        </div>
    `;

    showToast('Access denied. Insufficient permissions.', 'error');

    setTimeout(() => {
      window.location.href = user && user.role === 'student' ? '/student/dashboard.html' : '/admin/dashboard.html';
    }, 2000);
    return false;
  }

  return true;
}

/**
 * Custom Styled Modal (Prompt/Confirm/Alert Replacement)
 */
function showModal({ title, message, placeholder = 'Type here...', type = 'prompt', confirmText = 'Confirm', cancelText = 'Cancel' }) {
  return new Promise((resolve) => {
    // Remove existing
    const existing = document.getElementById('custom-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'custom-modal-overlay';

    // Icon selection
    let icon = 'fa-question-circle';
    let iconColor = '#cf9d7c'; // Gold/Accent
    let isDanger = false;

    if (type === 'alert') {
      icon = 'fa-info-circle';
    }

    if (confirmText.toLowerCase().includes('delete') || confirmText.toLowerCase().includes('remove') || message.toLowerCase().includes('error')) {
      icon = 'fa-exclamation-triangle';
      iconColor = '#ef4444';
      isDanger = true;
    }

    overlay.innerHTML = `
        <div class="modal-blur-bg"></div>
        <div class="modal-card">
            <div class="modal-icon-wrapper" style="background: ${iconColor}20; color: ${iconColor};">
                <i class="fas ${icon} fa-bounce"></i>
            </div>
            <h3 class="modal-title">${title}</h3>
            <div class="modal-text">${message}</div>
            
            ${type === 'prompt' ? `
                <div class="modal-input-wrapper">
                    <input type="text" id="modal-input" placeholder="${placeholder}" autocomplete="off">
                    <div class="input-glow"></div>
                </div>
            ` : ''}
            
            <div class="modal-actions">
                ${type !== 'alert' ? `
                    <button id="modal-cancel" class="modal-btn btn-secondary">${cancelText}</button>
                ` : ''}
                <button id="modal-confirm" class="modal-btn btn-primary" style="background: ${isDanger ? 'linear-gradient(135deg, #ef4444, #991b1b)' : 'linear-gradient(135deg, #cf9d7c, #af7d5c)'}">
                    ${confirmText}
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Fade in styles (handled by CSS below)
    const input = overlay.querySelector('#modal-input');
    if (input) setTimeout(() => input.focus(), 100);

    const close = (val) => {
      const card = overlay.querySelector('.modal-card');
      card.style.animation = 'modalPopOut 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.4s ease';
      setTimeout(() => {
        overlay.remove();
        resolve(val);
      }, 400);
    };

    overlay.querySelector('#modal-confirm').addEventListener('click', () => {
      close(type === 'prompt' ? input.value : true);
    });

    const cancelBtn = overlay.querySelector('#modal-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => close(null));
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });

    // ESC key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        window.removeEventListener('keydown', escHandler);
        close(null);
      }
    };
    window.addEventListener('keydown', escHandler);
  });
}

// Global Styles Injection
(function injectGlobalStyles() {
  if (document.getElementById('api-helper-styles')) return;
  const style = document.createElement('style');
  style.id = 'api-helper-styles';
  style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');

        /* Toast Animations */
        @keyframes toastSlideIn {
            from { transform: translateX(120%) scale(0.9); opacity: 0; }
            to { transform: translateX(0) scale(1); opacity: 1; }
        }
        @keyframes toastSlideOut {
            from { transform: translateX(0) scale(1); opacity: 1; }
            to { transform: translateX(120%) scale(0.9); opacity: 0; }
        }

        .custom-toast .toast-content {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 12px;
        }
        .custom-toast .toast-icon { font-size: 20px; }
        .custom-toast .toast-message { font-size: 14px; font-weight: 500; line-height: 1.4; color: #e2e8f0; }
        .custom-toast .toast-progress {
            position: absolute;
            bottom: 0;
            left: 0;
            height: 3px;
            width: 100%;
        }

        /* Modal Styles */
        #custom-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 100000;
            display: flex;
            align-items: center;
            justify-content: center;
            perspective: 1000px;
        }

        .modal-blur-bg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(5, 10, 8, 0.6);
            backdrop-filter: blur(15px);
            -webkit-backdrop-filter: blur(15px);
            animation: fadeIn 0.5s ease;
        }

        .modal-card {
            position: relative;
            background: rgba(18, 46, 36, 0.85);
            border: 1px solid rgba(207, 157, 124, 0.2);
            border-radius: 32px;
            padding: 40px;
            width: 90%;
            max-width: 440px;
            text-align: center;
            box-shadow: 0 30px 60px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.05);
            animation: modalPopIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            font-family: 'Outfit', sans-serif;
            color: white;
        }

        @keyframes modalPopIn {
            from { transform: scale(0.8) translateY(40px); opacity: 0; }
            to { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes modalPopOut {
            from { transform: scale(1) translateY(0); opacity: 1; }
            to { transform: scale(0.8) translateY(40px); opacity: 0; }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .modal-icon-wrapper {
            width: 80px;
            height: 80px;
            border-radius: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 25px;
            font-size: 32px;
        }

        .modal-title { font-size: 26px; font-weight: 800; margin-bottom: 12px; letter-spacing: -0.5px; color: #fff; }
        .modal-text { color: #cbd5d1; font-size: 16px; line-height: 1.6; margin-bottom: 30px; }

        .modal-input-wrapper { position: relative; margin-bottom: 30px; }
        #modal-input {
            width: 100%;
            padding: 16px 24px;
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 18px;
            color: white;
            font-size: 16px;
            outline: none;
            transition: 0.3s;
            position: relative;
            z-index: 1;
        }
        #modal-input:focus { border-color: #cf9d7c; background: rgba(0,0,0,0.4); }

        .modal-actions { display: flex; gap: 15px; }
        .modal-btn {
            flex: 1;
            padding: 16px;
            border-radius: 20px;
            font-weight: 700;
            font-size: 15px;
            cursor: pointer;
            transition: 0.3s;
            border: none;
            font-family: inherit;
        }
        .btn-secondary { background: rgba(255,255,255,0.05); color: #94a3a3; border: 1px solid rgba(255,255,255,0.1); }
        .btn-secondary:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .btn-primary:hover { transform: translateY(-3px); filter: brightness(1.1); box-shadow: 0 10px 20px rgba(0,0,0,0.3); }
        .btn-primary:active { transform: translateY(0); }

        /* Navbar Badge Style */
        /* Navbar Badge Style */
        .nav-btn { position: relative !important; }
        .nav-badge {
            position: absolute !important;
            top: 0px !important;
            right: 2px !important;
            background: linear-gradient(135deg, #ff4e50, #f9d423); /* Vibrant orange-red gradient */
            background: linear-gradient(135deg, #ef4444, #991b1b);
            color: white !important;
            font-size: 10px !important;
            font-weight: 900 !important;
            padding: 2px 6px !important;
            border-radius: 12px !important;
            min-width: 20px !important;
            height: 20px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            border: 2.5px solid #0d1414 !important;
            box-shadow: 0 4px 15px rgba(239, 68, 68, 0.6) !important;
            z-index: 9999 !important;
            animation: pulse-badge-v2 1.5s infinite !important;
            pointer-events: none;
            line-height: 1 !important;
        }
        @keyframes pulse-badge-v2 {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.8); }
            50% { transform: scale(1.15); box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
    `;
  document.head.appendChild(style);
})();

// Auto-load notification badge for students
(function () {
  function initBadge() {
    const user = getUser();
    if (!user) return;

    if (user.role === 'student' || user.type === 'student') {
      console.log('🔔 Notification Badge System Active');
      updateNotificationBadge();
      // Refresh every 2 minutes
      setInterval(updateNotificationBadge, 120000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBadge);
  } else {
    initBadge();
  }
})();

async function updateNotificationBadge() {
  try {
    // 1. Find the notification link
    const navBtn = document.querySelector('a[href*="notification"]') ||
      document.querySelector('.nav-btn i.fa-bell')?.closest('a') ||
      Array.from(document.querySelectorAll('a')).find(el => el.textContent.toLowerCase().includes('notification'));

    if (!navBtn) return;

    // 2. Fetch unread count
    const res = await apiRequest('/notifications/unread-count', { noRedirect: true });

    // 3. Update UI
    if (res && res.success && res.count > 0) {
      let badge = navBtn.querySelector('.nav-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'nav-badge';
        navBtn.appendChild(badge);
      }
      badge.textContent = res.count > 99 ? '99+' : res.count;

      // Ensure container is ready for absolute badge
      navBtn.style.position = 'relative';
      navBtn.style.overflow = 'visible';
    } else {
      const badge = navBtn.querySelector('.nav-badge');
      if (badge) badge.remove();
    }
  } catch (err) {
    // Fail silently
  }
}
