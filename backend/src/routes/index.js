import { Router } from 'express';
import auth from './auth.js';
import categories from './categories.js';
import products from './products.js';
import suppliers from './suppliers.js';
import customers from './customers.js';
import sales from './sales.js';
import purchases from './purchases.js';
import stockMovements from './stockMovements.js';
import expenses from './expenses.js';
import reports from './reports.js';
import users from './users.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/health', (_req, res) => res.json({ ok: true }));
router.use('/auth', auth);

router.use(requireAuth);
router.use('/categories', categories);
router.use('/products', products);
router.use('/suppliers', suppliers);
router.use('/customers', customers);
router.use('/sales', sales);
router.use('/purchases', purchases);
router.use('/stock-movements', stockMovements);
router.use('/expenses', expenses);
router.use('/reports', reports);
router.use('/users', users);

export default router;
