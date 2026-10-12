import dotenv from 'dotenv';

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT || 3000),
  mysql: {
    host: required('MYSQL_HOST'),
    port: Number(required('MYSQL_PORT')),
    user: required('MYSQL_USER'),
    password: required('MYSQL_PASSWORD'),
    database: required('MYSQL_DATABASE'),
  },
  minio: {
    endPoint: required('MINIO_ENDPOINT'),
    port: Number(required('MINIO_PORT')),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: required('MINIO_ACCESS_KEY'),
    secretKey: required('MINIO_SECRET_KEY'),
    bucket: required('MINIO_BUCKET'),
    publicBase: required('MINIO_PUBLIC_BASE').replace(/\/$/, ''),
  },
};
