import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  BarChart3, 
  Calendar, 
  FileSpreadsheet, 
  IndianRupee, 
  TrendingUp, 
  Loader2, 
  AlertCircle,
  FileText,
  AlertTriangle,
  ArrowRight,
  Trash2
} from 'lucide-react';

function Reports({ user, theme, navigate }) {
  const [activeTab, setActiveTab] = useState('sales'); // 'sales', 'gst', 'products', 'outstanding', 'profit'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Date Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Data States
  const [salesReport, setSalesReport] = useState([]);
  const [gstReport, setGstReport] = useState(null);
  const [productReport, setProductReport] = useState([]);
  const [outstandingReport, setOutstandingReport] = useState([]);
  const [profitReport, setProfitReport] = useState(null);
  const [hsnReport, setHsnReport] = useState([]);

  const fetchReportData = async () => {
    setLoading(true);
    setError('');
    
    const dateParams = `?startDate=${startDate}&endDate=${endDate}`;
    
    try {
      if (activeTab === 'sales') {
        const res = await api.get(`/invoices${dateParams}`);
        setSalesReport(res.data);
      } else if (activeTab === 'gst') {
        const res = await api.get(`/reports/gst${dateParams}`);
        setGstReport(res.data);
      } else if (activeTab === 'products') {
        const res = await api.get(`/reports/products${dateParams}`);
        setProductReport(res.data);
      } else if (activeTab === 'outstanding') {
        const res = await api.get('/reports/outstanding'); // Dues are cumulative
        setOutstandingReport(res.data);
      } else if (activeTab === 'profit' && user.role === 'admin') {
        const res = await api.get(`/reports/profit${dateParams}`);
        setProfitReport(res.data);
      } else if (activeTab === 'hsn') {
        const res = await api.get(`/reports/hsn${dateParams}`);
        setHsnReport(res.data);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch reporting data. Check database connections.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInvoice = async (id, invoiceNo) => {
    if (!window.confirm(`Are you sure you want to PERMANENTLY delete invoice ${invoiceNo}? This action is destructive and cannot be undone.`)) return;
    try {
      setLoading(true);
      await api.delete(`/invoices/${id}`);
      alert('Invoice deleted successfully.');
      fetchReportData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to delete invoice.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [activeTab]); // Fetch on tab switch or manual click

  // CSV Export utility
  const handleExportCSV = () => {
    let headers = [];
    let rows = [];
    let filename = `report_${activeTab}.csv`;

    if (activeTab === 'sales') {
      headers = ['Invoice No', 'Date', 'Customer', 'Subtotal', 'Discounts', 'CGST', 'SGST', 'IGST', 'Total', 'Payment Mode', 'Status'];
      rows = salesReport.map(inv => [
        inv.invoiceNo,
        new Date(inv.date).toLocaleDateString('en-IN'),
        inv.customer ? inv.customer.name : 'Cash Sale',
        inv.subtotal,
        inv.discount,
        inv.cgst,
        inv.sgst,
        inv.igst,
        inv.grandTotal,
        inv.paymentMode,
        inv.status
      ]);
    } else if (activeTab === 'gst' && gstReport) {
      headers = ['GST Slab Bracket', 'Taxable Turnover', 'CGST Amount', 'SGST Amount', 'IGST Amount', 'Total GST Collected'];
      rows = Object.entries(gstReport.brackets).map(([bracket, b]) => [
        bracket,
        b.taxable.toFixed(2),
        b.cgst.toFixed(2),
        b.sgst.toFixed(2),
        b.igst.toFixed(2),
        b.totalTax.toFixed(2)
      ]);
    } else if (activeTab === 'products') {
      headers = ['Product Name', 'SKU', 'Unit', 'Qty Sold', 'Revenue (₹)', 'Purchase Cost (₹)', 'Margin Profit (₹)', 'Margin (%)', 'Stock Balance'];
      rows = productReport.map(p => [
        `"${p.name.replace(/"/g, '""')}"`,
        p.sku,
        p.unit,
        p.qtySold,
        p.revenue.toFixed(2),
        p.purchaseCost.toFixed(2),
        p.grossProfit.toFixed(2),
        p.marginPercent.toFixed(1),
        p.stockRemaining
      ]);
    } else if (activeTab === 'outstanding') {
      headers = ['Invoice No', 'Date Issued', 'Customer Name', 'Outstanding Balance (₹)', 'Mobile Number', 'Email'];
      rows = outstandingReport.map(inv => [
        inv.invoiceNo,
        new Date(inv.date).toLocaleDateString('en-IN'),
        inv.customer ? inv.customer.name : 'Cash Customer',
        inv.grandTotal,
        inv.customer ? inv.customer.mobile : '',
        inv.customer ? inv.customer.email : ''
      ]);
    } else if (activeTab === 'hsn') {
      headers = ['HSN Code', 'Description of Goods', 'UQC', 'Total Quantity', 'Total Value (₹)', 'Taxable Value (₹)', 'CGST Amount (₹)', 'SGST Amount (₹)', 'IGST Amount (₹)', 'Total Tax (₹)'];
      rows = hsnReport.map(item => [
        item.hsn,
        `"${item.description.replace(/"/g, '""')}"`,
        item.uqc,
        item.totalQty,
        item.totalValue.toFixed(2),
        item.taxableValue.toFixed(2),
        item.cgst.toFixed(2),
        item.sgst.toFixed(2),
        item.igst.toFixed(2),
        item.totalTax.toFixed(2)
      ]);
    } else {
      alert('Export not supported for this tab.');
      return;
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tabs = [
    { id: 'sales', label: 'Sales Report', icon: TrendingUp, role: ['admin', 'staff'] },
    { id: 'gst', label: 'GST Tax liability', icon: BarChart3, role: ['admin', 'staff'] },
    { id: 'products', label: 'Product Sales', icon: BarChart3, role: ['admin', 'staff'] },
    { id: 'hsn', label: 'HSN Summary (GSTR-1)', icon: FileText, role: ['admin', 'staff'] },
    { id: 'outstanding', label: 'Outstanding Payments', icon: AlertTriangle, role: ['admin', 'staff'] },
    { id: 'profit', label: 'Profits Report', icon: IndianRupee, role: ['admin'] },
  ];

  const filteredTabs = tabs.filter(t => t.role.includes(user.role));

  return (
    <div className="space-y-6">
      
      {/* Header with Search and Export Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Reports & Analytical Ledgers</h1>
          <p className={`text-xs ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>Review Sales velocity, GST returns, SKU margins, and accounts outstanding.</p>
        </div>
        
        {activeTab !== 'profit' && (
          <div>
            <button
              onClick={handleExportCSV}
              disabled={loading}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                theme === 'dark'
                  ? 'border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-zinc-300'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-zinc-700 font-bold'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" /> Download CSV Export
            </button>
          </div>
        )}
      </div>

      {/* Tabs Selector Navigation bar */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
        {filteredTabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                activeTab === t.id
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 font-extrabold'
                  : theme === 'dark'
                  ? 'border-zinc-900 bg-zinc-950 text-zinc-400 hover:bg-zinc-900/60'
                  : 'border-slate-200 bg-slate-50 text-zinc-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Date Filter Ribbon (Hidden for Outstanding Dues Report) */}
      {activeTab !== 'outstanding' && (
        <div className={`p-4 rounded-2xl border flex flex-wrap items-center gap-4 ${
          theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-emerald-500 shrink-0" />
            <span className="text-xs font-bold">Filter Period:</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold opacity-60">From</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`p-2 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                  theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                }`}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold opacity-60">To</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`p-2 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                  theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                }`}
              />
            </div>

            <button
              onClick={fetchReportData}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-lg text-xs active:scale-95 transition cursor-pointer"
            >
              Apply Filter
            </button>
          </div>
        </div>
      )}

      {/* Reports Display Container */}
      <div className={`rounded-2xl border overflow-hidden max-h-[550px] overflow-y-auto ${
        theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-white border-slate-200'
      }`}>
        {loading ? (
          <div className="py-20 text-center text-xs">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-500 mb-2" />
            Generating reports ledger...
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-500 flex items-center justify-center gap-2">
            <AlertCircle className="h-5 w-5" /> {error}
          </div>
        ) : (
          <>
            {/* 1. SALES REPORT VIEW */}
            {activeTab === 'sales' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className={`border-b ${theme === 'dark' ? 'border-zinc-800 text-zinc-400' : 'border-slate-100 text-zinc-500'}`}>
                      <th className="py-3 px-4 font-bold uppercase">Invoice No</th>
                      <th className="py-3 px-4 font-bold uppercase">Date</th>
                      <th className="py-3 px-4 font-bold uppercase">Customer</th>
                      <th className="py-3 px-4 font-bold uppercase text-right">Taxable Subtotal</th>
                      <th className="py-3 px-4 font-bold uppercase text-right">Discounts</th>
                      <th className="py-3 px-4 font-bold uppercase text-right">Tax collected</th>
                      <th className="py-3 px-4 font-bold uppercase text-right">Grand Total</th>
                      <th className="py-3 px-4 font-bold uppercase">Payment</th>
                      <th className="py-3 px-4 font-bold uppercase">Status</th>
                      {user.role === 'admin' && <th className="py-3 px-4 font-bold uppercase text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/30">
                    {salesReport.length === 0 ? (
                      <tr>
                        <td colSpan={user.role === 'admin' ? "10" : "9"} className="py-8 text-center opacity-60">No billing invoices found in selected period.</td>
                      </tr>
                    ) : (
                      salesReport.map(inv => {
                        const tax = parseFloat(inv.cgst) + parseFloat(inv.sgst) + parseFloat(inv.igst);
                        return (
                          <tr key={inv.id} className={theme === 'dark' ? 'hover:bg-zinc-900/30' : 'hover:bg-slate-50'}>
                            <td className="py-3 px-4 font-mono font-bold text-emerald-500">
                              <button 
                                onClick={() => navigate('invoice-view', inv.id)} 
                                className="hover:underline hover:text-emerald-450 cursor-pointer font-bold"
                                title="Click to view & manage invoice details"
                              >
                                {inv.invoiceNo}
                              </button>
                            </td>
                            <td className="py-3 px-4 font-mono text-zinc-400">{new Date(inv.date).toLocaleDateString('en-IN')}</td>
                            <td className="py-3 px-4 font-medium">{inv.customer ? inv.customer.name : 'Cash Customer'}</td>
                            <td className="py-3 px-4 text-right font-mono">₹{parseFloat(inv.subtotal).toFixed(2)}</td>
                            <td className="py-3 px-4 text-right font-mono text-zinc-500">₹{parseFloat(inv.discount).toFixed(2)}</td>
                            <td className="py-3 px-4 text-right font-mono text-zinc-500">₹{tax.toFixed(2)}</td>
                            <td className="py-3 px-4 text-right font-mono font-bold">₹{parseFloat(inv.grandTotal).toFixed(2)}</td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                inv.paymentMode === 'Credit' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              }`}>{inv.paymentMode}</span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                inv.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : inv.status === 'Cancelled' ? 'bg-zinc-800 text-zinc-500 border border-zinc-700 line-through' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                              }`}>{inv.status}</span>
                            </td>
                            {user.role === 'admin' && (
                              <td className="py-3 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteInvoice(inv.id, inv.invoiceNo)}
                                  className="p-1 rounded bg-red-550/10 hover:bg-red-550/20 text-red-500 hover:scale-105 active:scale-95 transition-all cursor-pointer inline-flex items-center justify-center border border-red-500/20"
                                  title="Delete invoice record"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 2. GST REPORT VIEW */}
            {activeTab === 'gst' && gstReport && (
              <div className="p-6 space-y-6">
                
                {/* GST aggregation card */}
                <div className={`p-5 rounded-2xl border grid grid-cols-2 sm:grid-cols-4 gap-4 ${
                  theme === 'dark' ? 'bg-zinc-950 border-zinc-850' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div>
                    <span className="text-[10px] font-bold uppercase opacity-60">Taxable Turnover</span>
                    <p className="text-xl font-black mt-1">₹{gstReport.summary.taxable.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase opacity-60">CGST Collected</span>
                    <p className="text-xl font-black text-emerald-500 mt-1">₹{gstReport.summary.cgst.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase opacity-60">SGST Collected</span>
                    <p className="text-xl font-black text-emerald-500 mt-1">₹{gstReport.summary.sgst.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase opacity-60">IGST Collected</span>
                    <p className="text-xl font-black text-blue-500 mt-1">₹{gstReport.summary.igst.toFixed(2)}</p>
                  </div>
                </div>

                {/* GST Brackets */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">GST Slab Brackets Breakdown</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {Object.entries(gstReport.brackets).map(([slab, data]) => (
                      <div 
                        key={slab}
                        className={`p-4 rounded-xl border space-y-2 ${
                          theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
                        }`}
                      >
                        <div className="text-base font-black text-emerald-500">{slab} Slab</div>
                        <div className="text-[10px] font-mono leading-normal text-zinc-400 space-y-1">
                          <p>Taxable: ₹{data.taxable.toFixed(1)}</p>
                          <p>CGST: ₹{data.cgst.toFixed(1)}</p>
                          <p>SGST: ₹{data.sgst.toFixed(1)}</p>
                          <p>IGST: ₹{data.igst.toFixed(1)}</p>
                          <p className="font-bold text-zinc-300 border-t border-zinc-800 pt-1 mt-1">Total Tax: ₹{data.totalTax.toFixed(1)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

            {/* 3. PRODUCT SALES REPORT VIEW */}
            {activeTab === 'products' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className={`border-b ${theme === 'dark' ? 'border-zinc-800 text-zinc-400' : 'border-slate-100 text-zinc-500'}`}>
                      <th className="py-3 px-4 font-bold uppercase">SKU</th>
                      <th className="py-3 px-4 font-bold uppercase">Product Item</th>
                      <th className="py-3 px-4 font-bold uppercase text-center">Unit</th>
                      <th className="py-3 px-4 font-bold uppercase text-right">Qty Sold</th>
                      <th className="py-3 px-4 font-bold uppercase text-right">Revenue (₹)</th>
                      <th className="py-3 px-4 font-bold uppercase text-right">Purchase Cost (₹)</th>
                      <th className="py-3 px-4 font-bold uppercase text-right">Margin profit (₹)</th>
                      <th className="py-3 px-4 font-bold uppercase text-center">Margin %</th>
                      <th className="py-3 px-4 font-bold uppercase text-center">Remaining Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/30">
                    {productReport.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="py-8 text-center opacity-60">No product sales recorded in selected period.</td>
                      </tr>
                    ) : (
                      productReport.map(p => (
                        <tr key={p.id} className={theme === 'dark' ? 'hover:bg-zinc-900/30' : 'hover:bg-slate-50'}>
                          <td className="py-3 px-4 font-mono font-bold text-zinc-400">{p.sku}</td>
                          <td className="py-3 px-4 font-bold text-zinc-100">{p.name}</td>
                          <td className="py-3 px-4 text-center">{p.unit}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold">{p.qtySold}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-500">₹{p.revenue.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-mono text-zinc-500">₹{p.purchaseCost.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-mono font-semibold">₹{p.grossProfit.toFixed(2)}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                              p.marginPercent > 20 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'
                            }`}>{p.marginPercent.toFixed(1)}%</span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-zinc-400">{p.stockRemaining}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 4. OUTSTANDING DUES REPORT VIEW */}
            {activeTab === 'outstanding' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className={`border-b ${theme === 'dark' ? 'border-zinc-800 text-zinc-400' : 'border-slate-100 text-zinc-500'}`}>
                      <th className="py-3 px-4 font-bold uppercase">Invoice No</th>
                      <th className="py-3 px-4 font-bold uppercase">Date Issued</th>
                      <th className="py-3 px-4 font-bold uppercase">Customer Name</th>
                      <th className="py-3 px-4 font-bold uppercase text-right">Outstanding Amount (₹)</th>
                      <th className="py-3 px-4 font-bold uppercase">Mobile Number</th>
                      <th className="py-3 px-4 font-bold uppercase">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/30">
                    {outstandingReport.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-8 text-center opacity-60">No pending outstanding credit invoices. Great job!</td>
                      </tr>
                    ) : (
                      outstandingReport.map(inv => (
                        <tr key={inv.id} className={theme === 'dark' ? 'hover:bg-zinc-900/30' : 'hover:bg-slate-50'}>
                          <td className="py-3 px-4 font-mono font-bold text-amber-500">{inv.invoiceNo}</td>
                          <td className="py-3 px-4 font-mono text-zinc-400">{new Date(inv.date).toLocaleDateString('en-IN')}</td>
                          <td className="py-3 px-4 font-bold text-zinc-200">{inv.customer ? inv.customer.name : 'Cash customer'}</td>
                          <td className="py-3 px-4 text-right font-mono font-black text-amber-500">₹{parseFloat(inv.grandTotal).toFixed(2)}</td>
                          <td className="py-3 px-4 font-mono">{inv.customer?.mobile || '—'}</td>
                          <td className="py-3 px-4">{inv.customer?.email || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 6. HSN OUTWARD SUMMARY REPORT VIEW */}
            {activeTab === 'hsn' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className={`border-b ${theme === 'dark' ? 'border-zinc-800 text-zinc-400' : 'border-slate-100 text-zinc-500'}`}>
                      <th className="py-3 px-4 font-bold uppercase">HSN Code</th>
                      <th className="py-3 px-4 font-bold uppercase">Description of Goods</th>
                      <th className="py-3 px-4 font-bold uppercase text-center">UQC (Unit)</th>
                      <th className="py-3 px-4 font-bold uppercase text-right">Total Quantity</th>
                      <th className="py-3 px-4 font-bold uppercase text-right">Taxable Value (₹)</th>
                      <th className="py-3 px-4 font-bold uppercase text-right">CGST (₹)</th>
                      <th className="py-3 px-4 font-bold uppercase text-right">SGST (₹)</th>
                      <th className="py-3 px-4 font-bold uppercase text-right">IGST (₹)</th>
                      <th className="py-3 px-4 font-bold uppercase text-right font-black">Total Value (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/30">
                    {hsnReport.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="py-8 text-center opacity-60">No outward supplies matching HSN categories in this period.</td>
                      </tr>
                    ) : (
                      hsnReport.map((item, idx) => (
                        <tr key={idx} className={theme === 'dark' ? 'hover:bg-zinc-900/30' : 'hover:bg-slate-50'}>
                          <td className="py-3 px-4 font-mono font-bold text-emerald-500">{item.hsn}</td>
                          <td className="py-3 px-4 font-bold text-zinc-200">{item.description}</td>
                          <td className="py-3 px-4 text-center font-semibold text-zinc-400">{item.uqc}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-zinc-350">{item.totalQty}</td>
                          <td className="py-3 px-4 text-right font-mono text-zinc-400">₹{item.taxableValue.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-mono text-zinc-500">₹{item.cgst.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-mono text-zinc-500">₹{item.sgst.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-mono text-blue-500">₹{item.igst.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-mono font-black text-emerald-500">₹{item.totalValue.toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 5. PROFITABILITY REPORT (ADMIN ONLY) */}
            {activeTab === 'profit' && profitReport && (
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {/* Revenue card */}
                  <div className={`p-6 rounded-2xl border ${
                    theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
                  }`}>
                    <span className="text-[10px] font-bold uppercase opacity-60">Total Gross Turnover</span>
                    <p className="text-2xl font-black text-zinc-100 mt-2 font-mono">₹{profitReport.revenue.toFixed(2)}</p>
                  </div>
                  
                  {/* Purchase Cost card */}
                  <div className={`p-6 rounded-2xl border ${
                    theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
                  }`}>
                    <span className="text-[10px] font-bold uppercase opacity-60">Inventory Purchase Cost</span>
                    <p className="text-2xl font-black text-zinc-400 mt-2 font-mono">₹{profitReport.purchaseCost.toFixed(2)}</p>
                  </div>

                  {/* Profit card */}
                  <div className={`p-6 rounded-2xl border ${
                    theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200 shadow-xs'
                  }`}>
                    <span className="text-[10px] font-bold uppercase opacity-60">Gross profit earnings</span>
                    <p className="text-2xl font-black text-emerald-500 mt-2 font-mono">₹{profitReport.grossProfit.toFixed(2)}</p>
                  </div>
                </div>

                {/* Additional metrics */}
                <div className={`p-5 rounded-2xl border flex items-center justify-between ${
                  theme === 'dark' ? 'bg-zinc-950 border-zinc-850' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase opacity-60">Cumulative margin percent</span>
                    <p className="text-lg font-black text-emerald-400">{profitReport.marginPercent.toFixed(1)}% Avg Margin</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase opacity-60">Discount Deductions</span>
                    <p className="text-lg font-black text-red-500">-₹{profitReport.discount.toFixed(2)}</p>
                  </div>
                </div>

              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}

export default Reports;
