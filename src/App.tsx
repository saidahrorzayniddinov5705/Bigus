/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import Lenis from 'lenis';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import AdminLogin from './components/AdminLogin';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import { LoadingSpinner } from './components/LoadingSpinner';

function PrivateRoute({ children, requiredRole }: { children: React.ReactNode, requiredRole?: string }) {
  const { currentUser, userData, loading } = useAuth();
  const isAdminSession = localStorage.getItem('isAdminSession') === 'true';
  
  if (loading) return <LoadingSpinner />;
  if (!currentUser && !isAdminSession) return <Navigate to="/admin/login" />;
  if (requiredRole && userData?.role !== requiredRole) return <Navigate to="/" />;

  return <>{children}</>;
}

export default function App() {
  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.1,
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  return (
    <AuthProvider>
      <HashRouter>
        <div className="w-full min-h-screen">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={
              <PrivateRoute requiredRole="doctor">
                <AdminPanel />
              </PrivateRoute>
            } />
          </Routes>
        </div>
      </HashRouter>
    </AuthProvider>
  );
}

