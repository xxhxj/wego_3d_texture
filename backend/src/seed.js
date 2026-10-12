import mysql from 'mysql2/promise';
import { CATEGORIES, MODELS } from './catalog-data.js';
import { config } from './config.js';
import { pool } from './db.js';
import { coverKey, ensureBucket, putCover } from './storage.js';

const statements = [
  `CREATE TABLE IF NOT EXISTS categories (
    code VARCHAR(32) NOT NULL PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    sort_order INT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS models (
    code VARCHAR(64) NOT NULL PRIMARY KEY,
    category_code VARCHAR(32) NOT NULL,
    name VARCHAR(128) NOT NULL,
    kind VARCHAR(32) NOT NULL,
    width_mm INT NOT NULL,
    depth_mm INT NOT NULL,
    height_mm INT NOT NULL,
    fold_amount DECIMAL(4,2) NOT NULL,
    paper VARCHAR(32) NULL,
    profile VARCHAR(32) NULL,
    has_handle TINYINT(1) NOT NULL DEFAULT 0,
    tint VARCHAR(16) NULL,
    cover_key VARCHAR(255) NULL,
    sort_order INT NOT NULL,
    CONSTRAINT fk_models_category FOREIGN KEY (category_code) REFERENCES categories (code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

function coverSvg(model) {
  const tint = model.tint || '#f4f0e8';
  const kind = model.kind || 'box';
  const label = kind === 'bottle' || kind === 'can' || kind === 'cup' ? '瓶罐' : kind === 'pouch' ? '袋子' : '盒型';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">
  <rect width="480" height="320" fill="#f3f3f5"/>
  <rect x="150" y="70" width="180" height="160" rx="16" fill="${tint}" stroke="#d9d4cc"/>
  <text x="240" y="145" text-anchor="middle" font-family="Microsoft YaHei, sans-serif" font-size="22" fill="#5c5854">${label}</text>
  <text x="240" y="178" text-anchor="middle" font-family="Microsoft YaHei, sans-serif" font-size="20" fill="#2c2a28">${model.name}</text>
</svg>`;
}

async function ensureDatabase() {
  const connection = await mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    multipleStatements: true,
  });
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.mysql.database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await connection.end();
}

async function seed() {
  await ensureDatabase();
  for (const statement of statements) await pool.query(statement);
  for (const [index, category] of CATEGORIES.entries()) {
    await pool.execute(
      `INSERT INTO categories (code, name, sort_order) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order)`,
      [category.id, category.name, index],
    );
  }
  await ensureBucket();
  for (const [index, model] of MODELS.entries()) {
    const key = await putCover(model.id, coverSvg(model));
    await pool.execute(
      `INSERT INTO models (
         code, category_code, name, kind, width_mm, depth_mm, height_mm, fold_amount,
         paper, profile, has_handle, tint, cover_key, sort_order
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         category_code = VALUES(category_code),
         name = VALUES(name),
         kind = VALUES(kind),
         width_mm = VALUES(width_mm),
         depth_mm = VALUES(depth_mm),
         height_mm = VALUES(height_mm),
         fold_amount = VALUES(fold_amount),
         paper = VALUES(paper),
         profile = VALUES(profile),
         has_handle = VALUES(has_handle),
         tint = VALUES(tint),
         cover_key = VALUES(cover_key),
         sort_order = VALUES(sort_order)`,
      [
        model.id,
        model.category,
        model.name,
        model.kind || 'box',
        model.w,
        model.d,
        model.h,
        model.fold,
        model.paper || null,
        model.profile || null,
        model.handle ? 1 : 0,
        model.tint || null,
        key,
        index,
      ],
    );
  }
  console.log(`已写入 ${CATEGORIES.length} 个分类、${MODELS.length} 个样机，封面位于 ${coverKey('<code>')}`);
  await pool.end();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
