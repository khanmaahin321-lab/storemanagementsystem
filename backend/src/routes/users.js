import { Router } from 'express';
import { listUsers } from '../models/User.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAdmin);
router.get('/', async (_req, res, next) => {
  try { res.json(await listUsers()); } catch (e) { next(e); }
});

export default router;
