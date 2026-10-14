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
