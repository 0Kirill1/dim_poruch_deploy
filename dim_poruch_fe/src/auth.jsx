import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest, tokenStore } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.access));

  const clear = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setLoading(false);
  }, []);

  const loadUser = useCallback(async () => {
    if (!tokenStore.access) { setUser(null); setLoading(false); return null; }
    const profile = await apiRequest('/me');
    setUser(profile);
    return profile;
  }, []);

  useEffect(() => {
    let active = true;
    const onExpired = () => { if (active) clear(); };
    window.addEventListener('dimporuch:session-expired', onExpired);
    if (tokenStore.access) {
      loadUser().catch(() => { if (active) clear(); }).finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; window.removeEventListener('dimporuch:session-expired', onExpired); };
  }, [clear, loadUser]);

  const login = useCallback(async (credentials) => {
    const result = await apiRequest('/auth/login', { method: 'POST', auth: false, body: credentials });
    if (!result?.jwt_token || !result?.refresh_token) throw new Error('Сервер не повернув токени авторизації.');
    tokenStore.set(result.jwt_token, result.refresh_token);
    try { return await loadUser(); }
    catch (error) { tokenStore.clear(); setUser(null); throw error; }
  }, [loadUser]);

  const register = useCallback((payload) => apiRequest('/auth/register', { method: 'POST', auth: false, body: payload }), []);

  const logout = useCallback(async () => {
    try { if (tokenStore.access) await apiRequest('/auth/logout', { method: 'POST' }); } catch { /* Local logout always wins. */ }
    clear();
  }, [clear]);

  const updateUser = useCallback((profile) => setUser(profile), []);
  const value = useMemo(() => ({ user, loading, login, register, logout, clear, loadUser, updateUser }), [user, loading, login, register, logout, clear, loadUser, updateUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
