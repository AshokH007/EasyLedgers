import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Search, 
  TrendingUp, 
  IndianRupee, 
  Clock, 
  AlertTriangle, 
  Loader2, 
  XOctagon, 
  Trash2, 
  Printer, 
  Download, 
  Edit
} from 'lucide-react';

function SalesHistory({ navigate, theme, user }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All', 'Paid', 'Unpaid', 'Cancelled'
  const [paymentModeFilter, setPaymentModeFilter] = useState('All'); // 'All', 'Cash', 'UPI', 'Card', 'Credit', 'Bank Transfer'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Build query string matching backend parameters
      let queryParts = [];
      if (statusFilter !== 'All') queryParts.push(`status=${statusFilter}`);
      if (paymentModeFilter !== 'All') queryParts.push(`paymentMode=${paymentModeFilter}`);
      if (startDate) queryParts.push(`startDate=${startDate}`);
      if (endDate) queryParts.push(`endDate=${endDate}`);
      
      const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
      const res = await api.get(`/invoices${queryString}`);
      setInvoices(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch invoice ledger list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter, paymentModeFilter, startDate, endDate]);

  // Inline Status Change for credit bills
  const handleUpdateStatus = async (id, newStatus, currentPaymentMode) => {
    const defaultMode = currentPaymentMode === 'Credit' ? 'Cash' : currentPaymentMode;
    try {
      await api.put(`/invoices/${id}/status`, { 
        status: newStatus, 
        paymentMode: newStatus === 'Paid' ? defaultMode : 'Credit'
      });
      fetchInvoices();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update invoice status.');
    }
  };

  // Cancel Invoice & restore stock
  const handleCancelInvoice = async (id, invoiceNo) => {
    if (!window.confirm(`Are you sure you want to CANCEL invoice ${invoiceNo}? This will restore product stocks.`)) return;
    try {
      await api.put(`/invoices/${id}/cancel`);
      alert('Invoice cancelled and stock restored successfully.');
      fetchInvoices();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel invoice.');
    }
  };

  // Permanently delete invoice (Admin Only)
  const handleDeleteInvoice = async (id, invoiceNo) => {
    if (!window.confirm(`Are you sure you want to PERMANENTLY delete invoice ${invoiceNo}? This is destructive, will adjust product stock, and cannot be undone.`)) return;
    try {
      await api.delete(`/invoices/${id}`);
      alert('Invoice deleted successfully.');
      fetchInvoices();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete invoice.');
    }
  };

  // Load into Edit mode
  const handleEditInvoice = (inv) => {
    const draftData = {
      customer: inv.customer,
      rows: inv.items ? inv.items.map(item => ({
        productId: item.productId,
        name: item.product?.name || '',
        sku: item.product?.sku || '',
        hsn: item.product?.hsn || '',
        qty: parseFloat(item.qty),
        rate: parseFloat(item.rate),
        discount: parseFloat(item.discount),
        gstPercent: parseFloat(item.gstPercent),
        total: parseFloat(item.total)
      })) : [],
      paymentMode: inv.paymentMode,
      billType: inv.billType
    };
    
    // Fallback if items are missing (should fetch detailed invoice or fetch from API if not populated)
    if (!inv.items || inv.items.length === 0) {
      // Fetch details first
      api.get(`/invoices/${inv.id}`).then(res => {
        const detailed = res.data;
        const draftDetailed = {
          customer: detailed.customer,
          rows: detailed.items.map(item => ({
            productId: item.productId,
            name: item.product?.name || '',
            sku: item.product?.sku || '',
            hsn: item.product?.hsn || '',
            qty: parseFloat(item.qty),
            rate: parseFloat(item.rate),
            discount: parseFloat(item.discount),
            gstPercent: parseFloat(item.gstPercent),
            total: parseFloat(item.total)
          })),
          paymentMode: detailed.paymentMode,
          billType: detailed.billType
        };
        localStorage.setItem('invoice_draft', JSON.stringify(draftDetailed));
        localStorage.setItem('editing_invoice_id', detailed.id);
        localStorage.setItem('editing_invoice_no', detailed.invoiceNo);
        navigate('billing');
      }).catch(() => {
        alert('Failed to retrieve items for edit.');
      });
      return;
    }

    localStorage.setItem('invoice_draft', JSON.stringify(draftData));
    localStorage.setItem('editing_invoice_id', inv.id);
    localStorage.setItem('editing_invoice_no', inv.invoiceNo);
    navigate('billing');
  };

  // Client-side filtration for search queries (InvoiceNo, CustomerName, Mobile)
  const filteredInvoices = invoices.filter(inv => {
    const numMatch = inv.invoiceNo.toLowerCase().includes(searchQuery.toLowerCase());
    const nameMatch = inv.customer ? inv.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) : false;
    const mobMatch = inv.customer && inv.customer.mobile ? inv.customer.mobile.includes(searchQuery) : false;
    return numMatch || nameMatch || mobMatch;
  });

  // Calculate Metrics from filtered list
  const calculateMetrics = () => {
    let salesTotal = 0;
    let receivedTotal = 0;
    let outstandingTotal = 0;
    let cancelledCount = 0;

    filteredInvoices.forEach(inv => {
      if (inv.status === 'Cancelled') {
        cancelledCount += 1;
      } else {
        const totalAmt = parseFloat(inv.grandTotal) || 0;
        salesTotal += totalAmt;
        if (inv.status === 'Paid') {
          receivedTotal += totalAmt;
        } else {
          outstandingTotal += totalAmt;
        }
      }
    });

    return { salesTotal, receivedTotal, outstandingTotal, cancelledCount };
  };

  const metrics = calculateMetrics();

  // CSV Export Utility
  const handleExportCSV = () => {
    const headers = ['Invoice No', 'Date', 'Customer', 'Subtotal (INR)', 'CGST', 'SGST', 'IGST', 'Grand Total', 'Payment Mode', 'Status'];
    const rows = filteredInvoices.map(inv => [
      inv.invoiceNo,
      new Date(inv.date).toLocaleString('en-IN'),
      inv.customer ? inv.customer.name : 'Cash Sale',
      inv.subtotal,
      inv.cgst,
      inv.sgst,
      inv.igst,
      inv.grandTotal,
      inv.paymentMode,
      inv.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sales_history_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Page Title & CSV Export */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Sales Invoice History</h1>
          <p className={`text-xs ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>Search, filter, edit, cancel, and manage all billing records.</p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={loading || filteredInvoices.length === 0}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
            theme === 'dark'
              ? 'border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-zinc-300'
              : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-zinc-700 font-bold'
          }`}
        >
          <Download className="h-4 w-4 text-blue-400" /> Export CSV List
        </button>
      </div>

      {/* Summary Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-5 rounded-2xl border ${theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">Total Active Sales</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black mt-3 leading-none tracking-tight">₹{metrics.salesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>

        <div className={`p-5 rounded-2xl border ${theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">Revenue Received</span>
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500">
              <IndianRupee className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black mt-3 leading-none tracking-tight">₹{metrics.receivedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>

        <div className={`p-5 rounded-2xl border ${theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">Outstanding Receivables</span>
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black mt-3 leading-none tracking-tight">₹{metrics.outstandingTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>

        <div className={`p-5 rounded-2xl border ${theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">Cancelled Invoices</span>
            <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
              <XOctagon className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black mt-3 leading-none tracking-tight">{metrics.cancelledCount} Bills</div>
        </div>
      </div>

      {/* Date and Query Filters Panel */}
      <div className={`p-4 rounded-2xl border grid grid-cols-1 lg:grid-cols-12 gap-4 ${
        theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        {/* Instant text search */}
        <div className="lg:col-span-4 relative">
          <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 opacity-70">Search Invoice Ledger</label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Invoice no, Customer name, Mobile..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full p-2 pl-10 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
              }`}
            />
          </div>
        </div>

        {/* Status filter */}
        <div className="lg:col-span-2">
          <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 opacity-70">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
              theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
            }`}
          >
            <option value="All">All Invoices</option>
            <option value="Paid">Paid</option>
            <option value="Unpaid">Unpaid / Credit</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        {/* Payment mode filter */}
        <div className="lg:col-span-2">
          <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 opacity-70">Payment Mode</label>
          <select
            value={paymentModeFilter}
            onChange={(e) => setPaymentModeFilter(e.target.value)}
            className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
              theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
            }`}
          >
            <option value="All">All Modes</option>
            <option value="Cash">Cash</option>
            <option value="UPI">UPI</option>
            <option value="Card">Card</option>
            <option value="Credit">Credit / Due</option>
            <option value="Bank Transfer">Bank Transfer</option>
          </select>
        </div>

        {/* Start Date */}
        <div className="lg:col-span-2">
          <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 opacity-70">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
              theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
            }`}
          />
        </div>

        {/* End Date */}
        <div className="lg:col-span-2">
          <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 opacity-70">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
              theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
            }`}
          />
        </div>
      </div>

      {/* Main Table List */}
      <div className={`rounded-2xl border overflow-hidden max-h-[550px] overflow-y-auto ${
        theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        {loading ? (
          <div className="py-20 text-center text-xs">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-500 mb-2" />
            Loading invoices data...
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-500 flex items-center justify-center gap-2">
            <AlertTriangle className="h-5 w-5" /> {error}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className={`border-b ${theme === 'dark' ? 'border-zinc-800 text-zinc-400' : 'border-slate-100 text-zinc-500'}`}>
                  <th className="py-3.5 px-4 font-bold uppercase">Invoice No</th>
                  <th className="py-3.5 px-4 font-bold uppercase">Date & Time</th>
                  <th className="py-3.5 px-4 font-bold uppercase">Customer</th>
                  <th className="py-3.5 px-4 font-bold uppercase text-right">Subtotal</th>
                  <th className="py-3.5 px-4 font-bold uppercase text-right">Tax (GST)</th>
                  <th className="py-3.5 px-4 font-bold uppercase text-right">Total Amount</th>
                  <th className="py-3.5 px-4 font-bold uppercase">Payment Mode</th>
                  <th className="py-3.5 px-4 font-bold uppercase">Status</th>
                  <th className="py-3.5 px-4 font-bold uppercase text-center">Action Options</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/20">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-12 text-center opacity-60">No invoices match the selected filters.</td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => {
                    const totalTax = (parseFloat(inv.cgst) || 0) + (parseFloat(inv.sgst) || 0) + (parseFloat(inv.igst) || 0);
                    return (
                      <tr 
                        key={inv.id} 
                        className={`transition-colors ${
                          inv.status === 'Cancelled'
                            ? 'opacity-60 bg-red-500/5'
                            : theme === 'dark' ? 'hover:bg-zinc-900/30' : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* Clickable Invoice No */}
                        <td className="py-3 px-4 font-mono font-bold text-emerald-500">
                          <button
                            onClick={() => navigate('invoice-view', inv.id)}
                            className="hover:underline hover:text-emerald-450 cursor-pointer font-bold"
                          >
                            {inv.invoiceNo}
                          </button>
                        </td>

                        {/* Date */}
                        <td className="py-3 px-4 font-mono text-zinc-400">
                          {new Date(inv.date).toLocaleString('en-IN')}
                        </td>

                        {/* Customer */}
                        <td className="py-3 px-4">
                          <div className="font-bold">{inv.customer ? inv.customer.name : 'Cash Sale'}</div>
                          {inv.customer?.mobile && (
                            <div className="text-[10px] opacity-60 font-mono mt-0.5">{inv.customer.mobile}</div>
                          )}
                        </td>

                        {/* Subtotal */}
                        <td className="py-3 px-4 text-right font-mono">₹{parseFloat(inv.subtotal).toFixed(2)}</td>

                        {/* GST Tax */}
                        <td className="py-3 px-4 text-right font-mono text-zinc-500">₹{totalTax.toFixed(2)}</td>

                        {/* Grand Total */}
                        <td className="py-3 px-4 text-right font-mono font-bold">₹{parseFloat(inv.grandTotal).toFixed(2)}</td>

                        {/* Payment Mode */}
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                            inv.paymentMode === 'Credit' 
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                              : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          }`}>
                            {inv.paymentMode}
                          </span>
                        </td>

                        {/* Payment Status Dropdown Selector */}
                        <td className="py-3 px-4">
                          {inv.status === 'Cancelled' ? (
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-500 border border-zinc-700 line-through">
                              Cancelled
                            </span>
                          ) : (
                            <select
                              value={inv.status}
                              onChange={(e) => handleUpdateStatus(inv.id, e.target.value, inv.paymentMode)}
                              className={`p-1 rounded text-[10px] font-bold outline-none border focus:border-emerald-500 cursor-pointer ${
                                inv.status === 'Paid'
                                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                  : 'bg-red-500/10 text-red-500 border-red-500/20'
                              }`}
                            >
                              <option value="Paid" className={theme === 'dark' ? 'bg-zinc-950 text-white' : 'bg-white text-zinc-950'}>Paid</option>
                              <option value="Unpaid" className={theme === 'dark' ? 'bg-zinc-950 text-white' : 'bg-white text-zinc-950'}>Unpaid</option>
                            </select>
                          )}
                        </td>

                        {/* Row Action Buttons */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View button */}
                            <button
                              onClick={() => navigate('invoice-view', inv.id)}
                              className={`p-1.5 rounded-lg border hover:scale-105 active:scale-95 transition-all cursor-pointer ${
                                theme === 'dark' ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'border-slate-200 hover:bg-slate-100 text-zinc-600 hover:text-zinc-950'
                              }`}
                              title="View & Print Invoice"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </button>

                            {/* Edit button */}
                            {inv.status !== 'Cancelled' && (
                              <button
                                onClick={() => handleEditInvoice(inv)}
                                className={`p-1.5 rounded-lg border hover:scale-105 active:scale-95 transition-all cursor-pointer ${
                                  theme === 'dark' ? 'border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-amber-400' : 'border-slate-200 hover:bg-slate-100 text-zinc-600 hover:text-amber-600'
                                }`}
                                title="Edit Invoice Details"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {/* Cancel button */}
                            {inv.status !== 'Cancelled' && (
                              <button
                                onClick={() => handleCancelInvoice(inv.id, inv.invoiceNo)}
                                className={`p-1.5 rounded-lg border hover:scale-105 active:scale-95 transition-all cursor-pointer border-amber-500/10 hover:border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-500`}
                                title="Cancel Invoice (Restore Stock)"
                              >
                                <XOctagon className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {/* Delete button (Admin Only) */}
                            {user?.role === 'admin' && (
                              <button
                                onClick={() => handleDeleteInvoice(inv.id, inv.invoiceNo)}
                                className={`p-1.5 rounded-lg border hover:scale-105 active:scale-95 transition-all cursor-pointer border-red-500/20 hover:border-red-500/40 bg-red-500/5 hover:bg-red-500/15 text-red-400`}
                                title="Delete Invoice Record"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

export default SalesHistory;
