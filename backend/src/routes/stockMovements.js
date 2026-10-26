import { Router } from 'express';
import { query, execute, withTransaction } from '../config/db.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { from, to, type, product_id } = req.query;
    let sql = `SELECT m.*, p.name AS product_name, p.unit
               FROM stock_movements m JOIN products p ON p.id = m.product_id WHERE 1=1`;
    const params = [];
    if (from) { sql += ' AND m.created_at >= ?'; params.push(from + ' 00:00:00'); }
    if (to) { sql += ' AND m.created_at <= ?'; params.push(to + ' 23:59:59'); }
    if (type) { sql += ' AND m.movement_type = ?'; params.push(type); }
    if (product_id) { sql += ' AND m.product_id = ?'; params.push(product_id); }
    sql += ' ORDER BY m.created_at DESC';
    res.json(await query(sql, params));
  } catch (e) { next(e); }
});

router.post('/adjust', async (req, res, next) => {
  try {
    const { product_id, movement_type, quantity, reason, notes } = req.body;
    if (!product_id || !movement_type || !quantity) return res.status(400).json({ error: 'product_id, movement_type, quantity required' });
    if (!['adjustment_in', 'adjustment_out'].includes(movement_type)) return res.status(400).json({ error: 'Invalid type' });
    await withTransaction(async (conn) => {
      await conn.execute(
        `INSERT INTO stock_movements (product_id, movement_type, quantity, reason, notes, user_id)
         VALUES (?,?,?,?,?,?)`,
        [product_id, movement_type, quantity, reason || 'Adjustment', notes || null, req.user.id]);
      const delta = movement_type === 'adjustment_in' ? quantity : -quantity;
      await conn.execute('UPDATE products SET current_stock = current_stock + ? WHERE id = ?', [delta, product_id]);
      res.json({ ok: true });
    });
  } catch (e) { next(e); }
});

export default router;
