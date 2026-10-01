// Admin Login Script
// Handles admin authentication via API

// Check if user just logged out - if so, clear the flag and don't auto-redirect
const justLoggedOut = localStorage.getItem('just_logged_out');
if (justLoggedOut) {
    localStorage.removeItem('just_logged_out');
    // Don't check authentication - user intentionally logged out
} else if (isAuthenticated()) {
    // Only auto-redirect if user has a valid token and didn't just logout
    // Verify token is still valid
    apiRequest('/auth/verify', { noRedirect: true })
        .then(data => {
            if (data.user && (data.user.role === 'admin' || data.user.role === 'owner' || data.user.role === 'assistant')) {
                window.location.href = 'dashboard.html';
            } else {
                // Invalid user data - clear storage
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        })
        .catch(() => {
            // Token is invalid - clear storage
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        });
}

// Handle form submission
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginButton = document.getElementById('loginButton');
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');

    // Hide error message
    errorMessage.classList.remove('show');

    // Disable button and show loading
    loginButton.disabled = true;
    loginButton.textContent = 'Signing in...';

    try {
        const data = await apiRequest('/auth/admin/login', {
            method: 'POST',
            body: { username, password }
        });

        if (data.success && data.token) {
            // Store token and user info
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            // Redirect to dashboard
            window.location.href = 'dashboard.html';
        } else {
            // Show error
            errorText.textContent = data.error || 'Login failed. Please try again.';
            errorMessage.classList.add('show');
            loginButton.disabled = false;
            loginButton.textContent = 'Sign In to Dashboard';
        }
    } catch (error) {
        console.error('Login error:', error);
        errorText.textContent = error.message || 'Network error. Please check your connection and try again.';
        errorMessage.classList.add('show');
        loginButton.disabled = false;
        loginButton.textContent = 'Sign In to Dashboard';
    }
});
