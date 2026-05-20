import { Router } from 'express';

const router = Router();

router.get('/optimization', (_req, res) => {
  res.json({ data: [] });
});

export default router;
