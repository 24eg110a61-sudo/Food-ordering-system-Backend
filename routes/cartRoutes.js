import express from 'express';
import { getDB } from '../config/db.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Helper to return standardized cart item list from TiDB
const getFormattedCart = async (userId) => {
  const db = getDB();
  const query = `
    SELECT
      c.id, c.food_id as foodId, f.name, f.price, c.quantity, f.image_url as imageUrl
    FROM cart_items c
    INNER JOIN foods f ON c.food_id = f.id
    WHERE c.user_id = ?
    ORDER BY c.id ASC
  `;
  const [rows] = await db.query(query, [userId]);
  return rows.map((i) => ({
    id: i.id,
    foodId: i.foodId,
    name: i.name,
    price: Number(i.price),
    quantity: i.quantity,
    imageUrl: i.imageUrl || '',
  }));
};

// All cart routes require customer authentication
router.use(protect);

// @route   GET /api/cart
// @desc    Get current user's cart from TiDB
router.get('/', async (req, res) => {
  try {
    const cart = await getFormattedCart(req.user.id);
    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch cart' });
  }
});

// @route   POST /api/cart
// @desc    Add item to cart in TiDB
router.post('/', async (req, res) => {
  try {
    const { foodId, quantity = 1 } = req.body;

    if (!foodId) {
      return res.status(400).json({ message: 'foodId is required' });
    }

    const db = getDB();
    const [foods] = await db.query('SELECT id, name, price, available FROM foods WHERE id = ?', [Number(foodId)]);

    if (foods.length === 0) {
      return res.status(404).json({ message: 'Food item not found' });
    }

    const food = foods[0];
    if (!food.available) {
      return res.status(400).json({ message: 'Sorry, this item is currently unavailable' });
    }

    const qtyToAdd = Math.max(1, Number(quantity) || 1);

    const [existing] = await db.query(
      'SELECT id, quantity FROM cart_items WHERE user_id = ? AND food_id = ?',
      [req.user.id, food.id]
    );

    if (existing.length > 0) {
      await db.query(
        'UPDATE cart_items SET quantity = quantity + ? WHERE id = ?',
        [qtyToAdd, existing[0].id]
      );
    } else {
      await db.query(
        'INSERT INTO cart_items (user_id, food_id, quantity) VALUES (?, ?, ?)',
        [req.user.id, food.id, qtyToAdd]
      );
    }

    const cart = await getFormattedCart(req.user.id);
    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to add item to cart' });
  }
});

// @route   PUT /api/cart/:id
// @desc    Update quantity of a cart item in TiDB
router.put('/:id', async (req, res) => {
  try {
    const { quantity } = req.body;
    const qty = Number(quantity);
    const db = getDB();

    if (qty <= 0) {
      await db.query('DELETE FROM cart_items WHERE id = ? AND user_id = ?', [Number(req.params.id), req.user.id]);
    } else {
      await db.query(
        'UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?',
        [qty, Number(req.params.id), req.user.id]
      );
    }

    const cart = await getFormattedCart(req.user.id);
    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to update cart' });
  }
});

// @route   DELETE /api/cart/:id
// @desc    Remove an item from cart in TiDB
router.delete('/:id', async (req, res) => {
  try {
    const db = getDB();
    await db.query('DELETE FROM cart_items WHERE id = ? AND user_id = ?', [Number(req.params.id), req.user.id]);
    const cart = await getFormattedCart(req.user.id);
    res.json(cart);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to remove cart item' });
  }
});

// @route   DELETE /api/cart
// @desc    Clear entire cart
router.delete('/', async (req, res) => {
  try {
    const db = getDB();
    await db.query('DELETE FROM cart_items WHERE user_id = ?', [req.user.id]);
    res.json([]);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to clear cart' });
  }
});

export default router;
