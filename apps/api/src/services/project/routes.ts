import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ data: [], meta: { total: 0, page: 1, pageSize: 20 } });
});

router.post('/', (_req, res) => {
  res.status(201).json({ data: { id: 'project-placeholder' } });
});

router.get('/:id', (req, res) => {
  res.json({ data: { id: req.params.id, name: 'Placeholder Project' } });
});

export default router;
