import { Router } from 'express';
import multer from 'multer';
import { pool } from './db.js';
import { requireAuth, requireUpload } from './sso.js';
import { config } from './config.js';
import { coverUrl, minio, putObject, removeObject } from './storage.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 32 * 1024 * 1024 },
});

export const libraryRouter = Router();
libraryRouter.use(requireAuth);

function codeFor(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function cleanName(value, max) {
  return String(value || '').trim().slice(0, max);
}

function dimension(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(2000, Math.max(10, Math.round(number)));
}

function isGlb(buffer) {
  return buffer.length > 20 && buffer.toString('ascii', 0, 4) === 'glTF' && buffer.readUInt32LE(4) === 2;
}

function coverSvg(name) {
  const label = name.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
  <rect width="320" height="320" rx="28" fill="#f4f1ea"/>
  <path d="M160 78 236 118v84L160 242 84 202v-84L160 78Z" fill="#fff" stroke="#d9d3c8" stroke-width="3"/>
  <path d="M160 118v124M160 118 84 78M160 118l76-40" fill="none" stroke="#c8c0b4" stroke-width="3"/>
  <rect x="84" y="168" width="152" height="22" fill="#7b61ff"/>
  <text x="160" y="278" text-anchor="middle" font-family="Microsoft YaHei, sans-serif" font-size="22" fill="#3a3835">${label}</text>
</svg>`;
}

export function mapUpload(row) {
  return {
    id: row.code,
    category: row.category_code,
    name: row.name,
    kind: 'mesh',
    w: row.width_mm,
    d: row.depth_mm,
    h: row.height_mm,
    fold: 1,
    tint: '#f4f0e8',
    tag: row.tag_name,
    memberOnly: false,
    coverUrl: coverUrl(row.cover_key),
    modelUrl: `/api/library/files/${row.code}`,
  };
}

export async function listUploadedModels() {
  const [rows] = await pool.query(
    `SELECT u.code, u.name, u.category_code, u.file_key, u.cover_key,
            u.width_mm, u.depth_mm, u.height_mm, t.name AS tag_name
     FROM model_uploads u
     JOIN tags t ON t.id = u.tag_id
     ORDER BY u.id DESC`,
  );
  return rows;
}

libraryRouter.get('/taxonomy', async (_req, res, next) => {
  try {
    const [categories] = await pool.query('SELECT code, name FROM categories ORDER BY sort_order, code');
    const [tags] = await pool.query(
      'SELECT id, category_code AS categoryId, name FROM tags ORDER BY sort_order, id',
    );
    res.json({
      categories: categories.map((item) => ({ id: item.code, name: item.name })),
      tags,
    });
  } catch (error) {
    next(error);
  }
});

libraryRouter.post('/categories', requireUpload, async (req, res, next) => {
  const name = cleanName(req.body?.name, 64);
  if (!name) return res.status(400).json({ message: '请填写大类名称' });
  try {
    const [existing] = await pool.query('SELECT code FROM categories WHERE name = ? LIMIT 1', [name]);
    if (existing[0]) return res.status(409).json({ message: '这个大类已经有了', id: existing[0].code });
    const [order] = await pool.query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS sortOrder FROM categories');
    const code = codeFor('cat');
    await pool.execute(
      'INSERT INTO categories (code, name, sort_order) VALUES (?, ?, ?)',
      [code, name, order[0].sortOrder],
    );
    res.json({ id: code, name });
  } catch (error) {
    next(error);
  }
});

libraryRouter.post('/tags', requireUpload, async (req, res, next) => {
  const name = cleanName(req.body?.name, 64);
  const categoryCode = cleanName(req.body?.categoryCode, 32);
  if (!name || !categoryCode) return res.status(400).json({ message: '请选择大类并填写标签' });
  try {
    const [category] = await pool.query('SELECT code FROM categories WHERE code = ? LIMIT 1', [categoryCode]);
    if (!category[0]) return res.status(404).json({ message: '大类不存在' });
    const [existing] = await pool.query(
      'SELECT id FROM tags WHERE category_code = ? AND name = ? LIMIT 1',
      [categoryCode, name],
    );
    if (existing[0]) return res.status(409).json({ message: '这个标签已经有了', id: existing[0].id });
    const [order] = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS sortOrder FROM tags WHERE category_code = ?',
      [categoryCode],
    );
    const [result] = await pool.execute(
      'INSERT INTO tags (category_code, name, sort_order) VALUES (?, ?, ?)',
      [categoryCode, name, order[0].sortOrder],
    );
    res.json({ id: result.insertId, categoryId: categoryCode, name });
  } catch (error) {
    next(error);
  }
});

libraryRouter.get('/models', requireUpload, async (_req, res, next) => {
  try {
    const rows = await listUploadedModels();
    res.json({ data: rows.map(mapUpload) });
  } catch (error) {
    next(error);
  }
});

libraryRouter.post('/models', requireUpload, (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (error) return res.status(400).json({ message: '文件不能超过 32MB' });
    next();
  });
}, async (req, res, next) => {
  const name = cleanName(req.body?.name, 128);
  const categoryCode = cleanName(req.body?.categoryCode, 32);
  const tagId = Number(req.body?.tagId);
  const file = req.file;
  if (!name) return res.status(400).json({ message: '请填写模型名称' });
  if (!categoryCode || !tagId) return res.status(400).json({ message: '请选择大类和标签' });
  if (!file) return res.status(400).json({ message: '请选择 GLB 文件' });
  if (!isGlb(file.buffer)) return res.status(400).json({ message: '只接受 GLB 模型文件' });
  try {
    const [tags] = await pool.query(
      'SELECT id, name FROM tags WHERE id = ? AND category_code = ? LIMIT 1',
      [tagId, categoryCode],
    );
    if (!tags[0]) return res.status(400).json({ message: '标签不属于这个大类' });
    const code = codeFor('upl');
    const fileKey = `models/${code}.glb`;
    const coverKey = `covers/${code}.svg`;
    await putObject(fileKey, file.buffer, 'model/gltf-binary');
    await putObject(coverKey, Buffer.from(coverSvg(name)), 'image/svg+xml; charset=utf-8');
    await pool.execute(
      `INSERT INTO model_uploads
       (code, name, category_code, tag_id, file_key, cover_key, width_mm, depth_mm, height_mm, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code,
        name,
        categoryCode,
        tagId,
        fileKey,
        coverKey,
        dimension(req.body?.width, 120),
        dimension(req.body?.depth, 80),
        dimension(req.body?.height, 160),
        req.user.id,
      ],
    );
    const [rows] = await pool.query(
      `SELECT u.code, u.name, u.category_code, u.file_key, u.cover_key,
              u.width_mm, u.depth_mm, u.height_mm, t.name AS tag_name
       FROM model_uploads u
       JOIN tags t ON t.id = u.tag_id
       WHERE u.code = ?`,
      [code],
    );
    res.json(mapUpload(rows[0]));
  } catch (error) {
    next(error);
  }
});

libraryRouter.delete('/models/:code', requireUpload, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT file_key, cover_key FROM model_uploads WHERE code = ? LIMIT 1',
      [req.params.code],
    );
    if (!rows[0]) return res.status(404).json({ message: '没有这个模型' });
    await pool.execute('DELETE FROM model_uploads WHERE code = ?', [req.params.code]);
    await removeObject(rows[0].file_key).catch(() => {});
    await removeObject(rows[0].cover_key).catch(() => {});
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

libraryRouter.get('/files/:code', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT file_key FROM model_uploads WHERE code = ? LIMIT 1',
      [req.params.code],
    );
    if (!rows[0]) return res.status(404).json({ message: '没有这个模型' });
    const stream = await minio.getObject(config.minio.bucket, rows[0].file_key);
    res.setHeader('Content-Type', 'model/gltf-binary');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
});
