import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { createUser, findByEmail, verifyPassword } from '../models/User.js';

const router = Router();

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
    const existing = await findByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });
    const user = await createUser({ name, email, password });
    res.status(201).json({ user, token: signToken(user) });
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await findByEmail(email);
    if (!user || !(await verifyPassword(user, password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!user.is_active) return res.status(403).json({ error: 'Account disabled' });
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token: signToken(user) });
  } catch (err) { next(err); }
});

export default router;
