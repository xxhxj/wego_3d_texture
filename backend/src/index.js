import express from 'express';
import { config } from './config.js';
import { ensureLibrarySchema, ensureWorksCategory, pool } from './db.js';
import { libraryRouter, listUploadedModels, mapUpload } from './library.js';
import { requireAuth } from './sso.js';
import { coverUrl, minio, putObject } from './storage.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '6mb' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});
app.use('/api/library', libraryRouter);

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
    res.setHeader('Cache-Control', 'no-store');
    const uploads = await listUploadedModels();
    const used = new Set([
      ...models.map((item) => item.category_code),
      ...uploads.map((item) => item.category_code),
    ]);
    res.json({
      categories: categories
        .filter((item) => used.has(item.code))
        .map((item) => ({ id: item.code, name: item.name })),
      models: [...models.map(mapModel), ...uploads.map(mapUpload)],
    });
  } catch (error) {
    next(error);
  }
});

async function resolveCategory(modelCode, requested) {
  const wanted = String(requested || '').slice(0, 32);
  if (wanted) {
    const [rows] = await pool.query('SELECT code FROM categories WHERE code = ? LIMIT 1', [wanted]);
    if (rows[0]) return rows[0].code;
  }
  const [models] = await pool.query(
    'SELECT category_code AS categoryCode FROM models WHERE code = ? LIMIT 1',
    [modelCode],
  );
  return models[0]?.categoryCode || 'more';
}

async function resolveTag(modelCode, requested) {
  const wanted = String(requested || '').slice(0, 64);
  if (wanted) return wanted;
  const [models] = await pool.query(
    'SELECT tag_name AS tagName FROM models WHERE code = ? LIMIT 1',
    [modelCode],
  );
  return models[0]?.tagName || '';
}

app.get('/api/works', requireAuth, async (req, res, next) => {
  try {
    const category = String(req.query.category || '').slice(0, 32);
    const tag = String(req.query.tag || '').slice(0, 64);
    const params = [req.user.id];
    let where = 'user_id = ?';
    if (category) {
      where += ' AND category_code = ?';
      params.push(category);
    }
    if (tag) {
      where += ' AND tag_name = ?';
      params.push(tag);
    }
    const [rows] = await pool.query(
      `SELECT id, title, model_code AS modelCode, category_code AS category, tag_name AS tag,
              design_json AS designJson, preview_key AS previewKey, created_at AS createdAt
       FROM works WHERE ${where} ORDER BY id DESC LIMIT 60`,
      params,
    );
    res.json({
      data: rows.map((row) => ({
        id: row.id,
        title: row.title,
        modelCode: row.modelCode,
        category: row.category,
        tag: row.tag,
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
    const category = await resolveCategory(modelCode, req.body?.categoryCode);
    const tag = await resolveTag(modelCode, req.body?.tagName);
    const [result] = await pool.execute(
      'INSERT INTO works (user_id, title, model_code, category_code, tag_name, design_json) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, title, modelCode, category, tag, JSON.stringify(design)],
    );
    const matched = preview.match(/^data:image\/jpeg;base64,(.+)$/);
    if (matched) {
      const key = `works/${req.user.id}/${result.insertId}.jpg`;
      await putObject(key, Buffer.from(matched[1], 'base64'), 'image/jpeg');
      await pool.execute('UPDATE works SET preview_key = ? WHERE id = ?', [key, result.insertId]);
    }
    res.json({ id: result.insertId, category });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ ok: false, message: '服务暂时不可用' });
});

Promise.all([ensureWorksCategory(), ensureLibrarySchema()]).then(() => {
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`api http://127.0.0.1:${config.port}`);
  });
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
