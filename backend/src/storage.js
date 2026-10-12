import * as Minio from 'minio';
import { config } from './config.js';

export const minio = new Minio.Client({
  endPoint: config.minio.endPoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

const publicReadPolicy = JSON.stringify({
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Principal: { AWS: ['*'] },
      Action: ['s3:GetObject'],
      Resource: [`arn:aws:s3:::${config.minio.bucket}/*`],
    },
  ],
});

export async function ensureBucket() {
  const exists = await minio.bucketExists(config.minio.bucket);
  if (!exists) await minio.makeBucket(config.minio.bucket);
  await minio.setBucketPolicy(config.minio.bucket, publicReadPolicy);
}

export function coverKey(code) {
  return `covers/${code}.svg`;
}

export function coverUrl(key) {
  if (!key) return '';
  return `${config.minio.publicBase}/${key}`;
}

export async function putCover(code, svg) {
  const key = coverKey(code);
  const body = Buffer.from(svg);
  await minio.putObject(config.minio.bucket, key, body, body.length, {
    'Content-Type': 'image/svg+xml; charset=utf-8',
  });
  return key;
}
