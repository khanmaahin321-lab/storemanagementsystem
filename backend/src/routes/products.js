import { Router } from 'express';
import { query, execute, withTransaction } from '../config/db.js';

const router = Router();

const FIELDS = `id, name, sku, category_id, brand, model, color, finish, size, thickness, unit,
  purchase_price, selling_price, wholesale_price, gst_percent, opening_stock, current_stock,
  minimum_stock, supplier_id, image_url, barcode, is_active, created_at, updated_at`;

router.get('/', async (_req, res, next) => {
  try {
    res.json(await query(
      `SELECT p.*, c.name AS category_name
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       ORDER BY p.name`,
    ));
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT ${FIELDS} FROM products WHERE id = ?`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.name) return res.status(400).json({ error: 'name required' });
    const sku = b.sku || `PRD-${Date.now().toString(36).toUpperCase()}`;
    await withTransaction(async (conn) => {
      const [r] = await conn.execute(
        `INSERT INTO products
         (name, sku, category_id, brand, model, color, finish, size, thickness, unit,
          purchase_price, selling_price, wholesale_price, gst_percent, opening_stock,
          current_stock, minimum_stock, supplier_id, image_url, barcode)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [b.name, sku, b.category_id ?? null, b.brand ?? null, b.model ?? null, b.color ?? null,
         b.finish ?? null, b.size ?? null, b.thickness ?? null, b.unit || 'sq.ft',
         b.purchase_price ?? 0, b.selling_price ?? 0, b.wholesale_price ?? 0, b.gst_percent ?? 18,
         b.opening_stock ?? 0, b.opening_stock ?? 0, b.minimum_stock ?? 0,
         b.supplier_id ?? null, b.image_url ?? null, b.barcode ?? null],
      );
      if (Number(b.opening_stock || 0) > 0) {
        await conn.execute(
          `INSERT INTO stock_movements (product_id, movement_type, quantity, reason, user_id)
           VALUES (?, 'opening', ?, 'Opening stock', ?)`,
          [r.insertId, b.opening_stock, req.user.id],
        );
      }
      res.status(201).json(await query('SELECT * FROM products WHERE id = ?', [r.insertId]));
    });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body;
    await execute(
      `UPDATE products SET
        name=COALESCE(?,name), category_id=COALESCE(?,category_id), brand=COALESCE(?,brand),
        model=COALESCE(?,model), color=COALESCE(?,color), finish=COALESCE(?,finish),
        size=COALESCE(?,size), thickness=COALESCE(?,thickness), unit=COALESCE(?,unit),
        purchase_price=COALESCE(?,purchase_price), selling_price=COALESCE(?,selling_price),
        wholesale_price=COALESCE(?,wholesale_price), gst_percent=COALESCE(?,gst_percent),
        minimum_stock=COALESCE(?,minimum_stock), supplier_id=COALESCE(?,supplier_id),
        image_url=COALESCE(?,image_url), barcode=COALESCE(?,barcode),
        is_active=COALESCE(?,is_active), updated_at=NOW() WHERE id=?`,
      [b.name, b.category_id, b.brand, b.model, b.color, b.finish, b.size, b.thickness,
       b.unit, b.purchase_price, b.selling_price, b.wholesale_price, b.gst_percent,
       b.minimum_stock, b.supplier_id, b.image_url, b.barcode, b.is_active, req.params.id],
    );
    res.json(await query('SELECT * FROM products WHERE id = ?', [req.params.id]));
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await execute('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
