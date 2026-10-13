import express from 'express';
import { getDB } from '../config/db.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.use(protect, adminOnly);

// ==================== STATISTICS ====================
// @route   GET /api/admin/stats
// @desc    Get dashboard metrics from TiDB
router.get('/stats', async (req, res) => {
  try {
    const db = getDB();

    const [[orderCount]] = await db.query('SELECT COUNT(*) as cnt FROM orders');
    const [[rev]] = await db.query("SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE status != 'CANCELLED'");
    const [[custCount]] = await db.query("SELECT COUNT(*) as cnt FROM users WHERE role = 'CUSTOMER'");
    const [[foodCount]] = await db.query('SELECT COUNT(*) as cnt FROM foods');

    const statuses = ['PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
    const [statusRows] = await db.query('SELECT status, COUNT(*) as cnt FROM orders GROUP BY status');

    const ordersByStatus = {};
    for (const s of statuses) ordersByStatus[s] = 0;
    for (const r of statusRows) ordersByStatus[r.status] = r.cnt;

    res.json({
      totalOrders: orderCount.cnt,
      totalRevenue: Number(rev.total),
      totalCustomers: custCount.cnt,
      totalFoodItems: foodCount.cnt,
      ordersByStatus,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch statistics' });
  }
});

// ==================== FOOD ITEMS ====================
// @route   POST /api/admin/foods
// @desc    Add a new food item in TiDB
router.post('/foods', async (req, res) => {
  try {
    const { name, description, price, imageUrl, available, categoryId, category } = req.body;
    const catId = categoryId || category;

    if (!name || price === undefined || !catId) {
      return res.status(400).json({ message: 'Name, price, and category are required' });
    }

    const db = getDB();
    const [result] = await db.query(
      `INSERT INTO foods (name, description, price, image_url, available, category_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name.trim(), description || '', Number(price), imageUrl || '', available !== undefined ? Boolean(available) : true, Number(catId)]
    );

    const [rows] = await db.query(`
      SELECT f.id, f.name, f.description, f.price, f.image_url as imageUrl, f.available,
             c.id as cat_id, c.name as cat_name, c.description as cat_desc
      FROM foods f
      LEFT JOIN categories c ON f.category_id = c.id
      WHERE f.id = ?
    `, [result.insertId]);

    const r = rows[0];
    res.status(201).json({
      id: r.id,
      name: r.name,
      description: r.description,
      price: Number(r.price),
      imageUrl: r.imageUrl,
      available: Boolean(r.available),
      category: r.cat_id ? { id: r.cat_id, name: r.cat_name, description: r.cat_desc } : null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to create food item' });
  }
});

// @route   PUT /api/admin/foods/:id
// @desc    Update an existing food item in TiDB
router.put('/foods/:id', async (req, res) => {
  try {
    const { name, description, price, imageUrl, available, categoryId, category } = req.body;
    const catId = categoryId || category;
    const db = getDB();

    await db.query(
      `UPDATE foods SET
         name = COALESCE(?, name),
         description = COALESCE(?, description),
         price = COALESCE(?, price),
         image_url = COALESCE(?, image_url),
         available = COALESCE(?, available),
         category_id = COALESCE(?, category_id)
       WHERE id = ?`,
      [
        name ? name.trim() : null,
        description !== undefined ? description : null,
        price !== undefined ? Number(price) : null,
        imageUrl !== undefined ? imageUrl : null,
        available !== undefined ? Boolean(available) : null,
        catId ? Number(catId) : null,
        Number(req.params.id),
      ]
    );

    const [rows] = await db.query(`
      SELECT f.id, f.name, f.description, f.price, f.image_url as imageUrl, f.available,
             c.id as cat_id, c.name as cat_name, c.description as cat_desc
      FROM foods f
      LEFT JOIN categories c ON f.category_id = c.id
      WHERE f.id = ?
    `, [Number(req.params.id)]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Food item not found' });
    }

    const r = rows[0];
    res.json({
      id: r.id,
      name: r.name,
      description: r.description,
      price: Number(r.price),
      imageUrl: r.imageUrl,
      available: Boolean(r.available),
      category: r.cat_id ? { id: r.cat_id, name: r.cat_name, description: r.cat_desc } : null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to update food item' });
  }
});

// @route   DELETE /api/admin/foods/:id
// @desc    Delete a food item
router.delete('/foods/:id', async (req, res) => {
  try {
    const db = getDB();
    const [result] = await db.query('DELETE FROM foods WHERE id = ?', [Number(req.params.id)]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Food item not found' });
    }
    res.json({ message: 'Food item deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to delete food item' });
  }
});

// ==================== CATEGORIES ====================
// @route   POST /api/admin/categories
router.post('/categories', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const db = getDB();
    const [result] = await db.query(
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      [name.trim(), description || '']
    );

    res.status(201).json({ id: result.insertId, name: name.trim(), description: description || '' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to create category' });
  }
});

// @route   PUT /api/admin/categories/:id
router.put('/categories/:id', async (req, res) => {
  try {
    const { name, description } = req.body;
    const db = getDB();

    await db.query(
      'UPDATE categories SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?',
      [name ? name.trim() : null, description !== undefined ? description : null, Number(req.params.id)]
    );

    const [rows] = await db.query('SELECT id, name, description FROM categories WHERE id = ?', [Number(req.params.id)]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to update category' });
  }
});

// @route   DELETE /api/admin/categories/:id
router.delete('/categories/:id', async (req, res) => {
  try {
    const db = getDB();
    const [[foodCount]] = await db.query('SELECT COUNT(*) as cnt FROM foods WHERE category_id = ?', [Number(req.params.id)]);
    if (foodCount.cnt > 0) {
      return res.status(400).json({
        message: `Cannot delete category: ${foodCount.cnt} food item(s) are assigned to it.`,
      });
    }

    const [result] = await db.query('DELETE FROM categories WHERE id = ?', [Number(req.params.id)]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to delete category' });
  }
});

// ==================== ORDERS ====================
// @route   GET /api/admin/orders
router.get('/orders', async (req, res) => {
  try {
    const db = getDB();
    const [orders] = await db.query('SELECT * FROM orders ORDER BY created_at DESC');

    if (orders.length === 0) return res.json([]);

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

    const fullOrders = orders.map((o) => ({
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

    res.json(fullOrders);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch orders' });
  }
});

// @route   PUT /api/admin/orders/:id/status
router.put('/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['PLACED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${allowed.join(', ')}` });
    }

    const db = getDB();
    await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, Number(req.params.id)]);

    const [rows] = await db.query('SELECT * FROM orders WHERE id = ?', [Number(req.params.id)]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to update order status' });
  }
});

// ==================== CUSTOMERS ====================
// @route   GET /api/admin/customers
router.get('/customers', async (req, res) => {
  try {
    const db = getDB();
    const [customers] = await db.query(
      "SELECT id, name, email, phone, address, created_at as createdAt FROM users WHERE role = 'CUSTOMER' ORDER BY id DESC"
    );
    res.json(customers);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to fetch customers' });
  }
});

export default router;
