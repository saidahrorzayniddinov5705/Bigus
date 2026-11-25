/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, Suspense, lazy } from 'react';
import Lenis from 'lenis';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import AdminLogin from './components/AdminLogin';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import { LoadingSpinner } from './components/LoadingSpinner';

// Patients (the vast majority of visits) never load the doctor/admin panel,
// so keep it out of their initial bundle.
const AdminPanel = lazy(() => import('./components/AdminPanel'));

// Admin pages need a real staff session (checked again by the server on every request).
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { staff, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!staff) return <Navigate to="/admin/login" />;
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
              <PrivateRoute>
                <Suspense fallback={<LoadingSpinner />}>
                  <AdminPanel />
                </Suspense>
              </PrivateRoute>
            } />
          </Routes>
        </div>
      </HashRouter>
    </AuthProvider>
  );
}

