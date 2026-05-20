import { Router } from 'express';

const router = Router();

router.post('/register', (_req, res) => {
  res.status(201).json({ data: { message: 'register endpoint placeholder' } });
});

router.post('/login', (_req, res) => {
  res.json({ data: { accessToken: 'placeholder', refreshToken: 'placeholder' } });
});

router.post('/refresh', (_req, res) => {
  res.json({ data: { accessToken: 'placeholder' } });
});

router.post('/logout', (_req, res) => {
  res.status(204).send();
});

router.post('/api-keys', (_req, res) => {
  res.status(201).json({ data: { id: 'placeholder-key' } });
});

router.delete('/api-keys/:id', (req, res) => {
  res.status(204).send();
});

export default router;
