import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertCircle, ShieldX, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AuthGuard({ children }) {
  const [authState, setAuthState] = useState('checking'); // 'checking' | 'authorized' | 'denied' | 'not_logged_in'
  const [errorMessage, setErrorMessage] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkUserAccess();
  }, []);

  const checkUserAccess = async () => {
    try {
      // Check if user is authenticated
      const isAuthenticated = await base44.auth.isAuthenticated();

      if (!isAuthenticated) {
        setAuthState('not_logged_in');
        return;
      }

      // Get current user
      const user = await base44.auth.me();

      if (!user) {
        setAuthState('not_logged_in');
        return;
      }

      // Check if user is active
      if (user.status === 'inactive' || user.active === false) {
        setErrorMessage('Your account has been deactivated. Please contact your administrator for assistance.');
        setAuthState('denied');
        return;
      }

      // All authenticated and active users are allowed
      setAuthState('authorized');
    } catch (error) {
      console.error('Auth check error:', error);
      // On error, allow access (don't block due to API issues)
      setAuthState('authorized');
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);

    try {
      await base44.auth.login(email, password);
      window.location.reload();
    } catch (err) {
      setLoginError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  // Loading state
  if (authState === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Not logged in state
  if (authState === 'not_logged_in') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldX className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Welcome Back</h1>
            <p className="text-slate-600">
              Sign in to continue to Sarthi Task Tracker
            </p>
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                placeholder="admin@sarthi.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              />
            </div>

            {loginError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {loginError}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 h-11 text-base"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-center text-slate-500 mb-2">Available Demo Accounts:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                <button type="button" onClick={() => setEmail('admin@sarthi.com')} className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded text-slate-600">admin@sarthi.com</button>
                <button type="button" onClick={() => setEmail('pm@sarthi.com')} className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded text-slate-600">pm@sarthi.com</button>
                <button type="button" onClick={() => setEmail('team@sarthi.com')} className="text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded text-slate-600">team@sarthi.com</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Access denied state
  if (authState === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600 mb-6">
            {errorMessage}
          </p>
          <div className="bg-slate-50 rounded-lg p-4 mb-6 text-left">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Mail className="w-4 h-4" />
              <span>Contact your administrator to request access.</span>
            </div>
          </div>
          <Button
            onClick={handleLogin}
            variant="outline"
            className="w-full"
          >
            Try Another Account
          </Button>
        </div>
      </div>
    );
  }

  // Authorized - render children
  return children;
}