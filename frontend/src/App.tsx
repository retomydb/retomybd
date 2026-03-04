import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect, Component, type ReactNode } from 'react';
import { useAuthStore } from './store/authStore';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import BrowsePage from './pages/BrowsePage';
import DatasetDetailPage from './pages/DatasetDetailPage';
import DashboardPage from './pages/DashboardPage';
import SellerDashboardPage from './pages/SellerDashboardPage';
import AdminPage from './pages/AdminPage';
import CartPage from './pages/CartPage';
import ProfilePage from './pages/ProfilePage';
import WishlistPage from './pages/WishlistPage';
import NotificationsPage from './pages/NotificationsPage';
import DatasetManagePage from './pages/DatasetManagePage';
import CheckoutSuccessPage from './pages/CheckoutSuccessPage';
import CheckoutCancelPage from './pages/CheckoutCancelPage';
import AboutPage from './pages/AboutPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import ContactPage from './pages/ContactPage';
import DocsPage from './pages/DocsPage';
import ModelBrowsePage from './pages/ModelBrowsePage';
import ModelDetailPage from './pages/ModelDetailPage';
import CreateModelPage from './pages/CreateModelPage';
import SpacesBrowsePage from './pages/SpacesBrowsePage';
import SpaceDetailPage from './pages/SpaceDetailPage';

// Layout with Navbar + Footer
function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-retomy-bg">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

// Auth guard
function PrivateRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { isAuthenticated, user } = useAuthStore();
  const token = localStorage.getItem('retomy_access_token');
  console.log('[PrivateRoute]', { isAuthenticated, hasUser: !!user, hasToken: !!token, path: window.location.pathname });

  // If token exists but store says not authenticated, trust the token
  // (handles race condition where store hasn't re-hydrated yet)
  if (!isAuthenticated && !token) {
    console.warn('[PrivateRoute] No auth - redirecting to /login');
    return <Navigate to="/login" replace />;
  }
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Error boundary to prevent blank pages from uncaught render errors
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="page-container max-w-2xl text-center py-24">
          <h1 className="text-2xl font-bold text-retomy-text-bright mb-4">Something went wrong</h1>
          <p className="text-retomy-text-secondary mb-4">{this.state.error?.message || 'An unexpected error occurred'}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { this.setState({ hasError: false, error: null }); }} className="btn-primary text-sm">Try Again</button>
            <a href="/seller" className="btn-secondary text-sm">Back to Dashboard</a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Top-level error boundary - catches ANY crash in the entire app
class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary] CRASHED:', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#171a21', color: '#c7d5e0', fontFamily: 'Inter, sans-serif' }}>
          <div style={{ textAlign: 'center', maxWidth: 480, padding: 32 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 12 }}>Something went wrong</h1>
            <p style={{ fontSize: 14, color: '#8f98a0', marginBottom: 16 }}>{this.state.error?.message || 'An unexpected error occurred'}</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => window.location.reload()} style={{ background: '#66c0f4', color: '#171a21', border: 'none', padding: '8px 20px', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>Reload Page</button>
              <a href="/seller" style={{ background: '#2a475e', color: '#c7d5e0', textDecoration: 'none', padding: '8px 20px', borderRadius: 6, fontWeight: 600, fontSize: 14 }}>Dashboard</a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppInner() {
  const { loadUser, isAuthenticated } = useAuthStore();

  useEffect(() => {
    const token = localStorage.getItem('retomy_access_token');
    if (token && !isAuthenticated) {
      loadUser();
    }
  }, []);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1b2838',
            color: '#c7d5e0',
            border: '1px solid rgba(102, 192, 244, 0.15)',
            borderRadius: '8px',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#4ade80', secondary: '#1b2838' } },
          error: { iconTheme: { primary: '#f87171', secondary: '#1b2838' } },
        }}
      />
      <Routes>
        <Route element={<Layout />}>
          {/* Public routes */}
          <Route index element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/browse" element={<BrowsePage />} />
          <Route path="/dataset/:id" element={<DatasetDetailPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/docs" element={<DocsPage />} />

          {/* Hub routes — Models & Spaces */}
          <Route path="/models" element={<ModelBrowsePage />} />
          <Route path="/models/new" element={
            <PrivateRoute><CreateModelPage /></PrivateRoute>
          } />
          <Route path="/models/:owner/:slug" element={<ModelDetailPage />} />
          <Route path="/spaces" element={<SpacesBrowsePage />} />
          <Route path="/spaces/:owner/:slug" element={<SpaceDetailPage />} />

          <Route path="/dataset/:id/manage" element={
            <PrivateRoute><ErrorBoundary><DatasetManagePage /></ErrorBoundary></PrivateRoute>
          } />

          {/* Authenticated routes */}
          <Route path="/dashboard" element={
            <PrivateRoute><DashboardPage /></PrivateRoute>
          } />
          <Route path="/seller" element={
            <PrivateRoute><SellerDashboardPage /></PrivateRoute>
          } />
          <Route path="/admin" element={
            <PrivateRoute roles={['admin', 'superadmin']}><AdminPage /></PrivateRoute>
          } />
          <Route path="/cart" element={
            <PrivateRoute><CartPage /></PrivateRoute>
          } />
          <Route path="/checkout/success" element={
            <PrivateRoute><CheckoutSuccessPage /></PrivateRoute>
          } />
          <Route path="/checkout/cancel" element={
            <PrivateRoute><CheckoutCancelPage /></PrivateRoute>
          } />
          <Route path="/profile" element={
            <PrivateRoute><ProfilePage /></PrivateRoute>
          } />
          <Route path="/wishlist" element={
            <PrivateRoute><WishlistPage /></PrivateRoute>
          } />
          <Route path="/notifications" element={
            <PrivateRoute><NotificationsPage /></PrivateRoute>
          } />

          {/* Catch all */}
          <Route path="*" element={
            <div className="page-container text-center py-24">
              <h1 className="text-6xl font-extrabold text-retomy-accent mb-4">404</h1>
              <p className="text-retomy-text-secondary text-lg mb-6">Page not found</p>
              <a href="/" className="btn-primary">Go Home</a>
            </div>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppInner />
    </AppErrorBoundary>
  );
}
