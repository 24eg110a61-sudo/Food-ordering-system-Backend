import jwt from 'jsonwebtoken';
import { getDB } from '../config/db.js';

// Generate JWT token
export const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET || 'fallback_secret_key', {
    expiresIn: '7d',
  });
};

// Protect middleware: verifies JWT using TiDB MySQL user records
export const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Authentication required. Please login.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
    const db = getDB();
    const [rows] = await db.query('SELECT id, name, email, role, phone, address FROM users WHERE id = ?', [decoded.id]);

    if (!rows || rows.length === 0) {
      return res.status(401).json({ message: 'User not found. Please login again.' });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired session. Please login again.' });
  }
};

// Admin-only middleware
export const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'ADMIN') {
    next();
  } else {
    res.status(403).json({ message: 'Access restricted: Administrator rights required.' });
  }
};
