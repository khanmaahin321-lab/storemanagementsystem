import { Router } from 'express';
import { query, execute } from '../config/db.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try { res.json(await query('SELECT * FROM categories ORDER BY parent_id, name')); }
  catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, description = null, parent_id = null } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const result = await execute(
      'INSERT INTO categories (name, description, parent_id) VALUES (?, ?, ?)',
      [name, description, parent_id],
    );
    res.status(201).json(await query('SELECT * FROM categories WHERE id = ?', [result.insertId]));
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, description, parent_id } = req.body;
    await execute(
      'UPDATE categories SET name = COALESCE(?, name), description = COALESCE(?, description), parent_id = COALESCE(?, parent_id) WHERE id = ?',
      [name, description, parent_id, req.params.id],
    );
    res.json(await query('SELECT * FROM categories WHERE id = ?', [req.params.id]));
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await execute('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
