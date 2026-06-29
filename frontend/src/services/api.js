import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Auto-inject JWT token in request headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Auto-handle authentication failures
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token and redirect to login if token is invalid or expired
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      } else {
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
