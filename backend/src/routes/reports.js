import { Router } from 'express';
import { query } from '../config/db.js';

const router = Router();

router.get('/sales', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    let sql = `SELECT s.*, c.name AS customer_name FROM sales s
               LEFT JOIN customers c ON c.id = s.customer_id WHERE 1=1`;
    const p = [];
    if (from) { sql += ' AND s.sale_date >= ?'; p.push(from); }
    if (to) { sql += ' AND s.sale_date <= ?'; p.push(to); }
    sql += ' ORDER BY s.sale_date DESC';
    res.json(await query(sql, p));
  } catch (e) { next(e); }
});

router.get('/stock', async (_req, res, next) => {
  try {
    res.json(await query(
      `SELECT p.id, p.name, p.sku, c.name AS category_name, p.unit,
       p.current_stock, p.purchase_price, p.selling_price,
       (p.current_stock * p.purchase_price) AS stock_value
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       ORDER BY p.name`));
  } catch (e) { next(e); }
});

router.get('/profit', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    let sql = `SELECT pr.name, SUM(si.quantity) AS qty, SUM(si.total) AS revenue,
               SUM(si.quantity * pr.purchase_price) AS cost
               FROM sale_items si JOIN products pr ON pr.id = si.product_id
               JOIN sales s ON s.id = si.sale_id WHERE 1=1`;
    const p = [];
    if (from) { sql += ' AND s.sale_date >= ?'; p.push(from); }
    if (to) { sql += ' AND s.sale_date <= ?'; p.push(to); }
    sql += ' GROUP BY pr.id ORDER BY revenue DESC';
    const rows = await query(sql, p);
    res.json(rows.map(r => ({ ...r, profit: Number(r.revenue) - Number(r.cost) })));
  } catch (e) { next(e); }
});

export default router;
