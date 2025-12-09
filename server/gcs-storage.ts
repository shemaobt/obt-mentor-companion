/**
 * Google Cloud Storage Service
 * 
 * Handles file uploads to GCS for persistent storage of:
 * - Profile images
 * - Documents
 * - Certificates
 */

import { Storage } from '@google-cloud/storage';
import path from 'path';

// Initialize GCS client
const storage = new Storage();

// Get bucket name from environment
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'obt-mentor-uploads';

/**
 * Get the GCS bucket
 */
function getBucket() {
  return storage.bucket(BUCKET_NAME);
}

/**
 * Upload a file to GCS
 * @param buffer - File buffer to upload
 * @param filename - Original filename
 * @param folder - Folder in the bucket (e.g., 'profile-images', 'documents', 'certificates')
 * @param contentType - MIME type of the file
 * @returns Public URL of the uploaded file
 */
export async function uploadToGCS(
  buffer: Buffer,
  filename: string,
  folder: string,
  contentType: string
): Promise<string> {
  const bucket = getBucket();
  
  // Generate unique filename
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const ext = path.extname(filename);
  const uniqueFilename = `${folder}/${uniqueSuffix}${ext}`;
  
  const file = bucket.file(uniqueFilename);
  
  // Upload the file
  await file.save(buffer, {
    metadata: {
      contentType,
    },
    resumable: false,
  });
  
  // Make the file publicly accessible
  await file.makePublic();
  
  // Return the public URL
  const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${uniqueFilename}`;
  
  console.log(`[GCS] Uploaded file to: ${publicUrl}`);
  
  return publicUrl;
}

/**
 * Upload a file from disk to GCS (for multer disk storage files)
 * @param filePath - Local file path
 * @param folder - Folder in the bucket
 * @param contentType - MIME type of the file
 * @returns Public URL of the uploaded file
 */
export async function uploadFileToGCS(
  filePath: string,
  folder: string,
  contentType: string
): Promise<string> {
  const bucket = getBucket();
  
  // Generate unique filename
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const ext = path.extname(filePath);
  const uniqueFilename = `${folder}/${uniqueSuffix}${ext}`;
  
  // Upload the file
  await bucket.upload(filePath, {
    destination: uniqueFilename,
    metadata: {
      contentType,
    },
  });
  
  // Make the file publicly accessible
  const file = bucket.file(uniqueFilename);
  await file.makePublic();
  
  // Return the public URL
  const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${uniqueFilename}`;
  
  console.log(`[GCS] Uploaded file to: ${publicUrl}`);
  
  return publicUrl;
}

/**
 * Delete a file from GCS
 * @param fileUrl - Full URL or path of the file to delete
 */
export async function deleteFromGCS(fileUrl: string): Promise<void> {
  try {
    const bucket = getBucket();
    
    // Extract filename from URL
    let filename: string;
    if (fileUrl.startsWith('https://storage.googleapis.com/')) {
      // Full URL format: https://storage.googleapis.com/bucket-name/folder/filename
      const urlPath = fileUrl.replace(`https://storage.googleapis.com/${BUCKET_NAME}/`, '');
      filename = urlPath;
    } else if (fileUrl.startsWith('/uploads/')) {
      // Legacy local path format - shouldn't happen but handle gracefully
      console.log(`[GCS] Skipping delete for local path: ${fileUrl}`);
      return;
    } else {
      filename = fileUrl;
    }
    
    const file = bucket.file(filename);
    
    // Check if file exists before deleting
    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
      console.log(`[GCS] Deleted file: ${filename}`);
    } else {
      console.log(`[GCS] File not found for deletion: ${filename}`);
    }
  } catch (error) {
    console.error(`[GCS] Error deleting file:`, error);
    // Don't throw - deletion failures shouldn't break the app
  }
}

/**
 * Check if GCS is properly configured
 */
export async function isGCSConfigured(): Promise<boolean> {
  try {
    const bucket = getBucket();
    const [exists] = await bucket.exists();
    return exists;
  } catch (error) {
    console.error('[GCS] Storage not configured:', error);
    return false;
  }
}

/**
 * Get the bucket name being used
 */
export function getGCSBucketName(): string {
  return BUCKET_NAME;
}
