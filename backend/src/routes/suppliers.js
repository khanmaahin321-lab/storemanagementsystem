import { Router } from 'express';
import { query, execute } from '../config/db.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try { res.json(await query('SELECT * FROM suppliers ORDER BY name')); }
  catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.name) return res.status(400).json({ error: 'name required' });
    const [r] = await execute(
      `INSERT INTO suppliers (name, contact_person, mobile, email, address, city, state, pincode, gstin, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [b.name, b.contact_person ?? null, b.mobile ?? null, b.email ?? null, b.address ?? null,
       b.city ?? null, b.state ?? null, b.pincode ?? null, b.gstin ?? null, b.notes ?? null],
    );
    res.status(201).json(await query('SELECT * FROM suppliers WHERE id = ?', [r.insertId]));
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body;
    await execute(
      `UPDATE suppliers SET name=COALESCE(?,name), contact_person=COALESCE(?,contact_person),
       mobile=COALESCE(?,mobile), email=COALESCE(?,email), address=COALESCE(?,address),
       city=COALESCE(?,city), state=COALESCE(?,state), pincode=COALESCE(?,pincode),
       gstin=COALESCE(?,gstin), notes=COALESCE(?,notes) WHERE id=?`,
      [b.name, b.contact_person, b.mobile, b.email, b.address, b.city, b.state, b.pincode, b.gstin, b.notes, req.params.id],
    );
    res.json(await query('SELECT * FROM suppliers WHERE id = ?', [req.params.id]));
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await execute('DELETE FROM suppliers WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
