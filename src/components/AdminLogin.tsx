import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Logo } from './Logo';

import { LoadingSpinner } from './LoadingSpinner';

export default function AdminLogin() {
  const { userData, loginAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    // Redirect if already logged in as doctor
    if (!loading && userData?.role === 'doctor') {
      navigate('/admin');
    }
  }, [userData, loading, navigate]);

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleAdminLogin = async () => {
    setIsLoggingIn(true);
    try {
      const success = await loginAdmin(email, password);
      if (success) {
        navigate('/admin');
      } else {
        alert('Login failed');
      }
    } catch (e) {
      console.error(e);
      alert('Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-[#020617] flex items-center justify-center p-6 text-zinc-900 dark:text-white relative overflow-hidden">
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#1C1C1E] p-8 rounded-[40px] shadow-2xl border border-black/5 dark:border-white/10 flex flex-col items-center">
        <div className="mb-6">
          <Logo className="w-16 h-16 shadow-lg shadow-blue-500/30 rounded-2xl" />
        </div>
        <h2 className="text-3xl font-black mb-2 text-center text-zinc-900 dark:text-white">Admin Login</h2>
        <p className="text-zinc-500 dark:text-white/60 mb-8 text-center font-medium">Shifokor tizimiga kirish</p>
        
        <input 
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full p-4 mb-4 bg-zinc-100 dark:bg-black/20 rounded-2xl border border-white/5 outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input 
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Parol"
            className="w-full p-4 mb-8 bg-zinc-100 dark:bg-black/20 rounded-2xl border border-white/5 outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button 
          disabled={isLoggingIn}
          onClick={handleAdminLogin}
          className="w-full py-5 rounded-[24px] bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-black text-lg shadow-lg shadow-cyan-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoggingIn ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              Kirish...
            </>
          ) : "Kirish"}
        </button>
      </div>
    </div>
  );
}
