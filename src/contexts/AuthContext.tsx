import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, ApiError, poll, tokens } from '../lib/api';

// Patient + staff sessions against our own backend (server/). There is no
// longer any "admin" flag in localStorage that could be faked — every admin
// request is checked by the server with a real, expiring session token.

export interface MeData {
  user: any;
  meds: any[];
  redemptions: any[];
  reports: any[];
  rewardsToday: { games: number; walkGifts: number; walkDone: boolean };
  features: { ai: boolean; telegram: boolean };
}

interface AuthContextType {
  currentUser: { uid: string } | null;
  userData: any | null;
  me: MeData | null;
  staff: any | null;
  loading: boolean;
  refreshMe: () => Promise<void>;
  applyMe: (patch: Partial<MeData>) => void;
  registerPatient: (data: any) => Promise<string>;
  loginAdmin: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  logoutStaff: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [me, setMe] = useState<MeData | null>(null);
  const [staff, setStaff] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    if (!tokens.get('patient')) { setMe(null); return; }
    try {
      setMe(await api<MeData>('/api/me'));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setMe(null);
    }
  }, []);

  const applyMe = useCallback((patch: Partial<MeData>) => {
    setMe(prev => prev ? { ...prev, ...patch } : prev);
  }, []);

  useEffect(() => {
    (async () => {
      const jobs: Promise<any>[] = [refreshMe()];
      if (tokens.get('staff')) {
        jobs.push(api('/api/admin/me').then(r => setStaff(r.staff)).catch(() => setStaff(null)));
      }
      await Promise.all(jobs);
      setLoading(false);
    })();
    const onUnauthorized = (e: Event) => {
      const kind = (e as CustomEvent).detail;
      if (kind === 'patient') setMe(null);
      if (kind === 'staff') setStaff(null);
    };
    window.addEventListener('bigus:unauthorized', onUnauthorized);
    return () => window.removeEventListener('bigus:unauthorized', onUnauthorized);
  }, [refreshMe]);

  // Keep the patient's data fresh (doctor may assign/stop medication meanwhile).
  useEffect(() => {
    if (!me) return;
    return poll(refreshMe, 20_000);
  }, [!!me, refreshMe]);

  const registerPatient = async (data: any) => {
    try {
      const r = await api<{ token: string; user: any }>('/api/auth/patient', { body: data, as: 'patient' });
      tokens.set('patient', r.token);
      await refreshMe();
      return r.user.uid;
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'wrong-pin' || e.code === 'locked')) throw new Error(e.code);
      throw e;
    }
  };

  const loginAdmin = async (email: string, password: string) => {
    try {
      const r = await api<{ token: string; staff: any }>('/api/auth/staff', { body: { email, password }, as: 'staff' });
      tokens.set('staff', r.token);
      setStaff(r.staff);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.code === 'locked') throw new Error('locked');
      return false;
    }
  };

  const logout = async () => {
    try { await api('/api/auth/logout', { body: {}, as: 'patient' }); } catch { /* ignore */ }
    tokens.set('patient', null);
    setMe(null);
  };

  const logoutStaff = async () => {
    try { await api('/api/auth/logout', { body: {}, as: 'staff' }); } catch { /* ignore */ }
    tokens.set('staff', null);
    setStaff(null);
  };

  const userData = me?.user ?? null;
  const currentUser = userData ? { uid: userData.uid } : null;

  return (
    <AuthContext.Provider value={{ currentUser, userData, me, staff, loading, refreshMe, applyMe, registerPatient, loginAdmin, logout, logoutStaff }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
