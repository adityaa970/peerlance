import { apiClient } from './api';
import { uploadToCloudinary } from './upload';

export type IdVerificationResult =
  | { passed: true; idCardUrl: string }
  | { passed: false; reason: string };

/**
 * Upload a college ID photo and run the backend's AI check on it.
 *
 * The backend uses the signed-in user's email, so this must run while signed in.
 * Pass `authToken` when the app's API client doesn't have a token yet (right after
 * sign-up, inside Clerk's `navigate` callback).
 *
 * Throws on network/upload errors; returns `{ passed: false }` when the AI rejects the ID.
 */
export async function verifyIdCard(imageUri: string, authToken?: string | null): Promise<IdVerificationResult> {
  const idCardUrl = await uploadToCloudinary(imageUri, authToken);

  const { data } = await apiClient.post(
    '/verify-id',
    { idCardUrl },
    authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : undefined
  );

  if (data?.status === 'REJECTED') {
    return {
      passed: false,
      reason: data.analysis?.reasoning || 'The uploaded image did not pass our AI verification.',
    };
  }

  return { passed: true, idCardUrl };
}
