import { Router } from 'express';
import { query, execute } from '../config/db.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    let sql = 'SELECT * FROM expenses WHERE 1=1';
    const params = [];
    if (from) { sql += ' AND expense_date >= ?'; params.push(from); }
    if (to) { sql += ' AND expense_date <= ?'; params.push(to); }
    sql += ' ORDER BY expense_date DESC';
    res.json(await query(sql, params));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.category || !b.amount) return res.status(400).json({ error: 'category and amount required' });
    const [r] = await execute(
      `INSERT INTO expenses (category, description, amount, payment_method, expense_date, notes)
       VALUES (?,?,?,?,?,?)`,
      [b.category, b.description ?? null, b.amount, b.payment_method || 'cash', b.expense_date || new Date(), b.notes ?? null]);
    res.status(201).json(await query('SELECT * FROM expenses WHERE id = ?', [r.insertId]));
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await execute('DELETE FROM expenses WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
