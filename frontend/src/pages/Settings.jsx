import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { 
  Building, 
  Save, 
  Database, 
  Upload, 
  Trash2, 
  UserPlus, 
  Loader2, 
  AlertCircle,
  HelpCircle,
  Users
} from 'lucide-react';

function Settings({ user, theme }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Company Profile States
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [logo, setLogo] = useState(null);
  
  // Bank details
  const [bankName, setBankName] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [branch, setBranch] = useState('');
  const [invoiceTerms, setInvoiceTerms] = useState('');

  // User Administration (Admin only)
  const [usersList, setUsersList] = useState([]);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('staff');
  const [userActionLoading, setUserActionLoading] = useState(false);

  // File Inputs
  const logoInputRef = useRef(null);
  const backupInputRef = useRef(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/settings/company');
      const data = res.data;
      setName(data.name || '');
      setAddress(data.address || '');
      setGstin(data.gstin || '');
      setPhone(data.phone || '');
      setEmail(data.email || '');
      setLogo(data.logo || null);
      setBankName(data.bankName || '');
      setAccountNo(data.accountNo || '');
      setIfsc(data.ifsc || '');
      setBranch(data.branch || '');
      setInvoiceTerms(data.invoiceTerms || '');

      // Load users if admin
      if (user.role === 'admin') {
        const usersRes = await api.get('/auth/users');
        setUsersList(usersRes.data);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch settings from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const payload = {
      name, address, gstin, phone, email,
      bankName, accountNo, ifsc, branch, invoiceTerms
    };

    try {
      await api.put('/settings/company', payload);
      setSuccess('Company profile saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError('Failed to save company settings.');
    } finally {
      setLoading(false);
    }
  };

  // Logo upload
  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('logo', file);

    setLoading(true);
    setError('');

    try {
      const res = await api.post('/settings/company/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setLogo(res.data.logo);
      setSuccess('Logo uploaded successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to upload logo.');
    } finally {
      setLoading(false);
    }
  };

  // Backup download
  const handleBackup = async () => {
    try {
      const res = await api.get('/settings/backup', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `gst_biller_backup_${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      alert('Failed to generate backup.');
    }
  };

  // Restore upload
  const handleRestore = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.confirm('CRITICAL WARNING: Restoring this file will COMPLETELY overwrite all current products, customers, and invoices in your database. This action is irreversible. Do you want to proceed?')) {
      e.target.value = null;
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const backupData = JSON.parse(evt.target.result);
        await api.post('/settings/restore', { backupData });
        alert('Database restored successfully! Logging out to apply restored credentials.');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.reload();
      } catch (err) {
        console.error(err);
        alert('Failed to restore. Please ensure the file is a valid JSON backup exported from this software.');
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  // Create user (Admin only)
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUsername || !newEmail || !newPassword) return;

    setUserActionLoading(true);
    try {
      await api.post('/auth/register', {
        username: newUsername,
        email: newEmail,
        password: newPassword,
        role: newRole
      });
      setSuccess('User account created successfully!');
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('staff');
      
      // refresh user lists
      const usersRes = await api.get('/auth/users');
      setUsersList(usersRes.data);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create user account');
    } finally {
      setUserActionLoading(false);
    }
  };

  // Delete user (Admin only)
  const handleDeleteUser = async (id) => {
    if (!window.confirm('Delete this user account? They will lose server access.')) return;
    try {
      await api.delete(`/auth/users/${id}`);
      setSuccess('User account deleted.');
      setUsersList(usersList.filter(u => u.id !== id));
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete user');
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

      {/* Main Settings Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Company Settings (Left 2 cols) */}
        <div className={`lg:col-span-2 p-6 rounded-2xl border flex flex-col space-y-6 ${
          theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="border-b border-zinc-800 pb-3 flex justify-between items-center">
            <h2 className="font-bold text-sm uppercase tracking-wider text-emerald-500 flex items-center gap-1.5"><Building className="h-4.5 w-4.5" /> Company & Invoice Settings</h2>
          </div>

          <form onSubmit={handleSaveCompany} className="space-y-5">
            {/* Logo upload block */}
            <div className="flex items-center gap-4 border-b border-zinc-800/50 pb-4">
              <div className={`h-16 w-16 rounded-xl border flex items-center justify-center overflow-hidden ${
                theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-100 border-slate-200'
              }`}>
                {logo ? (
                  <img src={logo} alt="Company Logo" className="object-cover h-full w-full" />
                ) : (
                  <Building className="h-6 w-6 text-zinc-500" />
                )}
              </div>
              <div>
                <input 
                  type="file" 
                  ref={logoInputRef}
                  onChange={handleLogoUpload}
                  accept="image/*"
                  className="hidden" 
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current.click()}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    theme === 'dark' ? 'border-zinc-800 bg-zinc-950 hover:bg-zinc-800' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <Upload className="h-3.5 w-3.5 text-emerald-400" /> Upload Company Logo
                </button>
                <p className="text-[10px] text-zinc-500 mt-1">Recommended: Square format (PNG/JPEG), max 2MB.</p>
              </div>
            </div>

            {/* Profile Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">Company Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                    theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                  }`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">GSTIN / Tax ID</label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                    theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">Contact Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                    theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                  }`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                    theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">Company Location Address</label>
              <textarea
                rows="2"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 resize-none ${
                  theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                }`}
              />
            </div>

            {/* Bank details */}
            <div className="border-t border-zinc-800/50 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-500 mb-3">Bank Settlement Account</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">Bank Name</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">Account Number</label>
                  <input
                    type="text"
                    value={accountNo}
                    onChange={(e) => setAccountNo(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">IFSC Code</label>
                  <input
                    type="text"
                    value={ifsc}
                    onChange={(e) => setIfsc(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">IFSC Branch</label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Custom terms */}
            <div className="border-t border-zinc-800/50 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-500 mb-3">Custom Terms & Conditions</h3>
              <textarea
                rows="3"
                value={invoiceTerms}
                onChange={(e) => setInvoiceTerms(e.target.value)}
                className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 resize-none ${
                  theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-zinc-950 font-bold rounded-xl transition shadow-lg shadow-emerald-500/10 text-xs flex items-center justify-center gap-1 cursor-pointer"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Save Profile Details</>}
            </button>
          </form>
        </div>

        {/* Database backup/restore & user administration (Right 1 col) */}
        <div className="space-y-6">
          
          {/* Database Backup Restores */}
          {user.role === 'admin' && (
            <div className={`p-6 rounded-2xl border flex flex-col space-y-4 ${
              theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="border-b border-zinc-800 pb-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-emerald-500 flex items-center gap-1.5"><Database className="h-4 w-4" /> Backup & Restore</h3>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleBackup}
                  className="w-full py-2.5 rounded-lg border border-zinc-800 hover:border-emerald-500/30 bg-zinc-950 hover:bg-emerald-500/5 text-zinc-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Database className="h-4 w-4 text-emerald-400" /> Export Database Backup
                </button>

                <div>
                  <input 
                    type="file" 
                    ref={backupInputRef}
                    onChange={handleRestore}
                    accept=".json"
                    className="hidden" 
                  />
                  <button
                    onClick={() => backupInputRef.current.click()}
                    className="w-full py-2.5 rounded-lg border border-zinc-800 hover:border-red-500/30 bg-zinc-950 hover:bg-red-500/5 text-zinc-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="h-4 w-4 text-red-400" /> Upload Restore File
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* User management (Admin only) */}
          {user.role === 'admin' && (
            <div className={`p-6 rounded-2xl border flex flex-col space-y-4 ${
              theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="border-b border-zinc-800 pb-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-emerald-500 flex items-center gap-1.5"><Users className="h-4 w-4" /> Team Management</h3>
              </div>

              {/* User list */}
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {usersList.map(u => (
                  <div 
                    key={u.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-[11px] ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-850' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-zinc-200">{u.username} <span className="text-[9px] px-1 rounded bg-zinc-800 text-emerald-400 uppercase font-semibold">{u.role}</span></div>
                      <div className="text-[10px] text-zinc-500">{u.email}</div>
                    </div>
                    {u.id !== user.id && (
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="text-zinc-500 hover:text-red-400 p-1 cursor-pointer"
                        title="Delete user account"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Create User Form */}
              <form onSubmit={handleCreateUser} className="space-y-3 pt-3 border-t border-zinc-850">
                <div className="font-bold text-[10px] uppercase text-zinc-400 tracking-wide">Register New Account</div>
                
                <input
                  type="text"
                  required
                  placeholder="Username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className={`w-full p-2 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                    theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                  }`}
                />

                <input
                  type="email"
                  required
                  placeholder="Email Address"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className={`w-full p-2 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                    theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                  }`}
                />

                <input
                  type="password"
                  required
                  placeholder="Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`w-full p-2 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                    theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                  }`}
                />

                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className={`w-full p-2 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                    theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                  }`}
                >
                  <option value="staff">Staff role (Billing / Catalog access)</option>
                  <option value="admin">Admin role (Full administrative access)</option>
                </select>

                <button
                  type="submit"
                  disabled={userActionLoading}
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  {userActionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><UserPlus className="h-3.5 w-3.5" /> Create Team Account</>}
                </button>
              </form>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}

export default Settings;
