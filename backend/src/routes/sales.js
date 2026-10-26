import { Router } from 'express';
import { query, execute, withTransaction } from '../config/db.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    res.json(await query(
      `SELECT s.*, c.name AS customer_name FROM sales s
       LEFT JOIN customers c ON c.id = s.customer_id ORDER BY s.sale_date DESC`));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.items?.length) return res.status(400).json({ error: 'items required' });
    const inv = `INV-${Date.now().toString(36).toUpperCase()}`;
    await withTransaction(async (conn) => {
      const [r] = await conn.execute(
        `INSERT INTO sales (invoice_number, customer_id, sale_date, subtotal, discount_amount,
          gst_amount, delivery_charge, total_amount, amount_paid, amount_due, payment_method, notes)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [inv, b.customer_id ?? null, b.sale_date || new Date(),
         b.subtotal || 0, b.discount_amount || 0, b.gst_amount || 0, b.delivery_charge || 0,
         b.total_amount || 0, b.amount_paid ?? 0, b.amount_due ?? 0, b.payment_method || 'cash', b.notes ?? null],
      );
      const saleId = r.insertId;
      for (const it of b.items) {
        await conn.execute(
          `INSERT INTO sale_items (sale_id, product_id, quantity, rate, gst_percent, gst_amount, total)
           VALUES (?,?,?,?,?,?,?)`,
          [saleId, it.product_id, it.quantity, it.rate, it.gst_percent || 0, it.gst_amount || 0, it.total],
        );
        await conn.execute(
          `INSERT INTO stock_movements (product_id, movement_type, quantity, reason, reference_type, reference_id, user_id)
           VALUES (?, 'out', ?, ?, 'sale', ?, ?)`,
          [it.product_id, it.quantity, 'Sale', saleId, req.user.id]);
        await conn.execute('UPDATE products SET current_stock = current_stock - ? WHERE id = ?', [it.quantity, it.product_id]);
      }
      res.status(201).json({ id: saleId, invoice_number: inv });
    });
  } catch (e) { next(e); }
});

export default router;
