import axios, { AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3010/api/v1';

let api: AxiosInstance;

export function initializeApi(token?: string) {
  api = axios.create({
    baseURL: API_URL,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });

  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        const refreshToken = localStorage.getItem('refreshToken');

        if (refreshToken) {
          try {
            const response = await axios.post(`${API_URL}/auth/refresh`, {
              refreshToken,
            });

            localStorage.setItem('accessToken', response.data.accessToken);
            localStorage.setItem('refreshToken', response.data.refreshToken);

            api.defaults.headers.common['Authorization'] = `Bearer ${response.data.accessToken}`;
            originalRequest.headers['Authorization'] = `Bearer ${response.data.accessToken}`;

            return api(originalRequest);
          } catch (refreshError) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }
      }

      return Promise.reject(error);
    },
  );

  return api;
}

export function getApi() {
  if (!api) {
    initializeApi();
  }
  return api;
}

export const apiClient = {
  get: (url: string, config?: any) => getApi().get(url, config),
  post: (url: string, data?: any, config?: any) => getApi().post(url, data, config),
  put: (url: string, data?: any, config?: any) => getApi().put(url, data, config),
  patch: (url: string, data?: any, config?: any) => getApi().patch(url, data, config),
  delete: (url: string, config?: any) => getApi().delete(url, config),
};
