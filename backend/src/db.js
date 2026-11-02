import mysql from 'mysql2/promise';
import { config } from './config.js';

export const pool = mysql.createPool({
  host: config.mysql.host,
  port: config.mysql.port,
  user: config.mysql.user,
  password: config.mysql.password,
  database: config.mysql.database,
  waitForConnections: true,
  connectionLimit: 8,
  namedPlaceholders: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

pool.pool.on('connection', (connection) => {
  connection.on('error', (error) => {
    console.error('MySQL 连接中断', error.code || error.message);
  });
});

export async function ensureLibrarySchema() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS tags (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      category_code VARCHAR(32) NOT NULL,
      name VARCHAR(64) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      UNIQUE KEY uk_tags_category_name (category_code, name),
      CONSTRAINT fk_tags_category FOREIGN KEY (category_code) REFERENCES categories (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS model_uploads (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(64) NOT NULL,
      name VARCHAR(128) NOT NULL,
      category_code VARCHAR(32) NOT NULL,
      tag_id INT NOT NULL,
      file_key VARCHAR(255) NOT NULL,
      cover_key VARCHAR(255) NULL,
      width_mm INT NOT NULL,
      depth_mm INT NOT NULL,
      height_mm INT NOT NULL,
      created_by INT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_model_uploads_code (code),
      CONSTRAINT fk_uploads_category FOREIGN KEY (category_code) REFERENCES categories (code),
      CONSTRAINT fk_uploads_tag FOREIGN KEY (tag_id) REFERENCES tags (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  );
  await pool.query(
    `INSERT INTO tags (category_code, name, sort_order)
     SELECT category_code, tag_name, MIN(sort_order)
     FROM models
     WHERE tag_name IS NOT NULL AND tag_name <> ''
     GROUP BY category_code, tag_name
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
  );
}

export async function ensureShareSchema() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS shares (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      token VARCHAR(32) NOT NULL,
      user_id INT NOT NULL,
      title VARCHAR(128) NOT NULL,
      model_code VARCHAR(64) NOT NULL,
      design_json MEDIUMTEXT NOT NULL,
      faces_json MEDIUMTEXT NOT NULL,
      width_mm INT NOT NULL,
      height_mm INT NOT NULL,
      depth_mm INT NOT NULL,
      preview_key VARCHAR(255) NULL,
      remove_logo TINYINT NOT NULL DEFAULT 0,
      remove_watermark TINYINT NOT NULL DEFAULT 0,
      status TINYINT NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_shares_token (token),
      KEY idx_shares_user (user_id, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  );
}

export async function ensureWorksCategory() {
  for (const sql of [
    'ALTER TABLE works ADD COLUMN category_code VARCHAR(32) NULL',
    'ALTER TABLE works ADD COLUMN tag_name VARCHAR(64) NULL',
  ]) {
    try {
      await pool.query(sql);
    } catch (error) {
      if (error.errno !== 1060) throw error;
    }
  }
  await pool.query(
    `UPDATE works w
     LEFT JOIN models m ON w.model_code = m.code
     SET w.category_code = COALESCE(
       m.category_code,
       CASE JSON_UNQUOTE(JSON_EXTRACT(w.design_json, '$.kind'))
         WHEN 'box' THEN 'box'
         WHEN 'bottle' THEN 'bottle'
         WHEN 'can' THEN 'bottle'
         WHEN 'cup' THEN 'bottle'
         WHEN 'pouch' THEN 'bag'
         ELSE 'more'
       END
     )
     WHERE w.category_code IS NULL OR w.category_code = ''`,
  );
  await pool.query(
    `UPDATE works w
     JOIN models m ON w.model_code = m.code
     SET w.tag_name = m.tag_name
     WHERE (w.tag_name IS NULL OR w.tag_name = '') AND m.tag_name IS NOT NULL AND m.tag_name <> ''`,
  );
}
