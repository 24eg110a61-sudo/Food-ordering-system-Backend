import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import { initDB } from './config/db.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import foodRoutes from './routes/foodRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Connect to TiDB Cloud & ensure tables exist
initDB();

// Global Middlewares
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

import { seedDatabase } from './seed.js';

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'Online Food Ordering System API is running smoothly',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Convenient 1-click cloud database seeder endpoint
const handleSeed = async (req, res) => {
  try {
    await seedDatabase();
    res.json({
      success: true,
      message: 'TiDB Cloud successfully seeded with sample foods and accounts!',
      credentials: {
        admin: 'admin@food.com / admin123',
        customer: 'customer@gmail.com / customer123',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
app.get('/api/seed', handleSeed);
app.get('/seed', handleSeed);

// Mount API routes (supports both with and without /api prefix)
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

app.use('/api/foods', foodRoutes);
app.use('/foods', foodRoutes);

app.use('/api/categories', categoryRoutes);
app.use('/categories', categoryRoutes);

app.use('/api/cart', cartRoutes);
app.use('/cart', cartRoutes);

app.use('/api/orders', orderRoutes);
app.use('/orders', orderRoutes);

app.use('/api/admin', adminRoutes);
app.use('/admin', adminRoutes);

// 404 Handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

// Listen on configured port
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Food Ordering Server running in ${process.env.NODE_ENV || 'development'} mode on http://localhost:${PORT}`);
});
