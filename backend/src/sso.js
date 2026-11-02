import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { pool } from './db.js';

const ssoDatabase = /^[A-Za-z0-9_]+$/.test(config.ssoDatabase) ? config.ssoDatabase : 'wego_sso';
const APP_AUDIENCE = 'wego-mockup';

let keyCache = { pem: '', kid: '', fetchedAt: 0 };

async function ssoPublicKey(force = false) {
  const now = Date.now();
  if (!force && keyCache.pem && now - keyCache.fetchedAt < 5 * 60 * 1000) return keyCache;
  let response;
  try {
    response = await fetch(`${config.ssoApi}/api/auth/public-key`);
  } catch {
    if (keyCache.pem) return keyCache;
    const error = new Error('认证服务不可用');
    error.status = 503;
    throw error;
  }
  if (!response.ok) {
    if (keyCache.pem) return keyCache;
    const error = new Error('获取 SSO 公钥失败');
    error.status = 503;
    throw error;
  }
  const data = await response.json();
  if (!data.publicKey) {
    if (keyCache.pem) return keyCache;
    const error = new Error('SSO 公钥格式不正确');
    error.status = 503;
    throw error;
  }
  keyCache = { pem: data.publicKey, kid: data.kid || '', fetchedAt: now };
  return keyCache;
}

async function verifySsoToken(token, audience) {
  const key = await ssoPublicKey();
  try {
    return jwt.verify(token, key.pem, {
      algorithms: ['RS256'],
      issuer: 'wego-sso',
      audience,
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' && /invalid signature/i.test(error.message)) {
      const fresh = await ssoPublicKey(true);
      return jwt.verify(token, fresh.pem, {
        algorithms: ['RS256'],
        issuer: 'wego-sso',
        audience,
      });
    }
    throw error;
  }
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ message: '未登录' });
  try {
    req.user = await verifySsoToken(token, APP_AUDIENCE);
    next();
  } catch (error) {
    if (error.status === 503) {
      return res.status(503).json({ message: '认证服务暂时不可用，请稍后再试' });
    }
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
