import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  Package, 
  Users, 
  BarChart3, 
  Settings as SettingsIcon, 
  LogOut,
  Menu,
  X,
  Receipt
} from 'lucide-react';

function Sidebar({ currentPage, navigate, user, logout, theme }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'billing', label: 'Create Bill', icon: FileSpreadsheet },
    { id: 'sales-history', label: 'Sales History', icon: Receipt },
    { id: 'products', label: 'Products & Stock', icon: Package },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const handleNav = (id) => {
    navigate(id);
    setMobileOpen(false);
  };

  const navClasses = (id) => {
    const isActive = currentPage === id || (id === 'billing' && currentPage === 'invoice-view');
    if (isActive) {
      return `flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm shadow-md cursor-pointer ${
        theme === 'dark'
          ? 'bg-emerald-500 text-zinc-950 shadow-emerald-500/10'
          : 'bg-emerald-600 text-white shadow-emerald-600/10'
      }`;
    }
    return `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all text-sm cursor-pointer ${
      theme === 'dark'
        ? 'text-zinc-400 hover:text-white hover:bg-zinc-900/80'
        : 'text-zinc-600 hover:text-zinc-950 hover:bg-slate-100'
    }`;
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand Header */}
      <div className={`h-16 px-6 border-b flex items-center gap-2 ${theme === 'dark' ? 'border-zinc-800/80' : 'border-slate-200'}`}>
        <div className="flex items-center justify-center p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <span className="text-xl font-black tracking-wider text-emerald-500">TALLY</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 ml-1 bg-emerald-500 text-zinc-950 rounded uppercase">Lite</span>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className="w-full text-left"
            >
              <div className={navClasses(item.id)}>
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </div>
            </button>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className={`p-4 border-t ${theme === 'dark' ? 'border-zinc-800/80' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between">
          <div className="truncate pr-2">
            <p className="text-xs font-bold leading-none truncate">{user.email}</p>
            <p className="text-[10px] uppercase font-bold text-emerald-500 mt-1 leading-none">{user.role} Account</p>
          </div>
          <button
            onClick={logout}
            className={`p-2.5 rounded-xl border hover:scale-105 active:scale-95 transition-all cursor-pointer ${
              theme === 'dark'
                ? 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-red-400'
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-zinc-600 hover:text-red-600'
            }`}
            title="Log Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className={`md:hidden fixed bottom-6 right-6 z-50 p-4 rounded-full border shadow-2xl transition-all cursor-pointer ${
          theme === 'dark'
            ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-emerald-500/20'
            : 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/20'
        }`}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Desktop Sidebar (Permanent) */}
      <aside className={`hidden md:block fixed top-0 bottom-0 left-0 w-64 border-r transition-colors z-30 ${
        theme === 'dark' ? 'bg-zinc-950 border-zinc-900' : 'bg-white border-slate-200'
      }`}>
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (Overlay) */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div 
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          />
          {/* Menu Drawer */}
          <aside className={`relative w-64 h-full flex flex-col border-r transition-all ${
            theme === 'dark' ? 'bg-zinc-950 border-zinc-900 text-white' : 'bg-white border-slate-200 text-zinc-900'
          }`}>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}

export default Sidebar;
