import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { initDB, getDB } from './config/db.js';

dotenv.config();

const sampleCategories = [
  {
    name: 'Pizzas',
    description: 'Stone-baked artisan pizzas with mozzarella and fresh toppings',
  },
  {
    name: 'Burgers',
    description: 'Juicy gourmet burgers paired with seasoned sauces and fresh brioche buns',
  },
  {
    name: 'Biryanis & Bowls',
    description: 'Aromatic long-grain basmati biryanis slow-cooked with royal spices',
  },
  {
    name: 'Desserts & Sweets',
    description: 'Decadent chocolate cakes, warm brownies, and sweet delicacies',
  },
  {
    name: 'Beverages',
    description: 'Chilled shakes, refreshing coolers, and freshly brewed coffees',
  },
];

const sampleFoods = [
  {
    categoryName: 'Pizzas',
    name: 'Classic Margherita Pizza',
    description: 'Fresh mozzarella cheese, San Marzano tomato sauce, fragrant basil leaves, and extra virgin olive oil.',
    price: 299,
    imageUrl: 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=600&auto=format&fit=crop&q=80',
  },
  {
    categoryName: 'Pizzas',
    name: 'Paneer Tikka Supreme Pizza',
    description: 'Tandoori marinated paneer cubes, crisp capsicum, red onions, and mozzarella on a hand-tossed crust.',
    price: 369,
    imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80',
  },
  {
    categoryName: 'Pizzas',
    name: 'Pepperoni Feast Pizza',
    description: 'Generous layers of spicy pepperoni, molten mozzarella, and seasoned herbs.',
    price: 449,
    imageUrl: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600&auto=format&fit=crop&q=80',
  },
  {
    categoryName: 'Burgers',
    name: 'Crispy Veggie Crunch Burger',
    description: 'Golden spiced potato-pea patty, fresh lettuce, sliced tomatoes, gherkins, and house thousand-island mayo.',
    price: 179,
    imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&auto=format&fit=crop&q=80',
  },
  {
    categoryName: 'Burgers',
    name: 'Smoky BBQ Chicken Burger',
    description: 'Char-grilled chicken breast glazed in smoky barbecue sauce, cheddar cheese, and caramelized onions.',
    price: 249,
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80',
  },
  {
    categoryName: 'Burgers',
    name: 'Double Truffle Cheeseburger',
    description: 'Two smash patties, double aged cheddar, sautéed mushrooms, and roasted garlic truffle aioli.',
    price: 299,
    imageUrl: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&auto=format&fit=crop&q=80',
  },
  {
    categoryName: 'Biryanis & Bowls',
    name: 'Hyderabadi Dum Chicken Biryani',
    description: 'Authentic kacchi dum biryani layered with tender marinated chicken pieces, saffron basmati rice, and mint.',
    price: 349,
    imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80',
  },
  {
    categoryName: 'Biryanis & Bowls',
    name: 'Shahi Paneer Dum Biryani',
    description: 'Fragrant saffron rice dum-cooked with paneer cubes, cashews, and rich Mughlai whole spices.',
    price: 289,
    imageUrl: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=600&auto=format&fit=crop&q=80',
  },
  {
    categoryName: 'Desserts & Sweets',
    name: 'Warm Belgian Choco Lava Cake',
    description: 'Rich dark chocolate cake with a molten chocolate center, dusted with powdered sugar.',
    price: 149,
    imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&auto=format&fit=crop&q=80',
  },
  {
    categoryName: 'Desserts & Sweets',
    name: 'New York Baked Cheesecake',
    description: 'Velvety cream cheese slice on a buttery graham cracker crust topped with strawberry compote.',
    price: 189,
    imageUrl: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=600&auto=format&fit=crop&q=80',
  },
  {
    categoryName: 'Beverages',
    name: 'Creamy Oreo Milkshake',
    description: 'Thick blend of vanilla ice cream, whole milk, and crushed Oreo cookies topped with whipped cream.',
    price: 139,
    imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=600&auto=format&fit=crop&q=80',
  },
  {
    categoryName: 'Beverages',
    name: 'Fresh Mint Mojito',
    description: 'Sparkling cooler infused with fresh garden mint, crushed lime wedges, and raw cane sugar.',
    price: 119,
    imageUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80',
  },
];

const seedData = async () => {
  try {
    await initDB();
    const db = getDB();

    console.log('Clearing existing records in TiDB Cloud...');
    await db.query('DELETE FROM order_items');
    await db.query('DELETE FROM orders');
    await db.query('DELETE FROM cart_items');
    await db.query('DELETE FROM foods');
    await db.query('DELETE FROM categories');
    await db.query('DELETE FROM users');

    console.log('Seeding default users...');
    const adminPass = await bcrypt.hash('admin123', 10);
    const [adminResult] = await db.query(
      `INSERT INTO users (name, email, password, phone, address, role)
       VALUES (?, ?, ?, ?, ?, 'ADMIN')`,
      ['Restaurant Admin', 'admin@food.com', adminPass, '+91 9876543210', 'Central Kitchen Office, MG Road']
    );

    const custPass = await bcrypt.hash('customer123', 10);
    const [custResult] = await db.query(
      `INSERT INTO users (name, email, password, phone, address, role)
       VALUES (?, ?, ?, ?, ?, 'CUSTOMER')`,
      ['Rahul Sharma', 'customer@gmail.com', custPass, '+91 9123456789', 'Flat 402, Sunshine Apartments, MG Road, Bangalore']
    );

    console.log('Seeding categories...');
    const catMap = {};
    for (const c of sampleCategories) {
      const [res] = await db.query(
        'INSERT INTO categories (name, description) VALUES (?, ?)',
        [c.name, c.description]
      );
      catMap[c.name] = res.insertId;
    }

    console.log('Seeding food items...');
    const foodIds = [];
    for (const f of sampleFoods) {
      const catId = catMap[f.categoryName];
      const [res] = await db.query(
        `INSERT INTO foods (name, description, price, image_url, available, category_id)
         VALUES (?, ?, ?, ?, TRUE, ?)`,
        [f.name, f.description, f.price, f.imageUrl, catId]
      );
      foodIds.push({ id: res.insertId, name: f.name, price: f.price });
    }

    console.log('Seeding sample customer past order...');
    const [orderRes] = await db.query(
      `INSERT INTO orders (user_id, customer_name, customer_email, customer_phone, delivery_address, total, status)
       VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED')`,
      [
        custResult.insertId,
        'Rahul Sharma',
        'customer@gmail.com',
        '+91 9123456789',
        'Flat 402, Sunshine Apartments, MG Road, Bangalore',
        foodIds[0].price * 1 + foodIds[10].price * 2,
      ]
    );

    const orderId = orderRes.insertId;
    await db.query(
      `INSERT INTO order_items (order_id, food_id, name, price, quantity) VALUES (?, ?, ?, ?, ?)`,
      [orderId, foodIds[0].id, foodIds[0].name, foodIds[0].price, 1]
    );
    await db.query(
      `INSERT INTO order_items (order_id, food_id, name, price, quantity) VALUES (?, ?, ?, ?, ?)`,
      [orderId, foodIds[10].id, foodIds[10].name, foodIds[10].price, 2]
    );

    console.log('🎉 TiDB Cloud Seeding Successfully Completed!');
    console.log('--------------------------------------------------');
    console.log('Evaluation Credentials:');
    console.log('  Admin Login:    admin@food.com / admin123');
    console.log('  Customer Login: customer@gmail.com / customer123');
    console.log('--------------------------------------------------');
    return { success: true };
  } catch (err) {
    console.error('❌ TiDB Seeding Error:', err);
    throw err;
  }
};

export { seedData as seedDatabase };

// If executed directly from command line
if (process.argv[1]?.endsWith('seed.js')) {
  seedData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
