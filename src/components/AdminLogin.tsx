import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Logo } from './Logo';
import { LoadingSpinner } from './LoadingSpinner';

export default function AdminLogin() {
  const { staff, loginAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    if (!loading && staff) navigate('/admin');
  }, [staff, loading, navigate]);

  const handleAdminLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email || !password) return;
    setError('');
    setIsLoggingIn(true);
    try {
      const ok = await loginAdmin(email.trim(), password);
      if (ok) navigate('/admin');
      else setError("Email yoki parol noto'g'ri.");
    } catch (err: any) {
      setError(err?.message === 'locked'
        ? "Juda ko'p noto'g'ri urinish. 15 daqiqadan keyin qayta urinib ko'ring."
        : "Server bilan bog'lanib bo'lmadi.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-4 sm:p-6 text-white relative overflow-hidden">
      <form onSubmit={handleAdminLogin} className="relative z-10 w-full max-w-md bg-[#111827] p-6 sm:p-8 rounded-[32px] shadow-2xl border border-white/10 flex flex-col items-center">
        <div className="mb-6">
          <Logo className="w-16 h-16 shadow-lg shadow-blue-500/30 rounded-2xl" />
        </div>
        <h2 className="text-3xl font-black mb-2 text-center">Shifokor paneli</h2>
        <p className="text-zinc-400 mb-8 text-center font-medium">BIGUS — shifokor va administratorlar uchun</p>

        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full p-4 mb-4 bg-black/30 rounded-2xl border border-white/10 outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-zinc-500"
        />
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Parol"
          className="w-full p-4 mb-4 bg-black/30 rounded-2xl border border-white/10 outline-none focus:ring-2 focus:ring-cyan-500 text-white placeholder-zinc-500"
        />
        {error && <div className="w-full mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold">{error}</div>}

        <button
          type="submit"
          disabled={isLoggingIn || !email || !password}
          className="w-full mt-4 py-5 rounded-[24px] bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-black text-lg shadow-lg shadow-cyan-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoggingIn ? (<><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Kirish...</>) : 'Kirish'}
        </button>
      </form>
    </div>
  );
}
