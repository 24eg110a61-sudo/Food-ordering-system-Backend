import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

let pool = null;
let lastDbError = null;

export const getDB = () => {
  if (!pool) {
    throw new Error(lastDbError ? `Database connection failed: ${lastDbError}` : 'Database pool is still initializing...');
  }
  return pool;
};

export const getDbStatus = () => ({
  connected: !!pool,
  error: lastDbError,
});

export const initDB = async () => {
  try {
    const baseConfig = {
      host: process.env.TIDB_HOST || '127.0.0.1',
      port: Number(process.env.TIDB_PORT) || 4000,
      user: process.env.TIDB_USER || 'root',
      password: process.env.TIDB_PASSWORD || '',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      ssl: process.env.TIDB_HOST && process.env.TIDB_HOST !== '127.0.0.1' ? {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      } : undefined,
    };

    const targetDb = process.env.TIDB_DATABASE || 'food_ordering_db';

    // Step 1: Ensure database exists
    try {
      const initConn = await mysql.createConnection(baseConfig);
      await initConn.query(`CREATE DATABASE IF NOT EXISTS \`${targetDb}\`;`);
      await initConn.end();
    } catch (e) {
      console.warn(`Note: Could not run CREATE DATABASE: ${e.message}`);
    }

    // Step 2: Create connection pool for the target database
    pool = mysql.createPool({
      ...baseConfig,
      database: targetDb,
    });

    const connection = await pool.getConnection();
    console.log(`✅ Connected to TiDB Cloud (MySQL): ${baseConfig.host}:${baseConfig.port}/${targetDb}`);
    connection.release();

    lastDbError = null;

    // Step 3: Automatically initialize tables
    await createTables();
  } catch (error) {
    lastDbError = error.message;
    console.error(`❌ TiDB Cloud Connection Error: ${error.message}`);
    console.error(`💡 Tip: Check your TIDB_HOST, TIDB_USER, TIDB_PASSWORD, and TIDB_DATABASE in backend/.env or Render`);
    // Do NOT exit process so Render web service stays online and reports diagnostic messages
  }
};

const createTables = async () => {
  if (!pool) return;
  const db = getDB();

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      phone VARCHAR(50) DEFAULT '',
      address TEXT,
      role VARCHAR(20) DEFAULT 'CUSTOMER',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS foods (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      description TEXT,
      price DECIMAL(10,2) NOT NULL,
      image_url TEXT,
      available BOOLEAN DEFAULT TRUE,
      category_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      food_id INT NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_food (user_id, food_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      customer_name VARCHAR(100) NOT NULL,
      customer_email VARCHAR(100) NOT NULL,
      customer_phone VARCHAR(50) DEFAULT '',
      delivery_address TEXT NOT NULL,
      total DECIMAL(10,2) NOT NULL,
      status VARCHAR(50) DEFAULT 'PLACED',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      food_id INT,
      name VARCHAR(150) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      quantity INT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  console.log('✅ TiDB Cloud tables verified and ready.');
};
