import { Router } from 'express';

const router = Router();

router.get('/research', (_req, res) => {
  res.json({ data: { keywords: [] } });
});

router.get('/gap', (_req, res) => {
  res.json({ data: { gaps: [] } });
});

export default router;
