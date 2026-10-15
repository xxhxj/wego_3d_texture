import express from 'express';
import { config } from './config.js';
import { pool } from './db.js';
import { requireAuth } from './sso.js';
import { coverUrl, minio, putObject } from './storage.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '6mb' }));
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
    tag: row.tag_name || row.name,
    memberOnly: Boolean(row.member_only),
    coverUrl: coverUrl(row.cover_key),
    artUrl: row.art_key ? `/api/art/${row.code}` : '',
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

app.get('/api/art/:code', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT art_key FROM models WHERE code = ? LIMIT 1', [req.params.code]);
    if (!rows[0]?.art_key) return res.status(404).json({ message: '没有图案' });
    const stream = await minio.getObject(config.minio.bucket, rows[0].art_key);
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
});

app.get('/api/catalog', requireAuth, async (_req, res, next) => {
  try {
    const [categories] = await pool.query(
      'SELECT code, name FROM categories ORDER BY sort_order, code',
    );
    const [models] = await pool.query(
      'SELECT * FROM models ORDER BY sort_order, code',
    );
    const used = new Set(models.map((item) => item.category_code));
    res.json({
      categories: categories
        .filter((item) => used.has(item.code))
        .map((item) => ({ id: item.code, name: item.name })),
      models: models.map(mapModel),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/works', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, model_code AS modelCode, design_json AS designJson,
              preview_key AS previewKey, created_at AS createdAt
       FROM works WHERE user_id = ? ORDER BY id DESC LIMIT 60`,
      [req.user.id],
    );
    res.json({
      data: rows.map((row) => ({
        id: row.id,
        title: row.title,
        modelCode: row.modelCode,
        createdAt: row.createdAt,
        design: JSON.parse(row.designJson),
        previewUrl: coverUrl(row.previewKey),
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/works', requireAuth, async (req, res, next) => {
  const title = String(req.body?.title || '未命名导出').slice(0, 128);
  const modelCode = String(req.body?.modelCode || '').slice(0, 64);
  const design = req.body?.design || {};
  const preview = String(req.body?.preview || '');
  if (!modelCode) return res.status(400).json({ message: '缺少样机' });
  try {
    const [result] = await pool.execute(
      'INSERT INTO works (user_id, title, model_code, design_json) VALUES (?, ?, ?, ?)',
      [req.user.id, title, modelCode, JSON.stringify(design)],
    );
    const matched = preview.match(/^data:image\/jpeg;base64,(.+)$/);
    if (matched) {
      const key = `works/${req.user.id}/${result.insertId}.jpg`;
      await putObject(key, Buffer.from(matched[1], 'base64'), 'image/jpeg');
      await pool.execute('UPDATE works SET preview_key = ? WHERE id = ?', [key, result.insertId]);
    }
    res.json({ id: result.insertId });
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
