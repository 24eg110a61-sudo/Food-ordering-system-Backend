import express from 'express';
import { getDB } from '../config/db.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

// Helper to attach items to orders
const attachItemsToOrders = async (db, orders) => {
  if (orders.length === 0) return [];
  const orderIds = orders.map((o) => o.id);

  const [items] = await db.query(
    `SELECT id, order_id, food_id, name, price, quantity FROM order_items WHERE order_id IN (?)`,
    [orderIds]
  );

  const itemsByOrder = {};
  for (const it of items) {
    if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
    itemsByOrder[it.order_id].push({
      id: it.id,
      foodId: it.food_id,
      name: it.name,
      price: Number(it.price),
      quantity: it.quantity,
    });
  }

  return orders.map((o) => ({
    id: o.id,
    userId: o.user_id,
    customerName: o.customer_name,
    customerEmail: o.customer_email,
    customerPhone: o.customer_phone || '',
    deliveryAddress: o.delivery_address,
    total: Number(o.total),
    status: o.status,
    createdAt: o.created_at,
    items: itemsByOrder[o.id] || [],
  }));
};

// @route   POST /api/orders
// @desc    Place a new order from current cart in TiDB
router.post('/', async (req, res) => {
  try {
    const { deliveryAddress } = req.body;

    if (!deliveryAddress || !deliveryAddress.trim()) {
      return res.status(400).json({ message: 'Delivery address is required' });
    }

    const db = getDB();

    // Fetch user's cart items
    const [cartItems] = await db.query(`
      SELECT c.food_id, f.name, f.price, f.available, c.quantity
      FROM cart_items c
      INNER JOIN foods f ON c.food_id = f.id
      WHERE c.user_id = ?
    `, [req.user.id]);

    if (cartItems.length === 0) {
      return res.status(400).json({ message: 'Your cart is empty' });
    }

    // Check availability and calculate secure total
    let total = 0;
    for (const item of cartItems) {
      if (!item.available) {
        return res.status(400).json({
          message: `"${item.name}" is no longer available. Please remove it from your cart.`,
        });
      }
      total += Number(item.price) * item.quantity;
    }

    // Insert order
    const [orderResult] = await db.query(
      `INSERT INTO orders (user_id, customer_name, customer_email, customer_phone, delivery_address, total, status)
       VALUES (?, ?, ?, ?, ?, ?, 'PLACED')`,
      [req.user.id, req.user.name, req.user.email, req.user.phone || '', deliveryAddress.trim(), total]
    );

    const orderId = orderResult.insertId;

    // Insert order items
    for (const item of cartItems) {
      await db.query(
        `INSERT INTO order_items (order_id, food_id, name, price, quantity) VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.food_id, item.name, item.price, item.quantity]
      );
    }

    // Clear user's cart
    await db.query('DELETE FROM cart_items WHERE user_id = ?', [req.user.id]);

    // Fetch and return created order
    const [createdOrder] = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    const [fullOrder] = await attachItemsToOrders(db, createdOrder);

    res.status(201).json(fullOrder);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to place order' });
  }
});

// @route   GET /api/orders
// @desc    Get logged-in user's order history from TiDB
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const [orders] = await db.query('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    const fullOrders = await attachItemsToOrders(db, orders);
    res.json(fullOrders);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch orders' });
  }
});

// @route   GET /api/orders/:id
// @desc    Get order details by ID
router.get('/:id', async (req, res) => {
  try {
    const db = getDB();
    const [orders] = await db.query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [Number(req.params.id), req.user.id]);
    if (orders.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }
    const [fullOrder] = await attachItemsToOrders(db, orders);
    res.json(fullOrder);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch order' });
  }
});

// @route   PUT /api/orders/:id/cancel
// @desc    Cancel an order (only allowed if still in PLACED status)
router.put('/:id/cancel', async (req, res) => {
  try {
    const db = getDB();
    const [orders] = await db.query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [Number(req.params.id), req.user.id]);

    if (orders.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const order = orders[0];
    if (order.status !== 'PLACED') {
      return res.status(400).json({
        message: `Order cannot be cancelled because it is already ${order.status.toLowerCase().replace('_', ' ')}`,
      });
    }

    await db.query("UPDATE orders SET status = 'CANCELLED' WHERE id = ?", [order.id]);

    const [updated] = await db.query('SELECT * FROM orders WHERE id = ?', [order.id]);
    const [fullOrder] = await attachItemsToOrders(db, updated);
    res.json(fullOrder);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to cancel order' });
  }
});

export default router;
