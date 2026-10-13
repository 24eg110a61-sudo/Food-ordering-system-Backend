import express from 'express';
import { getDB } from '../config/db.js';

const router = express.Router();

// Helper to format food row matching React frontend structure
const formatFood = (r) => ({
  id: r.id,
  name: r.name,
  description: r.description || '',
  price: Number(r.price),
  imageUrl: r.imageUrl || '',
  available: Boolean(r.available),
  category: r.cat_id ? {
    id: r.cat_id,
    name: r.cat_name,
    description: r.cat_desc || '',
  } : null,
});

// @route   GET /api/foods
// @desc    Get all foods with search and category filters from TiDB
router.get('/', async (req, res) => {
  try {
    const { q, categoryId } = req.query;
    const db = getDB();

    let query = `
      SELECT
        f.id, f.name, f.description, f.price, f.image_url as imageUrl, f.available,
        c.id as cat_id, c.name as cat_name, c.description as cat_desc
      FROM foods f
      LEFT JOIN categories c ON f.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (categoryId) {
      query += ' AND f.category_id = ?';
      params.push(Number(categoryId));
    }

    if (q && q.trim()) {
      query += ' AND (f.name LIKE ? OR f.description LIKE ?)';
      const term = `%${q.trim()}%`;
      params.push(term, term);
    }

    query += ' ORDER BY f.id ASC';

    const [rows] = await db.query(query, params);
    res.json(rows.map(formatFood));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch food items' });
  }
});

// @route   GET /api/foods/:id
// @desc    Get single food item by ID
router.get('/:id', async (req, res) => {
  try {
    const db = getDB();
    const query = `
      SELECT
        f.id, f.name, f.description, f.price, f.image_url as imageUrl, f.available,
        c.id as cat_id, c.name as cat_name, c.description as cat_desc
      FROM foods f
      LEFT JOIN categories c ON f.category_id = c.id
      WHERE f.id = ?
    `;
    const [rows] = await db.query(query, [Number(req.params.id)]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Food item not found' });
    }

    res.json(formatFood(rows[0]));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch food item' });
  }
});

export default router;
