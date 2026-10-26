import bcrypt from 'bcryptjs';
import { query, execute } from '../config/db.js';

export async function createUser({ name, email, password, role = 'staff' }) {
  const hashed = await bcrypt.hash(password, 10);
  const result = await execute(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
    [name, email, hashed, role],
  );
  return findById(result.insertId);
}

export async function findByEmail(email) {
  const rows = await query('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0];
}

export async function findById(id) {
  const rows = await query(
    'SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?',
    [id],
  );
  return rows[0];
}

export async function verifyPassword(user, password) {
  return bcrypt.compare(password, user.password);
}

export async function listUsers() {
  return query('SELECT id, name, email, role, is_active, created_at FROM users ORDER BY name');
}
