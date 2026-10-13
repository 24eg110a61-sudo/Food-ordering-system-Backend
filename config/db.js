import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

let pool = null;

export const getDB = () => {
  if (!pool) {
    throw new Error('Database pool has not been initialized. Call initDB() first.');
  }
  return pool;
};

export const initDB = async () => {
  try {
    const config = {
      host: process.env.TIDB_HOST || '127.0.0.1',
      port: Number(process.env.TIDB_PORT) || 4000,
      user: process.env.TIDB_USER || 'root',
      password: process.env.TIDB_PASSWORD || '',
      database: process.env.TIDB_DATABASE || 'food_ordering_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      ssl: process.env.TIDB_HOST && process.env.TIDB_HOST !== '127.0.0.1' ? {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      } : undefined,
    };

    pool = mysql.createPool(config);

    // Test connection
    const connection = await pool.getConnection();
    console.log(`✅ Connected to TiDB Cloud (MySQL): ${config.host}:${config.port}/${config.database}`);
    connection.release();

    // Initialize tables automatically
    await createTables();
  } catch (error) {
    console.error(`❌ TiDB Cloud Connection Error: ${error.message}`);
    console.error(`💡 Tip: Check your TIDB_HOST, TIDB_USER, TIDB_PASSWORD, and TIDB_DATABASE in backend/.env`);
    process.exit(1);
  }
};

const createTables = async () => {
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
