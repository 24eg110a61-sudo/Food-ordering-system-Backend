import express from 'express';
import { getDB } from '../config/db.js';

const router = express.Router();

// @route   GET /api/categories
// @desc    Get all categories from TiDB
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const [rows] = await db.query('SELECT id, name, description FROM categories ORDER BY name ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch categories' });
  }
});

export default router;
