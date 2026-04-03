// app/admin/layout.js
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { Poppins } from "next/font/google";
import Header from "./Header/Header";
import AdminLogin from './AdminLogin/AdminLogin';
import { checkAuthStatus } from '../src/lib/slices/authSlice';
const poppins = Poppins({
  subsets: ["latin"],
  display: 'swap',
  weight: ['400', '500', '600']
});

export default function AdminLayout({ children }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const { isAuthenticated, user, loading } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(checkAuthStatus());
  }, [dispatch]);

  // Show loading state
  if (loading) {
    return (
      <div className="loadingContainer">
        <div className="loader">
          <lottie-player src="/Loader-cat.json" background="transparent" speed="1" loop autoplay aria-label="Loading" style={{ width: 200, height: 200, display: "inline-block" }} />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <AdminLogin />;
  }

  // Show admin panel if authenticated
  return (
    <div className={poppins.variable}>
      <Header />
      <main className="adminMainContent">
        {children}
      </main>
    </div>
  );
}



