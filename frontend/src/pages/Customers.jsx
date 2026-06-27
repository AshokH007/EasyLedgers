import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Users, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  FileText, 
  X, 
  Loader2,
  AlertCircle,
  TrendingUp,
  MapPin,
  Phone,
  Mail,
  Receipt
} from 'lucide-react';

function Customers({ theme }) {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('add'); // 'add' or 'edit'
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  // Ledger Modal
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerData, setLedgerData] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/customers?search=${search}`);
      setCustomers(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch customers list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchCustomers();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const openAddForm = () => {
    setFormMode('add');
    setSelectedCustomer(null);
    setName('');
    setMobile('');
    setEmail('');
    setGstin('');
    setAddress('');
    setFormOpen(true);
  };

  const openEditForm = (cust) => {
    setFormMode('edit');
    setSelectedCustomer(cust);
    setName(cust.name);
    setMobile(cust.mobile || '');
    setEmail(cust.email || '');
    setGstin(cust.gstin || '');
    setAddress(cust.address || '');
    setFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) {
      setError('Customer name is required');
      return;
    }

    const payload = { name, mobile, email, gstin, address };

    try {
      if (formMode === 'add') {
        await api.post('/customers', payload);
        setSuccess('Customer profile added successfully!');
      } else {
        await api.put(`/customers/${selectedCustomer.id}`, payload);
        setSuccess('Customer profile updated successfully!');
      }
      setFormOpen(false);
      fetchCustomers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Error saving customer profile.');
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this customer record?')) return;
    try {
      await api.delete(`/customers/${id}`);
      setSuccess('Customer record removed successfully!');
      fetchCustomers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to delete customer. They may have active invoices.');
      setTimeout(() => setError(''), 4000);
    }
  };

  const viewLedger = async (cust) => {
    try {
      setLedgerLoading(true);
      setSelectedCustomer(cust);
      setLedgerOpen(true);
      const res = await api.get(`/customers/${cust.id}/ledger`);
      setLedgerData(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load customer ledger.');
      setLedgerOpen(false);
    } finally {
      setLedgerLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Alert Banners */}
      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-2xl text-sm font-semibold flex items-center gap-2">
          <span>✔</span> {success}
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl text-sm font-semibold flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Customer Accounts</h1>
          <p className={`text-xs ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>Manage customer database profiles, GSTIN registry, and ledger dues.</p>
        </div>
        <div>
          <button
            onClick={openAddForm}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-zinc-950 font-bold rounded-xl transition shadow-lg shadow-emerald-500/10 text-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add Customer
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
        theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-white border-slate-200'
      }`}>
        <Search className="h-4 w-4 text-zinc-400 shrink-0" />
        <input
          type="text"
          placeholder="Search customer by name, mobile, or GSTIN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent border-none outline-none w-full text-xs"
        />
      </div>

      {/* Customers Table List */}
      <div className={`rounded-2xl border overflow-hidden ${
        theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-white border-slate-200'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className={`border-b ${theme === 'dark' ? 'border-zinc-800 text-zinc-400' : 'border-slate-100 text-zinc-500'}`}>
                <th className="py-3 px-4 font-bold uppercase tracking-wider">Customer Name</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider">Mobile</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider">GSTIN</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider">Email</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider">Address</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider text-center">Ledger Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850/30">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-10 text-center font-medium">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-emerald-500 mb-2" />
                    Finding customers...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center opacity-60">No customers found.</td>
                </tr>
              ) : (
                customers.map((cust) => (
                  <tr 
                    key={cust.id}
                    className={`transition-colors ${
                      theme === 'dark' ? 'hover:bg-zinc-900/30' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 px-4 font-bold text-zinc-200">{cust.name}</td>
                    <td className="py-3 px-4 font-mono">{cust.mobile || '—'}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-emerald-500">{cust.gstin || '—'}</td>
                    <td className="py-3 px-4">{cust.email || '—'}</td>
                    <td className="py-3 px-4 truncate max-w-[200px]" title={cust.address}>{cust.address || '—'}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => viewLedger(cust)}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border hover:scale-105 active:scale-95 transition-all text-xs font-bold cursor-pointer ${
                            theme === 'dark'
                              ? 'border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-emerald-400'
                              : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-emerald-600'
                          }`}
                          title="View purchase ledger & history"
                        >
                          <Receipt className="h-3.5 w-3.5" /> Ledger
                        </button>
                        <button
                          onClick={() => openEditForm(cust)}
                          className={`p-1.5 rounded-lg border hover:scale-105 active:scale-95 transition-all text-zinc-400 hover:text-emerald-500 cursor-pointer ${
                            theme === 'dark' ? 'border-zinc-800 bg-zinc-900' : 'border-slate-200 bg-slate-50'
                          }`}
                          title="Edit details"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(cust.id)}
                          className={`p-1.5 rounded-lg border hover:scale-105 active:scale-95 transition-all text-zinc-400 hover:text-red-500 cursor-pointer ${
                            theme === 'dark' ? 'border-zinc-800 bg-zinc-900' : 'border-slate-200 bg-slate-50'
                          }`}
                          title="Delete customer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Customer Form Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setFormOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-xs" />
          
          <div className={`relative w-full max-w-md rounded-2xl border shadow-2xl p-6 transition-all ${
            theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-slate-200 text-zinc-900'
          }`}>
            <button 
              onClick={() => setFormOpen(false)} 
              className="absolute top-4 right-4 text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-base font-bold mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-500" />
              {formMode === 'add' ? 'Add Customer Account' : 'Edit Customer Details'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-80">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Baldev Singh Union"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                    theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-80">Mobile Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-80">GSTIN (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 06BBBBB2222B2Z2"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-80">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. baldev@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                    theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                  }`}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-80">Billing Address</label>
                <textarea
                  rows="3"
                  placeholder="Village / Area, District, State..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 resize-none ${
                    theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                  }`}
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-lg transition text-xs cursor-pointer shadow-lg shadow-emerald-500/10"
              >
                {formMode === 'add' ? 'Save Customer' : 'Apply Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Customer Ledger Drawer Modal */}
      {ledgerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
          <div onClick={() => setLedgerOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-xs" />
          
          <div className={`relative w-full max-w-2xl h-screen shadow-2xl p-6 transition-all overflow-y-auto flex flex-col ${
            theme === 'dark' ? 'bg-zinc-950 text-white border-l border-zinc-900' : 'bg-white text-zinc-900 border-l border-slate-200'
          }`}>
            <button 
              onClick={() => setLedgerOpen(false)} 
              className="absolute top-4 right-4 text-zinc-400 hover:text-white cursor-pointer p-1"
            >
              <X className="h-6 w-6" />
            </button>

            {ledgerLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mb-2" />
                <p className="text-sm font-semibold">Aggregating Ledger details...</p>
              </div>
            ) : ledgerData ? (
              <div className="flex-col h-full space-y-6">
                
                {/* Ledger Header */}
                <div>
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Customer Purchase Ledger</span>
                  <h2 className="text-xl font-bold tracking-tight mt-1">{ledgerData.customer.name}</h2>
                  
                  <div className={`mt-3 p-4 rounded-xl border grid grid-cols-3 gap-4 ${
                    theme === 'dark' ? 'bg-zinc-900/40 border-zinc-850' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div>
                      <div className={`text-[10px] font-semibold uppercase opacity-65`}>Total Purchased</div>
                      <div className="text-lg font-black text-emerald-500 mt-1">₹{ledgerData.totalPurchased.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className={`text-[10px] font-semibold uppercase opacity-65`}>Total Balance Due</div>
                      <div className={`text-lg font-black mt-1 ${ledgerData.totalOutstanding > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                        ₹{ledgerData.totalOutstanding.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className={`text-[10px] font-semibold uppercase opacity-65`}>Billing Limit</div>
                      <div className="text-lg font-black text-zinc-500 mt-1">Unlimited</div>
                    </div>
                  </div>
                </div>

                {/* Contact Profiles */}
                <div className="space-y-2 text-xs">
                  {ledgerData.customer.mobile && (
                    <div className="flex items-center gap-2 opacity-80"><Phone className="h-3.5 w-3.5 text-emerald-500" /> {ledgerData.customer.mobile}</div>
                  )}
                  {ledgerData.customer.email && (
                    <div className="flex items-center gap-2 opacity-80"><Mail className="h-3.5 w-3.5 text-emerald-500" /> {ledgerData.customer.email}</div>
                  )}
                  {ledgerData.customer.gstin && (
                    <div className="flex items-center gap-2 opacity-80"><TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> GSTIN: <span className="font-mono font-bold text-emerald-500">{ledgerData.customer.gstin}</span></div>
                  )}
                  {ledgerData.customer.address && (
                    <div className="flex items-start gap-2 opacity-80"><MapPin className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" /> <span className="leading-tight">{ledgerData.customer.address}</span></div>
                  )}
                </div>

                {/* Chronological Table List */}
                <div className="flex-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider border-b pb-2 mb-3 border-zinc-800">Transaction Bills</h3>
                  
                  <div className="space-y-3 overflow-y-auto max-h-[50vh] pr-2">
                    {ledgerData.ledger.length === 0 ? (
                      <p className="text-center py-6 opacity-60 text-xs">No billing history for this customer.</p>
                    ) : (
                      ledgerData.ledger.map((inv) => (
                        <div 
                          key={inv.id}
                          className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${
                            theme === 'dark' ? 'bg-zinc-900/30 border-zinc-850 hover:bg-zinc-900/60' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-emerald-500 font-mono text-xs">{inv.invoiceNo}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 ml-1 rounded ${
                                inv.billType === 'Credit' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}>{inv.billType} bill</span>
                            </div>
                            <div className="text-[10px] font-mono text-zinc-500 mt-1">{new Date(inv.date).toLocaleDateString('en-IN')}</div>
                          </div>
                          
                          <div className="text-right flex items-center gap-4">
                            <div>
                              <div className="font-black text-xs">₹{parseFloat(inv.grandTotal).toFixed(2)}</div>
                              <span className={`inline-block text-[9px] font-bold mt-1 px-1.5 py-0.2 rounded ${
                                inv.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : inv.status === 'Cancelled' ? 'bg-zinc-800 text-zinc-500 line-through border border-zinc-700' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                              }`}>{inv.status}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            ) : null}
          </div>
        </div>
      )}

    </div>
  );
}

export default Customers;
