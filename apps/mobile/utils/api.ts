import axios from 'axios';

// Ensure this matches your Next.js backend URL locally or in prod
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000, // 10 seconds timeout for all API requests
});

let isInterceptorSetup = false;

export const setupApiClient = (getToken: () => Promise<string | null>) => {
  if (isInterceptorSetup) return;
  isInterceptorSetup = true;

  apiClient.interceptors.request.use(async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      // Handle network errors and timeouts globally so UI can depend on it
      let customMessage = 'An unexpected error occurred';
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        customMessage = 'The connection timed out. Please try again.';
      } else if (!error.response) {
        // If the error message is descriptive (not just "Network Error"), use it
        const isGeneric = !error.message || 
                         error.message.toLowerCase() === 'network error' || 
                         error.message.toLowerCase().includes('failed with status');
        
        customMessage = isGeneric ? 'Network error. Please check your internet connection.' : error.message;
        console.error('[API] Network Error (No Response):', error.message);
      } else {
        // Detailed log for developers
        console.warn(`[API] Error ${error.response.status}:`, error.response.data);
        
        // Many APIs use .error or .message; support both
        customMessage = error.response.data?.error || error.response.data?.message || customMessage;
      }
      return Promise.reject(new Error(customMessage));
    }
  );
};
