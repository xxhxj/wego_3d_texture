import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { pool } from './db.js';

const ssoDatabase = /^[A-Za-z0-9_]+$/.test(config.ssoDatabase) ? config.ssoDatabase : 'wego_sso';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ message: '未登录' });
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    res.status(401).json({ message: '登录已过期' });
  }
}

export async function requireUpload(req, res, next) {
  try {
    const [admin] = await pool.query(
      `SELECT 1
       FROM \`${ssoDatabase}\`.sys_user_role ur
       JOIN \`${ssoDatabase}\`.sys_role r ON r.id = ur.role_id
       WHERE ur.user_id = ? AND r.code = 'admin' AND r.status = 1
       LIMIT 1`,
      [req.user.id],
    );
    if (admin.length) return next();
    const [rows] = await pool.query(
      `SELECT 1
       FROM \`${ssoDatabase}\`.sys_user_role ur
       JOIN \`${ssoDatabase}\`.sys_role_menu rm ON rm.role_id = ur.role_id
       JOIN \`${ssoDatabase}\`.sys_menu m ON m.id = rm.menu_id
       WHERE ur.user_id = ? AND m.permission = 'mockup:upload' AND m.status = 1
       LIMIT 1`,
      [req.user.id],
    );
    if (rows.length) return next();
    res.status(403).json({ message: '没有上传权限' });
  } catch (error) {
    next(error);
  }
}
