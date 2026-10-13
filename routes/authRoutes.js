import express from 'express';
import bcrypt from 'bcryptjs';
import { getDB } from '../config/db.js';
import { generateToken, protect } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new customer in TiDB
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const db = getDB();
    const normalizedEmail = email.trim().toLowerCase();

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const [result] = await db.query(
      'INSERT INTO users (name, email, password, phone, address, role) VALUES (?, ?, ?, ?, ?, ?)',
      [name.trim(), normalizedEmail, hashedPassword, phone?.trim() || '', address?.trim() || '', 'CUSTOMER']
    );

    const newUserId = result.insertId;
    const token = generateToken(newUserId, 'CUSTOMER');

    res.status(201).json({
      token,
      id: newUserId,
      name: name.trim(),
      email: normalizedEmail,
      role: 'CUSTOMER',
      phone: phone?.trim() || '',
      address: address?.trim() || '',
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error during registration' });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user against TiDB & return token
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide both email and password' });
    }

    const db = getDB();
    const normalizedEmail = email.trim().toLowerCase();

    const [users] = await db.query(
      'SELECT id, name, email, password, role, phone, address FROM users WHERE email = ?',
      [normalizedEmail]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = generateToken(user.id, user.role);

    res.json({
      token,
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone || '',
      address: user.address || '',
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error during login' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
router.get('/me', protect, async (req, res) => {
  res.json({
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    phone: req.user.phone,
    address: req.user.address,
  });
});

export default router;
