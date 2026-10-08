import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

axios.defaults.withCredentials = true;

// Utility function to get a cookie value by name
export const getCookie = (name: string) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return null;
};

// Request interceptor to attach CSRF token to headers
axios.interceptors.request.use((config) => {
  const csrfToken = getCookie('csrf_token');
  if (csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

// Response interceptor to handle 401 Unauthorized (session expired)
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      setAuthToken(false);
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Since auth state is in an HttpOnly cookie, we'll store a simple flag to track if the user thinks they are logged in
export const setAuthToken = (isLoggedIn: boolean) => {
  if (isLoggedIn) {
    localStorage.setItem('isAuthenticated', 'true');
  } else {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('role');
    localStorage.removeItem('permissions');
    localStorage.removeItem('username');
    localStorage.removeItem('first_name');
    localStorage.removeItem('last_name');
    localStorage.removeItem('email');
    localStorage.removeItem('title');
    localStorage.removeItem('phone');
    localStorage.removeItem('address_line1');
    localStorage.removeItem('address_line2');
    localStorage.removeItem('city');
    localStorage.removeItem('state');
    localStorage.removeItem('postal_code');
    localStorage.removeItem('country');
  }
};

export const getAuthToken = () => localStorage.getItem('isAuthenticated');

// Logout function
export const logoutUser = async () => {
  try {
    await axios.post(`${API_URL}/auth/logout`);
  } catch (e) {}
  setAuthToken(false);
  window.location.href = '/login';
};

let refreshInterval: any = null;
export const startSessionRefresh = () => {
  if (refreshInterval) return;
  // Refresh every 5 minutes
  refreshInterval = setInterval(async () => {
    if (getAuthToken()) {
      try {
        await axios.post(`${API_URL}/auth/refresh`);
      } catch (e) {
        // Interceptor handles 401
      }
    }
  }, 5 * 60 * 1000);
};
