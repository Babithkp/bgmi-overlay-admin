import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.CLOUDFLARE_REGION || 'auto',
  endpoint: process.env.CLOUDFLARE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.CLOUDFLARE_S3_BUCKET_NAME!;

export async function uploadToS3(file: Buffer, key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
  });

  await s3Client.send(command);
  return `https://storage.trikonatech.com/${key}`;
}

export async function deleteFromS3(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

export function extractS3Key(url: string): string | null {
  if (!url) return null;


  if (url.startsWith('s3://')) {
    // If it's already an s3:// URL, extract the key part
    const parts = url.replace('s3://', '').split('/');
    if (parts.length > 1) {
      return parts.slice(1).join('/');
    }
    return null;
  }

  // Extract key from https URL
  const match = url.match(/https?:\/\/[^\/]+\/(.+)/);
  if (match && match[1]) {
    // Remove query parameters if any
    return match[1].split('?')[0];
  }

  // If it doesn't match URL pattern, assume it's already a key
  return url;
}
