import mysql from 'mysql2/promise';
import { CATEGORIES, MODELS } from './catalog-data.js';
import { config } from './config.js';
import { pool } from './db.js';
import { artSvg, coverSvg } from './artwork.js';
import { artKey, coverKey, ensureBucket, putCover, putObject } from './storage.js';

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
    tag_name VARCHAR(64) NULL,
    member_only TINYINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_models_category FOREIGN KEY (category_code) REFERENCES categories (code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS works (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(128) NOT NULL,
    model_code VARCHAR(64) NOT NULL,
    design_json MEDIUMTEXT NOT NULL,
    preview_key VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_works_user (user_id, id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

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
  for (const sql of [
    'ALTER TABLE models ADD COLUMN tag_name VARCHAR(64) NULL',
    'ALTER TABLE models ADD COLUMN member_only TINYINT NOT NULL DEFAULT 0',
    'ALTER TABLE models ADD COLUMN art_key VARCHAR(255) NULL',
  ]) {
    try {
      await pool.query(sql);
    } catch (error) {
      if (error.errno !== 1060) throw error;
    }
  }
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
    const artwork = await putObject(artKey(model.id), Buffer.from(artSvg(model)), 'image/svg+xml; charset=utf-8');
    await pool.execute(
      `INSERT INTO models (
         code, category_code, name, kind, width_mm, depth_mm, height_mm, fold_amount,
         paper, profile, has_handle, tint, cover_key, sort_order, tag_name, member_only, art_key
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
         sort_order = VALUES(sort_order),
         tag_name = VALUES(tag_name),
         member_only = VALUES(member_only),
         art_key = VALUES(art_key)`,
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
        model.tag,
        model.member ? 1 : 0,
        artwork,
      ],
    );
  }
  const codes = MODELS.map((model) => model.id);
  await pool.query(
    `DELETE FROM models WHERE code NOT IN (${codes.map(() => '?').join(',')})`,
    codes,
  );
  console.log(`已写入 ${CATEGORIES.length} 个分类、${MODELS.length} 个样机，封面位于 ${coverKey('<code>')}`);
  await pool.end();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
