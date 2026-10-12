import express from 'express';
import { config } from './config.js';
import { pool } from './db.js';
import { coverUrl, minio } from './storage.js';

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

function mapModel(row) {
  return {
    id: row.code,
    category: row.category_code,
    name: row.name,
    kind: row.kind,
    w: row.width_mm,
    d: row.depth_mm,
    h: row.height_mm,
    fold: Number(row.fold_amount),
    paper: row.paper || undefined,
    profile: row.profile || undefined,
    handle: Boolean(row.has_handle),
    tint: row.tint || '#f4f0e8',
    coverUrl: coverUrl(row.cover_key),
  };
}

app.get('/api/health', async (_req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT COUNT(*) AS models FROM models');
    const bucket = await minio.bucketExists(config.minio.bucket);
    res.json({
      ok: true,
      database: config.mysql.database,
      models: Number(rows[0].models),
      bucket: config.minio.bucket,
      bucketReady: bucket,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/catalog', async (_req, res, next) => {
  try {
    const [categories] = await pool.query(
      'SELECT code, name FROM categories ORDER BY sort_order, code',
    );
    const [models] = await pool.query(
      'SELECT * FROM models ORDER BY sort_order, code',
    );
    res.json({
      categories: categories.map((item) => ({ id: item.code, name: item.name })),
      models: models.map(mapModel),
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ ok: false, message: '服务暂时不可用' });
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(`api http://127.0.0.1:${config.port}`);
});
