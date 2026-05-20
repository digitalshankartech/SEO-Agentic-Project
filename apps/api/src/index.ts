import app from './app.js';

const PORT = Number(process.env.PORT ?? 3001);

app.listen(PORT, () => {
  console.log(`\n✦  SEO Agentic API  →  http://localhost:${PORT}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`\n   Frontend (Vite)  →  http://localhost:5173\n`);
  }
});
