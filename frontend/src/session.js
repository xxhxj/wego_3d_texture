const TOKEN_KEY = 'wego_token';
const SSO_WEB = import.meta.env.VITE_SSO_WEB || 'http://127.0.0.1:5174';
export const SSO_API = import.meta.env.VITE_SSO_API || 'http://127.0.0.1:3001';

let member = false;

export function isMember() {
  return member;
}

export function setMember(value) {
  member = Boolean(value);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function ensureLogin() {
  const url = new URL(location.href);
  const incoming = url.searchParams.get('token');
  if (incoming) {
    localStorage.setItem(TOKEN_KEY, incoming);
    url.searchParams.delete('token');
    history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }
  if (!getToken()) {
    const back = `${location.origin}${location.pathname}`;
    location.href = `${SSO_WEB}/login?redirect=${encodeURIComponent(back)}`;
    return false;
  }
  return true;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  const back = `${location.origin}${location.pathname}`;
  location.href = `${SSO_WEB}/login?logout=1&redirect=${encodeURIComponent(back)}`;
}
