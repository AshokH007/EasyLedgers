import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  IndianRupee, 
  Users, 
  Package, 
  Clock, 
  ArrowUpRight, 
  Plus, 
  AlertTriangle, 
  FileText, 
  Loader2,
  TrendingUp
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

function Dashboard({ navigate, theme }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reports/dashboard');
      setData(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load dashboard metrics. Check server connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        <span className="ml-2 font-medium">Fetching dashboard metrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl max-w-xl mx-auto mt-10">
        <h3 className="font-bold text-lg">System Error</h3>
        <p className="text-sm mt-1">{error}</p>
        <button 
          onClick={fetchDashboardData}
          className="mt-4 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  const { cards, recentInvoices, salesTrend, lowStockAlerts } = data;

  const cardStats = [
    { 
      label: "Today's Sales", 
      val: `₹${parseFloat(cards.todaySales).toLocaleString('en-IN')}`, 
      icon: IndianRupee, 
      color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
    },
    { 
      label: "Monthly Sales", 
      val: `₹${parseFloat(cards.monthlySales).toLocaleString('en-IN')}`, 
      icon: TrendingUp, 
      color: 'bg-blue-500/10 border-blue-500/20 text-blue-500' 
    },
    { 
      label: "Pending Payments", 
      val: `₹${parseFloat(cards.pendingPayments).toLocaleString('en-IN')}`, 
      icon: Clock, 
      color: 'bg-amber-500/10 border-amber-500/20 text-amber-500' 
    },
    { 
      label: "Total Customers", 
      val: cards.totalCustomers, 
      icon: Users, 
      color: 'bg-purple-500/10 border-purple-500/20 text-purple-500' 
    },
    { 
      label: "Total Products", 
      val: cards.totalProducts, 
      icon: Package, 
      color: 'bg-rose-500/10 border-rose-500/20 text-rose-500' 
    },
  ];

  return (
    <div className="space-y-6">
      
      {/* Quick Access Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Enterprise Overview</h1>
          <p className={`text-xs ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>Real-time summary of sales, stock levels, and receivables.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('billing')}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-zinc-950 font-bold rounded-xl transition shadow-lg shadow-emerald-500/10 text-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Create Bill
          </button>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cardStats.map((c, i) => {
          const Icon = c.icon;
          return (
            <div 
              key={i} 
              className={`p-5 rounded-2xl border transition-all ${
                theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/80 hover:bg-zinc-900/60' : 'bg-white border-slate-200 hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] uppercase font-bold tracking-wider ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>{c.label}</span>
                <div className={`p-2 rounded-xl border ${c.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-black mt-3 leading-none tracking-tight">{c.val}</div>
            </div>
          );
        })}
      </div>

      {/* Chart and Stock Alert Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sales Trend Chart */}
        <div className={`lg:col-span-2 p-6 rounded-2xl border flex flex-col ${
          theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-white border-slate-200'
        }`}>
          <div className="mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-500">Sales Trend</h3>
            <p className={`text-xs ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>Revenue analysis for the last 7 calendar days.</p>
          </div>
          
          <div className="flex-1 min-h-[250px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesTrend}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#27272a' : '#f1f5f9'} />
                <XAxis 
                  dataKey="date" 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: theme === 'dark' ? '#a1a1aa' : '#64748b', fontSize: 10 }}
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(v) => `₹${v}`}
                  tick={{ fill: theme === 'dark' ? '#a1a1aa' : '#64748b', fontSize: 10 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff', 
                    borderColor: theme === 'dark' ? '#27272a' : '#e2e8f0',
                    color: theme === 'dark' ? '#ffffff' : '#0f172a',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}
                  formatter={(v) => [`₹${parseFloat(v).toLocaleString('en-IN')}`, 'Sales Amount']}
                />
                <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Low Stock Indicators */}
        <div className={`p-6 rounded-2xl border flex flex-col ${
          theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-white border-slate-200'
        }`}>
          <div className="mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 shrink-0" /> Inventory Alerts
            </h3>
            <p className={`text-xs ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>Items with critical low quantities (under 25 units).</p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-[250px]">
            {lowStockAlerts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-10">
                <span className="text-2xl">🎉</span>
                <p className="text-xs font-semibold text-emerald-500 mt-2">All stock levels healthy!</p>
              </div>
            ) : (
              lowStockAlerts.map((prod) => (
                <div 
                  key={prod.id} 
                  className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                    theme === 'dark' ? 'bg-zinc-950/40 border-zinc-800/50 hover:bg-zinc-950/80' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'
                  }`}
                >
                  <div className="truncate pr-2">
                    <p className="text-xs font-bold truncate">{prod.name}</p>
                    <p className={`text-[10px] font-mono mt-0.5 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>SKU: {prod.sku}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-flex px-2 py-0.5 text-[10px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded font-mono">
                      {prod.stockQty} {prod.unit}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <button
            onClick={() => navigate('products')}
            className={`w-full mt-4 py-2 rounded-xl border text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
              theme === 'dark'
                ? 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300'
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-zinc-700'
            }`}
          >
            Refill Inventory Stock <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>

      </div>

      {/* Recent Invoices Table */}
      <div className={`p-6 rounded-2xl border ${
        theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-500">Recent Invoice Records</h3>
            <p className={`text-xs ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>Recently billed transactions in the system.</p>
          </div>
          <button
            onClick={() => navigate('reports')}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
              theme === 'dark'
                ? 'border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300'
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-zinc-700'
            }`}
          >
            All Ledger Records <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className={`border-b ${theme === 'dark' ? 'border-zinc-800 text-zinc-400' : 'border-slate-100 text-zinc-500'}`}>
                <th className="py-3 px-4 font-bold uppercase tracking-wider">Invoice No</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider">Date</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider">Customer</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider text-right">Total Amount</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider">Payment Mode</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider">Status</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/30">
              {recentInvoices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center opacity-60">No invoices found. Create a bill to get started!</td>
                </tr>
              ) : (
                recentInvoices.map((inv) => (
                  <tr 
                    key={inv.id}
                    className={`transition-colors ${
                      theme === 'dark' ? 'hover:bg-zinc-900/30' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 px-4 font-bold text-emerald-500 font-mono">{inv.invoiceNo}</td>
                    <td className="py-3 px-4 text-zinc-400 font-mono">{new Date(inv.date).toLocaleDateString('en-IN')}</td>
                    <td className="py-3 px-4 font-medium">{inv.customer ? inv.customer.name : 'Cash Sale'}</td>
                    <td className="py-3 px-4 text-right font-bold">₹{parseFloat(inv.grandTotal).toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                        inv.paymentMode === 'Credit' 
                          ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500' 
                          : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'
                      }`}>
                        {inv.paymentMode}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                        inv.status === 'Paid' 
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                          : inv.status === 'Cancelled'
                          ? 'bg-zinc-500/10 text-zinc-500 border border-zinc-500/20 line-through'
                          : 'bg-red-500/10 text-red-500 border border-red-500/20'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => navigate('invoice-view', inv.id)}
                        className={`p-1.5 rounded-lg border hover:scale-105 active:scale-95 transition-all inline-flex items-center gap-1 cursor-pointer ${
                          theme === 'dark'
                            ? 'border-zinc-800 bg-zinc-900 hover:bg-zinc-850 hover:text-emerald-400 text-zinc-400'
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:text-emerald-600 text-zinc-600'
                        }`}
                        title="View & Print Invoice"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>Print</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

export default Dashboard;
