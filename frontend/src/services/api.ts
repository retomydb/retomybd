import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Request interceptor - add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('retomy_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('retomy_refresh_token');

      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          localStorage.setItem('retomy_access_token', data.access_token);
          localStorage.setItem('retomy_refresh_token', data.refresh_token);
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
          return api(originalRequest);
        } catch {
          localStorage.removeItem('retomy_access_token');
          localStorage.removeItem('retomy_refresh_token');
          localStorage.removeItem('retomy_user');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// ============================================================================
// AUTH API
// ============================================================================
export const authApi = {
  signup: (data: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    display_name?: string;
    role?: string;
  }) => api.post('/auth/signup', data),

  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),

  refresh: (refresh_token: string) =>
    api.post('/auth/refresh', { refresh_token }),

  getMe: () => api.get('/auth/me'),

  logout: () => api.post('/auth/logout'),
};

// ============================================================================
// DATASETS API
// ============================================================================
export const datasetsApi = {
  search: (params: Record<string, any>) =>
    api.get('/datasets', { params }),

  getFeatured: () => api.get('/datasets/featured'),

  getCategories: () => api.get('/datasets/categories'),

  getDetail: (id: string) => api.get(`/datasets/${id}`),

  create: (data: any) => api.post('/datasets', data),

  uploadFile: (id: string, file: File, fileCategory: string = 'primary') => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/datasets/${id}/upload?file_category=${fileCategory}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // 2 min for large files
    });
  },

  getFiles: (id: string) => api.get(`/datasets/${id}/files`),

  deleteFile: (datasetId: string, fileId: string) =>
    api.delete(`/datasets/${datasetId}/files/${fileId}`),

  uploadThumbnail: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/datasets/${id}/thumbnail`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  publish: (id: string) => api.post(`/datasets/${id}/publish`),
  delete: (id: string) => api.delete(`/datasets/${id}`),

  submitReview: (id: string, data: { rating: number; title?: string; content?: string }) =>
    api.post(`/datasets/${id}/reviews`, data),

  toggleWishlist: (id: string) => api.post(`/datasets/${id}/wishlist`),
};

// ============================================================================
// PURCHASES API
// ============================================================================
export const purchasesApi = {
  purchase: (data: { dataset_id: string; payment_method?: string }) =>
    api.post('/purchases', data),

  getMyPurchases: (page = 1) =>
    api.get('/purchases/my-purchases', { params: { page } }),

  getDownloadUrl: (purchaseId: string) =>
    api.get(`/purchases/${purchaseId}/download`),

  downloadByDataset: (datasetId: string) =>
    api.get(`/purchases/download-by-dataset/${datasetId}`),

  getCart: () => api.get('/purchases/cart'),

  addToCart: (dataset_id: string) =>
    api.post('/purchases/cart', { dataset_id }),

  removeFromCart: (dataset_id: string) =>
    api.delete(`/purchases/cart/${dataset_id}`),
};

// ============================================================================
// PAYMENTS API (Stripe)
// ============================================================================
export const paymentsApi = {
  getConfig: () => api.get('/payments/config'),

  createCheckoutSession: (dataset_ids: string[]) =>
    api.post('/payments/create-checkout-session', { dataset_ids }),

  createSingleCheckout: (dataset_id: string) =>
    api.post('/payments/create-single-checkout', { dataset_id }),

  getCheckoutStatus: (sessionId: string) =>
    api.get(`/payments/checkout-status/${sessionId}`),

  // Stripe Connect (seller)
  startOnboarding: () => api.post('/payments/connect/onboard'),

  getConnectStatus: () => api.get('/payments/connect/status'),
};

// ============================================================================
// USERS API
// ============================================================================
export const usersApi = {
  updateProfile: (data: any) => api.put('/users/profile', data),

  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getPublicProfile: (userId: string) =>
    api.get(`/users/${userId}/public`),

  toggleFollow: (userId: string) =>
    api.post(`/users/${userId}/follow`),
};

// ============================================================================
// DASHBOARD API
// ============================================================================
export const dashboardApi = {
  getBuyerDashboard: () => api.get('/dashboard/buyer'),
  getSellerDashboard: () => api.get('/dashboard/seller'),
  getAdminDashboard: () => api.get('/dashboard/admin'),
  getNotifications: (page = 1) =>
    api.get('/dashboard/notifications', { params: { page } }),
  markNotificationsRead: (notificationId?: string) =>
    api.post('/dashboard/notifications/read', null, {
      params: { notification_id: notificationId },
    }),
  getPendingDatasets: () => api.get('/dashboard/admin/datasets/pending'),
  approveDataset: (id: string) =>
    api.post(`/dashboard/admin/datasets/${id}/approve`),
  rejectDataset: (id: string, reason: string) =>
    api.post(`/dashboard/admin/datasets/${id}/reject`, null, {
      params: { reason },
    }),
  getAdminUsers: (page = 1, role?: string) =>
    api.get('/dashboard/admin/users', { params: { page, role } }),
  suspendUser: (userId: string, suspended: boolean, reason?: string) =>
    api.post(`/dashboard/admin/users/${userId}/suspend`, null, {
      params: { suspended, ...(reason ? { reason } : {}) },
    }),
};

// ============================================================================
// REPOS / MODELS / SPACES / DISCUSSIONS / ORGS / COLLECTIONS API (Hub)
// ============================================================================
export const reposApi = {
  list: (params: Record<string, any>) => api.get('/repos', { params }),
  create: (data: any) => api.post('/repos', data),
  get: (owner: string, slug: string) => api.get(`/repos/${owner}/${slug}`),
  update: (repoId: string, data: any) => api.patch(`/repos/${repoId}`, data),
  delete: (repoId: string) => api.delete(`/repos/${repoId}`),
  tree: (repoId: string, branch = 'main') => api.get(`/repos/${repoId}/tree`, { params: { branch } }),
  uploadFile: (repoId: string, file: File, path: string, message = 'Upload file', branch = 'main') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('path', path);
    fd.append('message', message);
    fd.append('branch', branch);
    return api.post(`/repos/${repoId}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 });
  },
  downloadFile: (repoId: string, fileId: string) => api.get(`/repos/${repoId}/files/${fileId}/download`),
  toggleLike: (repoId: string) => api.post(`/repos/${repoId}/like`),
  commits: (repoId: string, branch = 'main', page = 1) => api.get(`/repos/${repoId}/commits`, { params: { branch, page } }),
};

export const modelsApi = {
  browse: (params: Record<string, any>) => api.get('/models', { params }),
  create: (params: Record<string, any>) => api.post('/models', null, { params }),
  get: (owner: string, slug: string) => api.get(`/models/${owner}/${slug}`),
  updateMetadata: (repoId: string, data: any) => api.patch(`/models/${repoId}/metadata`, data),
  updateUsageGuide: (repoId: string, usage_guide: string) => api.put(`/models/${repoId}/usage-guide`, { usage_guide }),
  githubPreview: (url: string) => api.get('/models/github/preview', { params: { url } }),
  githubSync: (repoId: string) => api.post(`/models/${repoId}/github-sync`),
  filterOptions: () => api.get('/models/filters/options'),
};

export const spacesApi = {
  browse: (params: Record<string, any>) => api.get('/spaces', { params }),
  create: (params: Record<string, any>) => api.post('/spaces', null, { params }),
  get: (owner: string, slug: string) => api.get(`/spaces/${owner}/${slug}`),
  updateMetadata: (repoId: string, data: any) => api.patch(`/spaces/${repoId}/metadata`, data),
  filterOptions: () => api.get('/spaces/filters/options'),
};

export const discussionsApi = {
  list: (repoId: string, params?: Record<string, any>) => api.get(`/discussions/repo/${repoId}`, { params }),
  create: (repoId: string, data: any, type = 'discussion') => api.post(`/discussions/repo/${repoId}?disc_type=${type}`, data),
  get: (discussionId: string) => api.get(`/discussions/${discussionId}`),
  addComment: (discussionId: string, data: { content: string }) => api.post(`/discussions/${discussionId}/comments`, data),
  updateStatus: (discussionId: string, newStatus: string) => api.patch(`/discussions/${discussionId}/status?new_status=${newStatus}`),
};

export const orgsApi = {
  list: (params?: Record<string, any>) => api.get('/organizations', { params }),
  create: (data: any) => api.post('/organizations', data),
  get: (slug: string) => api.get(`/organizations/${slug}`),
  update: (slug: string, data: any) => api.patch(`/organizations/${slug}`, data),
  addMember: (slug: string, data: { user_id: string; role?: string }) => api.post(`/organizations/${slug}/members`, data),
  removeMember: (slug: string, userId: string) => api.delete(`/organizations/${slug}/members/${userId}`),
};

export const collectionsApi = {
  list: (params?: Record<string, any>) => api.get('/collections', { params }),
  create: (data: any) => api.post('/collections', data),
  get: (id: string) => api.get(`/collections/${id}`),
  addItem: (id: string, data: { repo_id: string; note?: string }) => api.post(`/collections/${id}/items`, data),
  removeItem: (id: string, itemId: string) => api.delete(`/collections/${id}/items/${itemId}`),
  delete: (id: string) => api.delete(`/collections/${id}`),
};

/**
 * Safely extract a string error message from an Axios error.
 * FastAPI 422 responses return `detail` as an array of {type,loc,msg,input,ctx}
 * objects.  Passing that array directly to toast.error() / React crashes the app
 * because React cannot render plain objects.
 */
export function getApiError(e: any, fallback = 'Something went wrong'): string {
  const detail = e?.response?.data?.detail;
  if (!detail) return e?.message || fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: any) => (typeof d === 'string' ? d : d?.msg || JSON.stringify(d)))
      .join('; ');
  }
  if (typeof detail === 'object') return detail.msg || JSON.stringify(detail);
  return fallback;
}

export default api;
