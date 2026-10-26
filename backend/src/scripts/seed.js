import pool from '../config/db.js';
import { env } from '../config/env.js';
import { createUser } from '../models/User.js';

const DEFAULT_CATEGORIES = [
  ['Marble', 'Natural marble tiles and slabs'],
  ['Granite', 'Natural granite tiles and slabs'],
  ['Tiles', 'General tile collection'],
  ['All Tiles', 'Complete tile collection'],
  ['Stone and Brick Cladding', 'Stone and brick wall cladding'],
  ['Tile Accessories', 'Tile adhesives, trims and installation accessories'],
  ['Home Utility Products', 'Useful home improvement products'],
];

async function run() {
  await createUser({
    name: 'Admin',
    email: env.admin.email,
    password: env.admin.password,
    role: 'admin',
  }).catch(err => {
    if (err.code === 'ER_DUP_ENTRY') console.log('Admin already exists');
    else throw err;
  });

  const conn = await pool.getConnection();
  try {
    for (const [name, desc] of DEFAULT_CATEGORIES) {
      await conn.query(
        'INSERT IGNORE INTO categories (name, description) VALUES (?, ?)',
        [name, desc],
      );
    }
    console.log('Seed complete.');
    console.log('Admin login:', env.admin.email, '/', env.admin.password);
  } finally {
    conn.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
