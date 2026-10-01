const jwt = require('jsonwebtoken');
const { queryOne } = require('../config/database');

/**
 * Verify JWT token and attach user to request
 */
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || 
                  req.cookies?.token || 
                  req.headers['x-auth-token'];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Require admin authentication
 */
const requireAdmin = async (req, res, next) => {
  try {
    await authenticate(req, res, async () => {
      if (req.user.role !== 'admin' && req.user.role !== 'owner' && req.user.role !== 'assistant') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Verify admin still exists and is active
      const admin = await queryOne(
        'SELECT id, username, role, status FROM admin WHERE id = ? AND status = ?',
        [req.user.id, 'active']
      );

      if (!admin) {
        return res.status(403).json({ error: 'Admin account not found or inactive' });
      }

      req.admin = admin;
      next();
    });
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * Require student authentication
 */
const requireStudent = async (req, res, next) => {
  try {
    await authenticate(req, res, async () => {
      if (req.user.role !== 'student') {
        return res.status(403).json({ error: 'Student access required' });
      }

      // Verify student still exists and is active
      const student = await queryOne(
        'SELECT id, ad_no, full_name, status FROM users WHERE id = ? AND status = ?',
        [req.user.id, 'active']
      );

      if (!student) {
        return res.status(403).json({ error: 'Student account not found or inactive' });
      }

      req.student = student;
      next();
    });
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * Require specific admin role (owner, admin, assistant)
 */
const requireRole = (roles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const roleHierarchy = {
      'owner': 3,
      'admin': 2,
      'assistant': 1
    };

    const userRoleWeight = roleHierarchy[req.user.role] || 0;
    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    const hasAccess = requiredRoles.some(role => {
      const requiredWeight = roleHierarchy[role] || 0;
      return userRoleWeight >= requiredWeight;
    });

    if (!hasAccess) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

module.exports = {
  authenticate,
  requireAdmin,
  requireStudent,
  requireRole
};
