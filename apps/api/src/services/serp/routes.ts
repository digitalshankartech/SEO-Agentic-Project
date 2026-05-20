import { Router } from 'express';

const router = Router();

router.get('/checks', (_req, res) => {
  res.json({ data: [] });
});

router.post('/dispatch', (_req, res) => {
  res.status(202).json({ data: { dispatched: true } });
});

export default router;
