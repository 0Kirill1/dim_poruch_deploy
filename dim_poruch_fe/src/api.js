const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1').replace(/\/$/, '');
const ACCESS_KEY = 'dimporuch.accessToken';
const REFRESH_KEY = 'dimporuch.refreshToken';
let refreshPromise = null;

export const tokenStore = {
  get access() { return localStorage.getItem(ACCESS_KEY); },
  get refresh() { return localStorage.getItem(REFRESH_KEY); },
  set(access, refresh) {
    if (access) localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  constructor(message, { status, errors, data } = {}) {
    super(message || 'Сталася помилка. Спробуйте ще раз.');
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors || null;
    this.data = data;
  }
}

export function apiUrl(path = '') {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function notifySessionExpired() {
  tokenStore.clear();
  window.dispatchEvent(new CustomEvent('dimporuch:session-expired'));
}

async function refreshTokens() {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) throw new ApiError('Сесію завершено.', { status: 401 });
  const response = await fetch(apiUrl('/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.jwt_token || !data.refresh_token) {
    throw new ApiError(data.message || 'Не вдалося оновити сесію.', { status: response.status, data });
  }
  tokenStore.set(data.jwt_token, data.refresh_token);
}

async function decodeResponse(response, responseType) {
  if (responseType === 'blob') return response.blob();
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

export async function apiRequest(path, options = {}) {
  const {
    auth = true,
    responseType = 'json',
    retry = true,
    headers: inputHeaders,
    body: inputBody,
    ...fetchOptions
  } = options;
  const headers = new Headers(inputHeaders || {});
  let body = inputBody;
  if (body !== undefined && body !== null && !(body instanceof FormData) && typeof body !== 'string' && !(body instanceof Blob)) {
    body = JSON.stringify(body);
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  }
  if (auth && tokenStore.access) headers.set('Authorization', `Bearer ${tokenStore.access}`);
  const response = await fetch(apiUrl(path), { ...fetchOptions, headers, body });

  if (response.status === 401 && auth && retry && path !== '/auth/refresh') {
    try {
      if (!refreshPromise) refreshPromise = refreshTokens().finally(() => { refreshPromise = null; });
      await refreshPromise;
      return apiRequest(path, { ...options, retry: false });
    } catch (error) {
      notifySessionExpired();
      throw new ApiError(error.message || 'Сесію завершено. Увійдіть знову.', { status: 401 });
    }
  }

  const data = await decodeResponse(response, responseType);
  if (!response.ok) {
    const message = data?.message || (response.status === 401 ? 'Невірна електронна пошта або пароль.' : `Помилка запиту (${response.status}).`);
    throw new ApiError(message, { status: response.status, errors: data?.errors, data });
  }
  return data;
}

export function toPage(data) {
  if (Array.isArray(data)) return { content: data, totalElements: data.length, totalPages: 1, number: 0, first: true, last: true };
  return data || { content: [], totalElements: 0, totalPages: 0, number: 0, first: true, last: true };
}

export function formatApiError(error) {
  if (error?.status === 403) return 'У вас немає прав для цієї дії.';
  if (error?.status === 409) return 'Ця адреса електронної пошти вже зареєстрована.';
  return error?.message || 'Сталася помилка. Спробуйте ще раз.';
}

export function formatPrice(value) {
  if (value === null || value === undefined || value === '') return '—';
  return `${new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 0 }).format(Number(value))} ₴`;
}

export function imageUrl(path) {
  return path ? apiUrl(path) : '';
}

export function notifyNotificationsChanged() {
  window.dispatchEvent(new CustomEvent('dimporuch:notifications-changed'));
}
