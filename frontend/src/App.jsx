import React, { useState, useEffect } from 'react';
import api from './services/api';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Billing from './pages/Billing';
import Products from './pages/Products';
import Customers from './pages/Customers';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import InvoiceView from './pages/InvoiceView';
import { Sun, Moon, LogIn, Lock, Mail, User as UserIcon, Loader2 } from 'lucide-react';

function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [theme, setTheme] = useState('dark');
  const [loading, setLoading] = useState(true);

  // Login Form States
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Fetch current user and theme on mount
  useEffect(() => {
    const initApp = async () => {
      const cachedToken = localStorage.getItem('token');
      const cachedUser = localStorage.getItem('user');
      const cachedTheme = localStorage.getItem('theme') || 'dark';
      
      setTheme(cachedTheme);
      if (cachedTheme === 'light') {
        document.documentElement.classList.add('light');
      } else {
        document.documentElement.classList.remove('light');
      }

      if (cachedToken && cachedUser) {
        try {
          setUser(JSON.parse(cachedUser));
        } catch (e) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
      setLoading(false);
    };

    initApp();
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    if (nextTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!emailOrUsername || !password) {
      setLoginError('Please fill in all fields');
      return;
    }

    setLoginLoading(true);
    setLoginError('');

    try {
      const res = await api.post('/auth/login', { emailOrUsername, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      setCurrentPage('dashboard');
    } catch (error) {
      console.error(error);
      setLoginError(error.response?.data?.message || 'Invalid credentials or connection error');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setCurrentPage('dashboard');
    setSelectedInvoiceId(null);
  };

  const navigateTo = (page, param = null) => {
    if (page === 'invoice-view') {
      setSelectedInvoiceId(param);
    }
    setCurrentPage(page);
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-emerald-400">
        <Loader2 className="h-10 w-10 animate-spin" />
        <span className="ml-3 font-semibold text-lg">Loading System...</span>
      </div>
    );
  }

  // Render Login view if not authenticated
  if (!user) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 p-4 ${theme === 'dark' ? 'bg-zinc-950 text-white' : 'bg-slate-50 text-zinc-900'}`}>
        {/* Theme toggle on login page */}
        <button 
          onClick={toggleTheme}
          className="absolute top-6 right-6 p-3 rounded-xl border border-zinc-700/50 bg-zinc-900/40 text-emerald-400 hover:bg-zinc-800/80 transition-all cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5 text-emerald-600" />}
        </button>

        <div className="w-full max-w-md">
          {/* Brand Logo Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl mb-3">
              <span className="text-3xl font-black tracking-wider text-emerald-500">TALLY</span>
              <span className="text-xs font-bold px-1.5 py-0.5 ml-1 bg-emerald-500 text-zinc-950 rounded uppercase">Lite</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">GST Biller & Inventory</h1>
            <p className={`text-sm mt-1.5 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
              Simplifying billing & inventory for retail and distribution.
            </p>
          </div>

          {/* Login Card */}
          <div className={`p-8 rounded-3xl border shadow-xl transition-all ${theme === 'dark' ? 'bg-zinc-900/60 border-zinc-800/80' : 'bg-white border-slate-200'}`}>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <LogIn className="h-5 w-5 text-emerald-500" /> Account Sign In
            </h2>

            {loginError && (
              <div className="mb-4 p-3.5 text-sm bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl font-medium">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 opacity-80">Email / Username</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 h-4 w-4 text-zinc-400" />
                  <input
                    type="text"
                    required
                    value={emailOrUsername}
                    onChange={(e) => setEmailOrUsername(e.target.value)}
                    placeholder="e.g. admin"
                    className={`w-full py-3 pl-10 pr-4 rounded-xl border text-sm outline-none transition-all ${
                      theme === 'dark' 
                        ? 'bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-white' 
                        : 'bg-slate-50 border-slate-200 focus:border-emerald-600 text-zinc-950'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 opacity-80">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 h-4 w-4 text-zinc-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full py-3 pl-10 pr-4 rounded-xl border text-sm outline-none transition-all ${
                      theme === 'dark' 
                        ? 'bg-zinc-950 border-zinc-800 focus:border-emerald-500 text-white' 
                        : 'bg-slate-50 border-slate-200 focus:border-emerald-600 text-zinc-950'
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full mt-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-zinc-950 font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10"
              >
                {loginLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>Sign In <LogIn className="h-4 w-4" /></>
                )}
              </button>
            </form>

            {/* Default credentials hint */}
            <div className={`mt-6 pt-5 border-t text-xs space-y-1 ${theme === 'dark' ? 'border-zinc-800 text-zinc-500' : 'border-slate-100 text-zinc-400'}`}>
              <div className="font-semibold text-emerald-500">Default Demo Credentials:</div>
              <div>• Admin: <code className="font-mono text-zinc-400">admin</code> or <code className="font-mono text-zinc-400">admin@gstbiller.com</code> / password: <code className="font-mono text-zinc-400">admin123</code></div>
              <div>• Staff: <code className="font-mono text-zinc-400">staff</code> or <code className="font-mono text-zinc-400">staff@gstbiller.com</code> / password: <code className="font-mono text-zinc-400">staff123</code></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render main layout if authenticated
  return (
    <div className={`min-h-screen flex transition-colors duration-300 ${theme === 'dark' ? 'bg-zinc-950 text-white' : 'bg-slate-50 text-zinc-900'}`}>
      
      {/* Sidebar Navigation */}
      <Sidebar 
        currentPage={currentPage} 
        navigate={navigateTo} 
        user={user} 
        logout={handleLogout} 
        theme={theme}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 md:pl-64 overflow-x-hidden">
        
        {/* Top Navbar */}
        <header className={`h-16 px-6 border-b flex items-center justify-between no-print transition-colors ${theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold tracking-tight capitalize">
              {currentPage === 'invoice-view' ? 'Invoice Preview' : `${currentPage} Management`}
            </h2>
            {currentPage === 'billing' && (
              <span className="hidden sm:inline-flex px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs rounded font-mono">
                Active Billing Mode
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Theme Switcher */}
            <button 
              onClick={toggleTheme}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                theme === 'dark' 
                  ? 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-emerald-400' 
                  : 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-emerald-600'
              }`}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Profile Dropdown */}
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                <UserIcon className="h-4 w-4" />
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold leading-none">{user.username}</div>
                <div className="text-[10px] uppercase font-semibold leading-none mt-0.5 opacity-60">{user.role}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page Views */}
        <div className="flex-1 p-6 overflow-y-auto">
          {currentPage === 'dashboard' && <Dashboard navigate={navigateTo} theme={theme} />}
          {currentPage === 'billing' && <Billing navigate={navigateTo} theme={theme} />}
          {currentPage === 'products' && <Products user={user} theme={theme} />}
          {currentPage === 'customers' && <Customers theme={theme} />}
          {currentPage === 'reports' && <Reports user={user} theme={theme} />}
          {currentPage === 'settings' && <Settings user={user} theme={theme} />}
          {currentPage === 'invoice-view' && <InvoiceView invoiceId={selectedInvoiceId} navigate={navigateTo} theme={theme} />}
        </div>
      </main>
    </div>
  );
}

export default App;
