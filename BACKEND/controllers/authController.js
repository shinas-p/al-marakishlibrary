const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query, queryOne } = require('../config/database');
const { logAdminActivity } = require('../helpers/adminHelper');

/**
 * Admin Login
 */
const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find admin
    const admin = await queryOne(
      'SELECT id, username, password, full_name, role, status FROM admin WHERE username = ?',
      [username]
    );

    if (!admin) {
      await logAdminActivity(0, 'login_failed', `Failed login attempt for unknown user: ${username}`);
      return res.status(401).json({ error: 'Incorrect username or password' });
    }

    if (admin.status !== 'active') {
      return res.status(403).json({ error: 'Account is suspended or deleted' });
    }

    // Verify password (supports both bcrypt hashed and plain text)
    let isValidPassword = false;

    // Check if password is bcrypt hashed (starts with $2a$, $2b$, or $2y$)
    if (admin.password.startsWith('$2a$') || admin.password.startsWith('$2b$') || admin.password.startsWith('$2y$')) {
      // Use bcrypt to compare hashed password
      isValidPassword = await bcrypt.compare(password, admin.password);
    } else {
      // Plain text comparison (for legacy support)
      isValidPassword = (password === admin.password);
    }

    if (!isValidPassword) {
      await logAdminActivity(admin.id, 'login_failed', `Failed login attempt for @${username} (Incorrect password)`);
      return res.status(401).json({ error: 'Incorrect username or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: admin.id,
        username: admin.username,
        role: admin.role,
        type: 'admin'
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Log successful login
    await logAdminActivity(admin.id, 'login', `Successful login for @${admin.username} [${admin.role}]`);

    res.json({
      success: true,
      token,
      user: {
        id: admin.id,
        username: admin.username,
        full_name: admin.full_name,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
};

/**
 * Student Login
 */
const studentLogin = async (req, res) => {
  try {
    const { ad_no, password } = req.body;

    if (!ad_no || !password) {
      return res.status(400).json({ error: 'Admission number and password are required' });
    }

    // Find student
    const student = await queryOne(
      'SELECT id, ad_no, full_name, password, status FROM users WHERE ad_no = ?',
      [ad_no.trim()]
    );

    if (!student) {
      return res.status(401).json({ error: 'Invalid Admission Number or Password' });
    }

    if (student.status !== 'active') {
      return res.status(403).json({ error: 'Account is suspended or deleted' });
    }

    // Verify password (supports both bcrypt hashed and plain text)
    let isValidPassword = false;

    // Check if password is bcrypt hashed (starts with $2a$, $2b$, or $2y$)
    if (student.password.startsWith('$2a$') || student.password.startsWith('$2b$') || student.password.startsWith('$2y$')) {
      // Use bcrypt to compare hashed password
      isValidPassword = await bcrypt.compare(password, student.password);
    } else {
      // Plain text comparison (for legacy support)
      isValidPassword = (password === student.password);
    }

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid Admission Number or Password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: student.id,
        ad_no: student.ad_no,
        role: 'student',
        type: 'student'
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: student.id,
        ad_no: student.ad_no,
        full_name: student.full_name,
        role: 'student'
      }
    });
  } catch (error) {
    console.error('Student login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
};

/**
 * Verify token and return user info
 */
const verifyToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] ||
      req.cookies?.token ||
      req.headers['x-auth-token'];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type === 'admin') {
      const admin = await queryOne(
        'SELECT id, username, full_name, role, status FROM admin WHERE id = ?',
        [decoded.id]
      );
      if (!admin || admin.status !== 'active') {
        return res.status(401).json({ error: 'Invalid token' });
      }
      return res.json({ user: admin, role: 'admin' });
    } else if (decoded.type === 'student') {
      const student = await queryOne(
        'SELECT id, ad_no, full_name, status FROM users WHERE id = ?',
        [decoded.id]
      );
      if (!student || student.status !== 'active') {
        return res.status(401).json({ error: 'Invalid token' });
      }
      return res.json({ user: student, role: 'student' });
    }

    res.status(401).json({ error: 'Invalid token' });
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Logout (client-side token removal, but we can log it)
 */
const logout = async (req, res) => {
  try {
    // In JWT, logout is handled client-side by removing the token
    // But we can log the action if needed
    if (req.user && req.user.type === 'admin') {
      await logAdminActivity(req.user.id, 'logout', `Admin @${req.user.username} logged out`);
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
};

module.exports = {
  adminLogin,
  studentLogin,
  verifyToken,
  logout
};
