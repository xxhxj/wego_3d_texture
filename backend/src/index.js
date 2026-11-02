import crypto from 'node:crypto';
import express from 'express';
import { config } from './config.js';
import { ensureShareSchema, ensureWorksCategory, pool } from './db.js';
import { requireAuth } from './sso.js';
import { coverUrl, minio, putObject } from './storage.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16mb' }));
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
    res.setHeader('Cache-Control', 'no-store');
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

const SHARE_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const FACE_KEYS = ['front', 'back', 'left', 'right', 'top', 'bottom'];

function randomShareToken() {
  let token = '';
  for (let index = 0; index < 10; index += 1) {
    token += SHARE_ALPHABET[crypto.randomInt(SHARE_ALPHABET.length)];
  }
  return token;
}

function safeImageDataUrl(value) {
  const text = String(value || '');
  return /^data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(text) ? text : '';
}

function normalizeFaces(input) {
  const source = input && typeof input === 'object' ? input : {};
  const faces = {};
  for (const key of FACE_KEYS) faces[key] = safeImageDataUrl(source[key]);
  const fallback = faces.front || faces.back || faces.left || faces.right || faces.top || faces.bottom;
  if (!fallback) return null;
  for (const key of FACE_KEYS) {
    if (!faces[key]) faces[key] = fallback;
  }
  return faces;
}

function parseJson(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function newShareToken() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const token = randomShareToken();
    const [rows] = await pool.query('SELECT 1 FROM shares WHERE token = ? LIMIT 1', [token]);
    if (!rows[0]) return token;
  }
  return null;
}

app.post('/api/shares', requireAuth, async (req, res, next) => {
  try {
    const design = req.body?.design;
    if (!design || typeof design !== 'object') {
      return res.status(400).json({ message: '缺少设计数据' });
    }
    const width = Math.round(Number(design.w));
    const height = Math.round(Number(design.h));
    const depth = Math.round(Number(design.d));
    if (![width, height, depth].every((value) => Number.isFinite(value) && value > 0 && value <= 2000)) {
      return res.status(400).json({ message: '样机尺寸不合法' });
    }
    const faces = normalizeFaces(req.body?.faces);
    if (!faces) return res.status(400).json({ message: '缺少样机面贴图' });

    const token = await newShareToken();
    if (!token) return res.status(500).json({ message: '生成分享链接失败，请重试' });

    const title = String(req.body?.title || '未命名样机').slice(0, 128);
    const modelCode = String(req.body?.modelCode || design.modelCode || '').slice(0, 64);
    const removeLogo = req.body?.removeLogo ? 1 : 0;
    const removeWatermark = req.body?.removeWatermark ? 1 : 0;

    const [result] = await pool.execute(
      `INSERT INTO shares
       (token, user_id, title, model_code, design_json, faces_json, width_mm, height_mm, depth_mm,
        remove_logo, remove_watermark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        token,
        req.user.id,
        title,
        modelCode,
        JSON.stringify(design),
        JSON.stringify(faces),
        width,
        height,
        depth,
        removeLogo,
        removeWatermark,
      ],
    );

    const preview = safeImageDataUrl(req.body?.preview);
    const jpeg = /^data:image\/jpeg;base64,(.+)$/.exec(preview);
    if (jpeg) {
      const key = `shares/${req.user.id}/${token}.jpg`;
      await putObject(key, Buffer.from(jpeg[1], 'base64'), 'image/jpeg');
      await pool.execute('UPDATE shares SET preview_key = ? WHERE id = ?', [key, result.insertId]);
    }

    res.json({ data: { token, path: `/share?filter_url=${token}` } });
  } catch (error) {
    next(error);
  }
});

app.get('/api/shares/:token', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.token, s.title, s.model_code, s.faces_json, s.width_mm, s.height_mm, s.depth_mm,
              s.preview_key, s.remove_logo, s.remove_watermark, s.status, s.created_at,
              COALESCE(m.kind, 'box') AS model_kind
       FROM shares s
       LEFT JOIN models m ON m.code = s.model_code
       WHERE s.token = ? LIMIT 1`,
      [req.params.token],
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ message: '分享不存在' });
    if (row.status !== 1) return res.status(410).json({ message: '分享已停止' });
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex');
    res.json({
      data: {
        token: row.token,
        title: row.title,
        modelCode: row.model_code,
        kind: row.model_kind || 'box',
        width: Number(row.width_mm),
        height: Number(row.height_mm),
        depth: Number(row.depth_mm),
        faces: parseJson(row.faces_json, {}),
        previewUrl: coverUrl(row.preview_key),
        removeLogo: Boolean(row.remove_logo),
        removeWatermark: Boolean(row.remove_watermark),
        createdAt: row.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/shares/:token', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, remove_logo, remove_watermark FROM shares WHERE token = ? AND user_id = ? LIMIT 1',
      [req.params.token, req.user.id],
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ message: '分享不存在' });
    const removeLogo = req.body?.removeLogo === undefined ? row.remove_logo : (req.body.removeLogo ? 1 : 0);
    const removeWatermark = req.body?.removeWatermark === undefined
      ? row.remove_watermark
      : (req.body.removeWatermark ? 1 : 0);
    await pool.execute(
      'UPDATE shares SET remove_logo = ?, remove_watermark = ? WHERE id = ?',
      [removeLogo, removeWatermark, row.id],
    );
    res.json({
      data: { removeLogo: Boolean(removeLogo), removeWatermark: Boolean(removeWatermark) },
    });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/shares/:token', requireAuth, async (req, res, next) => {
  try {
    const [result] = await pool.execute(
      'UPDATE shares SET status = 0 WHERE token = ? AND user_id = ? AND status = 1',
      [req.params.token, req.user.id],
    );
    if (!result.affectedRows) return res.status(404).json({ message: '分享不存在或已停止' });
    res.json({ data: { stopped: true } });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ ok: false, message: '服务暂时不可用' });
});

ensureWorksCategory()
  .then(() => ensureShareSchema())
  .then(() => {
    app.listen(config.port, '0.0.0.0', () => {
      console.log(`api http://127.0.0.1:${config.port}`);
    });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
