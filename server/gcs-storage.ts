import { Storage } from "@google-cloud/storage";
import path from "path";

const storage = new Storage();

const BUCKET_NAME = process.env.GCS_BUCKET_NAME || "obt-mentor-uploads";

function getBucket() {
  return storage.bucket(BUCKET_NAME);
}

export async function uploadToGCS(
  buffer: Buffer,
  filename: string,
  folder: string,
  contentType: string
): Promise<string> {
  const bucket = getBucket();

  const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  const ext = path.extname(filename);
  const uniqueFilename = `${folder}/${uniqueSuffix}${ext}`;

  const file = bucket.file(uniqueFilename);

  await file.save(buffer, {
    metadata: {
      contentType,
    },
    resumable: false,
  });

  await file.makePublic();

  const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${uniqueFilename}`;

  console.log(`[GCS] Uploaded file to: ${publicUrl}`);

  return publicUrl;
}

export async function uploadFileToGCS(filePath: string, folder: string, contentType: string): Promise<string> {
  const bucket = getBucket();

  const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  const ext = path.extname(filePath);
  const uniqueFilename = `${folder}/${uniqueSuffix}${ext}`;

  await bucket.upload(filePath, {
    destination: uniqueFilename,
    metadata: {
      contentType,
    },
  });

  const file = bucket.file(uniqueFilename);
  await file.makePublic();

  const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${uniqueFilename}`;

  console.log(`[GCS] Uploaded file to: ${publicUrl}`);

  return publicUrl;
}

export async function deleteFromGCS(fileUrl: string): Promise<void> {
  try {
    const bucket = getBucket();

    let filename: string;
    if (fileUrl.startsWith("https://storage.googleapis.com/")) {
      const urlPath = fileUrl.replace(`https://storage.googleapis.com/${BUCKET_NAME}/`, "");
      filename = urlPath;
    } else if (fileUrl.startsWith("/uploads/")) {
      console.log(`[GCS] Skipping delete for local path: ${fileUrl}`);
      return;
    } else {
      filename = fileUrl;
    }

    const file = bucket.file(filename);

    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
      console.log(`[GCS] Deleted file: ${filename}`);
    } else {
      console.log(`[GCS] File not found for deletion: ${filename}`);
    }
  } catch (error) {
    console.error(`[GCS] Error deleting file:`, error);
  }
}

export async function isGCSConfigured(): Promise<boolean> {
  try {
    const bucket = getBucket();
    const [exists] = await bucket.exists();
    return exists;
  } catch (error) {
    console.error("[GCS] Storage not configured:", error);
    return false;
  }
}

export function getGCSBucketName(): string {
  return BUCKET_NAME;
}
