import { Router } from 'express';
import { query, execute, withTransaction } from '../config/db.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    res.json(await query(
      `SELECT p.*, s.name AS supplier_name FROM purchases p
       LEFT JOIN suppliers s ON s.id = p.supplier_id ORDER BY p.purchase_date DESC`));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.items?.length) return res.status(400).json({ error: 'items required' });
    const inv = `PUR-${Date.now().toString(36).toUpperCase()}`;
    await withTransaction(async (conn) => {
      const [r] = await conn.execute(
        `INSERT INTO purchases (invoice_number, supplier_id, purchase_date, subtotal, gst_amount,
          transport_cost, other_expenses, total_amount, amount_paid, amount_due, payment_method, notes)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [inv, b.supplier_id ?? null, b.purchase_date || new Date(),
         b.subtotal || 0, b.gst_amount || 0, b.transport_cost || 0, b.other_expenses || 0,
         b.total_amount || 0, b.amount_paid ?? 0, b.amount_due ?? 0, b.payment_method || 'cash', b.notes ?? null],
      );
      const purId = r.insertId;
      for (const it of b.items) {
        await conn.execute(
          `INSERT INTO purchase_items (purchase_id, product_id, quantity, rate, gst_percent, gst_amount, total)
           VALUES (?,?,?,?,?,?,?)`,
          [purId, it.product_id, it.quantity, it.rate, it.gst_percent || 0, it.gst_amount || 0, it.total]);
        await conn.execute(
          `INSERT INTO stock_movements (product_id, movement_type, quantity, reason, reference_type, reference_id, unit_cost, user_id)
           VALUES (?, 'in', ?, ?, 'purchase', ?, ?, ?)`,
          [it.product_id, it.quantity, 'Purchase', purId, it.rate, req.user.id]);
        await conn.execute(
          'UPDATE products SET current_stock = current_stock + ?, purchase_price = COALESCE(?, purchase_price) WHERE id = ?',
          [it.quantity, it.rate, it.product_id]);
      }
      res.status(201).json({ id: purId, invoice_number: inv });
    });
  } catch (e) { next(e); }
});

export default router;
