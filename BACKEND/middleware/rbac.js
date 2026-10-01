/**
 * ================================================
 * RBAC MIDDLEWARE - Role-Based Access Control
 * ================================================
 * Complete permission system for Owner, Admin, Assistant roles
 */

const { query, queryOne } = require('../config/database');
const jwt = require('jsonwebtoken');

/**
 * Verify JWT Token and attach user to request
 */
const verifyToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'Access denied. No token provided.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this');

        // Get fresh user data from database based on type
        let user;
        if (decoded.type === 'student') {
            user = await queryOne(
                'SELECT id, ad_no as username, full_name, email, status FROM users WHERE id = ? AND status = ?',
                [decoded.id, 'active']
            );
            if (user) {
                user.role = 'student';
                user.type = 'student';
            }
        } else {
            user = await queryOne(
                'SELECT id, username, full_name, email, role, status, permissions FROM admin WHERE id = ? AND status = ?',
                [decoded.id, 'active']
            );
            if (user) {
                user.type = 'admin';
            }
        }

        if (!user) {
            return res.status(401).json({ error: 'Invalid token or user not found' });
        }

        // Check if account is locked
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            return res.status(403).json({
                error: 'Account temporarily locked',
                locked_until: user.locked_until
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        return res.status(401).json({ error: 'Invalid token' });
    }
};

/**
 * Require OWNER Role
 * Owner has unrestricted access to everything
 */
const requireOwner = (req, res, next) => {
    if (req.user.role !== 'owner') {
        return res.status(403).json({
            error: 'Access denied. Owner role required.',
            required_role: 'owner',
            your_role: req.user.role
        });
    }
    next();
};

/**
 * Require ADMIN Role (or higher)
 * Admin or Owner can access
 */
const requireAdmin = (req, res, next) => {
    const allowedRoles = ['owner', 'admin'];

    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
            error: 'Access denied. Admin role required.',
            required_role: 'admin',
            your_role: req.user.role
        });
    }
    next();
};

/**
 * Require ASSISTANT Role (or higher)
 * Assistant, Admin, or Owner can access
 */
const requireAssistant = (req, res, next) => {
    const allowedRoles = ['owner', 'admin', 'assistant'];

    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
            error: 'Access denied. Assistant role required.',
            your_role: req.user.role
        });
    }
    next();
};

/**
 * Require STUDENT Role
 */
const requireStudent = (req, res, next) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({
            error: 'Access denied. Student role required.',
            your_role: req.user.role
        });
    }
    next();
};

/**
 * Require Specific Permission
 * Check if user's role has the required permission
 */
const requirePermission = (permissionKey) => {
    return async (req, res, next) => {
        try {
            // Owner always has all permissions
            if (req.user.role === 'owner') {
                return next();
            }

            // Check if role has this permission
            const permission = await queryOne(`
        SELECT p.id, p.permission_key, p.permission_name
        FROM permissions p
        INNER JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role = ? AND p.permission_key = ?
      `, [req.user.role, permissionKey]);

            if (!permission) {
                return res.status(403).json({
                    error: 'Access denied. Insufficient permissions.',
                    required_permission: permissionKey,
                    your_role: req.user.role
                });
            }

            next();
        } catch (error) {
            console.error('Permission check error:', error);
            return res.status(500).json({ error: 'Permission check failed' });
        }
    };
};

/**
 * Get User Permissions
 * Returns all permissions for the current user's role
 */
const getUserPermissions = async (req, res, next) => {
    try {
        // Owner has all permissions
        if (req.user.role === 'owner') {
            const allPermissions = await query('SELECT permission_key FROM permissions');
            req.user.permissions = allPermissions.map(p => p.permission_key);
            return next();
        }

        // Get role-specific permissions
        const permissions = await query(`
      SELECT p.permission_key
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role = ?
    `, [req.user.role]);

        req.user.permissions = permissions.map(p => p.permission_key);
        next();
    } catch (error) {
        console.error('Get permissions error:', error);
        return res.status(500).json({ error: 'Failed to fetch permissions' });
    }
};

/**
 * Check if user has any of the specified permissions
 */
const requireAnyPermission = (permissionKeys) => {
    return async (req, res, next) => {
        try {
            // Owner always has all permissions
            if (req.user.role === 'owner') {
                return next();
            }

            // Check if role has ANY of these permissions
            const permission = await queryOne(`
        SELECT p.id
        FROM permissions p
        INNER JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role = ? AND p.permission_key IN (?)
        LIMIT 1
      `, [req.user.role, permissionKeys]);

            if (!permission) {
                return res.status(403).json({
                    error: 'Access denied. Insufficient permissions.',
                    required_permissions: permissionKeys,
                    your_role: req.user.role
                });
            }

            next();
        } catch (error) {
            console.error('Permission check error:', error);
            return res.status(500).json({ error: 'Permission check failed' });
        }
    };
};

/**
 * IP Whitelist Check (Owner Only Feature)
 */
const checkIPWhitelist = async (req, res, next) => {
    try {
        // Only check for non-owner roles if IP whitelist is enabled
        const ipWhitelistEnabled = await queryOne(
            'SELECT setting_value FROM system_settings WHERE setting_key = ?',
            ['enable_ip_whitelist']
        );

        if (!ipWhitelistEnabled || ipWhitelistEnabled.setting_value !== 'true') {
            return next();
        }

        // Owner is always allowed
        if (req.user.role === 'owner') {
            return next();
        }

        // Check user's IP whitelist
        const user = await queryOne(
            'SELECT ip_whitelist FROM admin WHERE id = ?',
            [req.user.id]
        );

        if (!user.ip_whitelist) {
            return next(); // No whitelist = allow all
        }

        const clientIP = req.ip || req.connection.remoteAddress;
        const allowedIPs = user.ip_whitelist.split(',').map(ip => ip.trim());

        if (!allowedIPs.includes(clientIP)) {
            return res.status(403).json({
                error: 'Access denied. IP address not whitelisted.',
                your_ip: clientIP
            });
        }

        next();
    } catch (error) {
        console.error('IP whitelist check error:', error);
        next(); // Allow on error
    }
};

/**
 * Log Activity
 * Middleware to log all actions automatically
 */
const logActivity = (actionType, actionCategory = 'general') => {
    return async (req, res, next) => {
        // Store original send to capture response
        const originalSend = res.send;

        res.send = function (data) {
            // Log after response is sent
            setImmediate(async () => {
                try {
                    if (!req.user) return; // Only log authenticated actions

                    const status = res.statusCode < 400 ? 'success' : 'failed';
                    const severity = res.statusCode >= 500 ? 'high' : res.statusCode >= 400 ? 'medium' : 'low';

                    await query(`
                        INSERT INTO activity_logs 
                        (user_id, user_name, user_role, user_type, action_type, action_category, 
                         action_description, ip_address, user_agent, status, severity)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        req.user.id,
                        req.user.full_name || req.user.username,
                        req.user.role,
                        req.user.type || 'admin',
                        actionType,
                        actionCategory,
                        `${req.method} ${req.originalUrl}`,
                        req.ip || req.connection.remoteAddress,
                        req.get('user-agent'),
                        status,
                        severity
                    ]);
                } catch (error) {
                    console.error('Activity logging middleware error:', error);
                }
            });

            // Call original send
            originalSend.call(this, data);
        };

        next();
    };
};

module.exports = {
    verifyToken,
    requireOwner,
    requireAdmin,
    requireAssistant,
    requireStudent,
    requirePermission,
    requireAnyPermission,
    getUserPermissions,
    checkIPWhitelist,
    logActivity
};
