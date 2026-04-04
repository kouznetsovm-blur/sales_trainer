export function getToken() {
  return localStorage.getItem('zori_token');
}

export function getUser() {
  const stored = localStorage.getItem('zori_user');
  if (!stored) return null;
  try { return JSON.parse(stored); } catch { return null; }
}

export function saveAuth(token, user) {
  localStorage.setItem('zori_token', token);
  localStorage.setItem('zori_user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('zori_token');
  localStorage.removeItem('zori_user');
}

// silent: true — не выбрасывать пользователя при ошибке (для фоновых сохранений)
export async function authFetch(url, options = {}) {
  const { silent = false, ...fetchOptions } = options;
  const token = getToken();
  const res = await fetch(url, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  });

  if (!silent && (res.status === 401 || res.status === 403)) {
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  }

  return res;
}
