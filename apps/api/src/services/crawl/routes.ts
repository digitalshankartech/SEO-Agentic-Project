import { Router } from 'express';

const router = Router();

router.post('/start', (_req, res) => {
  res.status(202).json({ data: { jobId: 'placeholder', sessionId: 'placeholder' } });
});

router.get('/sessions/:id', (req, res) => {
  res.json({ data: { id: req.params.id, status: 'running', urlCount: 0, errorCount: 0 } });
});

router.get('/results/:sessionId', (req, res) => {
  res.json({ data: [], meta: { total: 0, page: 1, pageSize: 25 } });
});

export default router;
