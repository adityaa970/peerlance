import { apiClient } from './api';

/**
 * Upload an image to Cloudinary using a signature from our backend.
 * Pass `authToken` when calling right after sign-up, before the app's normal
 * API token is available (see utils/idVerification.ts).
 */
export const uploadToCloudinary = async (imageUri: string, authToken?: string | null): Promise<string> => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const paramsToSign = {
      timestamp,
      folder: 'peerlance',
    };

    // Get signature from our backend
    const { data } = await apiClient.post(
      '/upload',
      { paramsToSign },
      authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : undefined
    );
    if (!data.signature) throw new Error('Failed to get signature');

    const formData = new FormData();
    // @ts-ignore - React Native FormData accepts an object with uri, type, name for files
    formData.append('file', {
      uri: imageUri,
      type: 'image/jpeg',
      name: `upload-${Date.now()}.jpg`,
    });
    formData.append('api_key', process.env.EXPO_PUBLIC_CLOUDINARY_API_KEY || '');
    formData.append('timestamp', String(timestamp));
    formData.append('signature', data.signature);
    formData.append('folder', 'peerlance');

    const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
    
    // Direct upload to Cloudinary using signed details
    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok || !uploadData.secure_url) {
      throw new Error(uploadData?.error?.message || 'Upload failed');
    }
    return uploadData.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
};
