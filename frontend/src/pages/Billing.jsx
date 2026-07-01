import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { 
  Plus, 
  Trash2, 
  Search, 
  Save, 
  UserPlus, 
  PlusCircle, 
  Loader2, 
  AlertCircle,
  HelpCircle,
  FileSpreadsheet
} from 'lucide-react';

function Billing({ navigate, theme }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Loaded database items
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [company, setCompany] = useState(null);

  // Autocomplete suggestions
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustSuggestions, setShowCustSuggestions] = useState(false);
  const [productSearchInput, setProductSearchInput] = useState({}); // { rowIndex: text }
  const [showProdSuggestions, setShowProdSuggestions] = useState({}); // { rowIndex: bool }

  // Billing Form State
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [invoiceDate, setInvoiceDate] = useState(() => {
    const d = new Date();
    // Local date-time string matching YYYY-MM-DDTHH:MM
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().slice(0, 16);
  });
  
  const [rows, setRows] = useState([
    { productId: '', name: '', sku: '', hsn: '', qty: 1, rate: 0, discount: 0, gstPercent: 18, total: 0 }
  ]);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [billType, setBillType] = useState('Cash'); // Cash or Credit
  const [autoRoundOff, setAutoRoundOff] = useState(true);

  // Quick addition modals
  const [custModalOpen, setCustModalOpen] = useState(false);
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustMobile, setNewCustMobile] = useState('');
  const [newCustGstin, setNewCustGstin] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdSku, setNewProdSku] = useState('');
  const [newProdHsn, setNewProdHsn] = useState('');
  const [newProdGst, setNewProdGst] = useState('18');
  const [newProdPurchase, setNewProdPurchase] = useState('0');
  const [newProdSelling, setNewProdSelling] = useState('0');
  const [newProdStock, setNewProdStock] = useState('100');
  const [newProdUnit, setNewProdUnit] = useState('Pcs');

  // References for keyboard focus
  const customerInputRef = useRef(null);

  // Load baseline metadata
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [custRes, prodRes, compRes] = await Promise.all([
          api.get('/customers'),
          api.get('/products'),
          api.get('/settings/company')
        ]);
        setCustomers(custRes.data);
        setProducts(prodRes.data);
        setCompany(compRes.data);

        // Load local auto-save draft if exists
        const draft = localStorage.getItem('invoice_draft');
        if (draft) {
          try {
            const parsed = JSON.parse(draft);
            if (parsed.customer) {
              setSelectedCustomer(parsed.customer);
              setCustomerSearch(parsed.customer.name);
            }
            if (parsed.rows && parsed.rows.length > 0) {
              setRows(parsed.rows);
            }
            if (parsed.paymentMode) setPaymentMode(parsed.paymentMode);
            if (parsed.billType) setBillType(parsed.billType);
          } catch (e) {
            console.error('Draft load failed:', e);
          }
        }
      } catch (err) {
        console.error(err);
        setError('Failed to fetch master lookup lists (customers/products).');
      }
    };
    loadMetadata();
  }, []);

  // Auto-Save Draft to LocalStorage when form changes
  useEffect(() => {
    const draftData = {
      customer: selectedCustomer,
      rows,
      paymentMode,
      billType
    };
    localStorage.setItem('invoice_draft', JSON.stringify(draftData));
  }, [selectedCustomer, rows, paymentMode, billType]);

  // Keyboard Shortcuts (Tally-like)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setCustModalOpen(true);
      } else if (e.key === 'F4') {
        e.preventDefault();
        addRow();
      } else if (e.key === 'F8') {
        e.preventDefault();
        setBillType('Cash');
        setPaymentMode('Cash');
        submitInvoice('Paid');
      } else if (e.key === 'F9') {
        e.preventDefault();
        setBillType('Credit');
        setPaymentMode('Credit');
        submitInvoice('Unpaid');
      } else if (e.key === 'F10') {
        e.preventDefault();
        submitInvoice(null, true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCustomer, rows, paymentMode, billType, company]);

  const addRow = () => {
    setRows([...rows, { productId: '', name: '', sku: '', hsn: '', qty: 1, rate: 0, discount: 0, gstPercent: 18, total: 0 }]);
  };

  const removeRow = (index) => {
    if (rows.length === 1) return;
    const nextRows = rows.filter((_, idx) => idx !== index);
    setRows(nextRows);
  };

  const updateRowField = (index, field, val) => {
    const nextRows = [...rows];
    nextRows[index][field] = val;

    // Recalculate row totals
    const qty = parseFloat(nextRows[index].qty) || 0;
    const rate = parseFloat(nextRows[index].rate) || 0;
    const discount = parseFloat(nextRows[index].discount) || 0;
    const gstPercent = parseFloat(nextRows[index].gstPercent) || 0;

    // Row total = (qty * rate - discount) * (1 + gstPercent / 100)
    const baseVal = (qty * rate) - discount;
    const taxVal = baseVal * (gstPercent / 100);
    nextRows[index].total = Math.max(0, baseVal + taxVal);

    setRows(nextRows);
  };

  const selectProduct = (index, prod) => {
    const nextRows = [...rows];
    nextRows[index].productId = prod.id;
    nextRows[index].name = prod.name;
    nextRows[index].sku = prod.sku;
    nextRows[index].hsn = prod.hsn;
    nextRows[index].rate = parseFloat(prod.sellingPrice);
    nextRows[index].gstPercent = parseFloat(prod.gstPercent);
    
    // Calculate total
    const qty = parseFloat(nextRows[index].qty) || 0;
    const rate = parseFloat(nextRows[index].rate) || 0;
    const discount = parseFloat(nextRows[index].discount) || 0;
    const gstPercent = parseFloat(nextRows[index].gstPercent) || 0;
    const baseVal = (qty * rate) - discount;
    nextRows[index].total = baseVal + (baseVal * (gstPercent / 100));

    setRows(nextRows);
    setProductSearchInput({ ...productSearchInput, [index]: prod.name });
    setShowProdSuggestions({ ...showProdSuggestions, [index]: false });
  };

  // Autocomplete logic for Customers
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
    (c.mobile && c.mobile.includes(customerSearch))
  );

  const selectCustomer = (cust) => {
    setSelectedCustomer(cust);
    setCustomerSearch(cust.name);
    setShowCustSuggestions(false);
    // If customer has outstanding, change mode to Credit
    if (cust.gstin) {
      // compare states to assist user
      const companyState = company?.gstin ? company.gstin.substring(0,2) : '';
      const customerState = cust.gstin.substring(0,2);
      if (companyState && customerState && companyState !== customerState) {
        setSuccess(`Interstate customer detected (State prefix: ${customerState}). IGST tax mapping applied.`);
        setTimeout(() => setSuccess(''), 4000);
      }
    }
  };

  // Calculations
  const calculateTotals = () => {
    let subtotal = 0;
    let totalDiscount = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    // Check company and customer states to verify CGST/SGST vs IGST
    const companyState = company?.gstin ? company.gstin.substring(0, 2) : '06'; // default Haryana
    const customerState = selectedCustomer?.gstin ? selectedCustomer.gstin.substring(0, 2) : companyState;
    const isInterstate = companyState !== customerState;

    rows.forEach(r => {
      const qty = parseFloat(r.qty) || 0;
      const rate = parseFloat(r.rate) || 0;
      const discount = parseFloat(r.discount) || 0;
      const gstPercent = parseFloat(r.gstPercent) || 0;

      const taxableValue = (qty * rate) - discount;
      const taxAmount = taxableValue * (gstPercent / 100);

      subtotal += taxableValue;
      totalDiscount += discount;

      if (isInterstate) {
        igst += taxAmount;
      } else {
        cgst += taxAmount / 2;
        sgst += taxAmount / 2;
      }
    });

    const sum = subtotal + cgst + sgst + igst;
    let rounded = sum;
    let roundOff = 0;

    if (autoRoundOff) {
      rounded = Math.round(sum);
      roundOff = rounded - sum;
    }

    return {
      subtotal,
      discount: totalDiscount,
      cgst,
      sgst,
      igst,
      roundOff,
      grandTotal: rounded
    };
  };

  const totals = calculateTotals();

  const submitInvoice = async (forcedStatus = null, isSaveAndNext = false) => {
    if (rows.some(r => !r.productId)) {
      alert('Please select a valid product for all rows.');
      return;
    }

    setLoading(true);
    setError('');

    const invoiceStatus = forcedStatus || (billType === 'Credit' ? 'Unpaid' : 'Paid');

    const payload = {
      customerId: selectedCustomer ? selectedCustomer.id : null,
      date: new Date(invoiceDate),
      items: rows.map(r => ({
        productId: r.productId,
        qty: parseFloat(r.qty),
        rate: parseFloat(r.rate),
        discount: parseFloat(r.discount),
        gstPercent: parseFloat(r.gstPercent),
        total: parseFloat(r.total)
      })),
      subtotal: totals.subtotal,
      discount: totals.discount,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      roundOff: totals.roundOff,
      grandTotal: totals.grandTotal,
      paymentMode: billType === 'Credit' ? 'Credit' : paymentMode,
      billType,
      status: invoiceStatus,
    };

    try {
      const res = await api.post('/invoices', payload);
      // Clear draft
      localStorage.removeItem('invoice_draft');
      
      if (isSaveAndNext) {
        setSuccess(`Invoice #${res.data.invoiceNo} saved successfully! Starting next billing.`);
        // Reset billing form state
        setSelectedCustomer(null);
        setCustomerSearch('');
        setRows([{ productId: '', name: '', sku: '', hsn: '', qty: 1, rate: 0, discount: 0, gstPercent: 18, total: 0 }]);
        setProductSearchInput({});
        setShowProdSuggestions({});
        setInvoiceDate(() => {
          const d = new Date();
          const offset = d.getTimezoneOffset();
          const localDate = new Date(d.getTime() - (offset * 60 * 1000));
          return localDate.toISOString().slice(0, 16);
        });
        setPaymentMode('Cash');
        setBillType('Cash');

        // Focus back to customer input
        setTimeout(() => {
          if (customerInputRef.current) {
            customerInputRef.current.focus();
          }
        }, 100);

        setTimeout(() => setSuccess(''), 4000);
      } else {
        // Redirect to invoice print view
        navigate('invoice-view', res.data.id);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Error occurred while saving invoice.');
    } finally {
      setLoading(false);
    }
  };

  // Quick Customer Creation
  const handleQuickCustomer = async (e) => {
    e.preventDefault();
    if (!newCustName) return;
    try {
      const res = await api.post('/customers', {
        name: newCustName,
        mobile: newCustMobile,
        gstin: newCustGstin,
        address: newCustAddress
      });
      // Add to list and select automatically
      setCustomers([...customers, res.data]);
      setSelectedCustomer(res.data);
      setCustomerSearch(res.data.name);
      setCustModalOpen(false);
      
      // Reset
      setNewCustName('');
      setNewCustMobile('');
      setNewCustGstin('');
      setNewCustAddress('');
      setSuccess('Quick Customer created & selected!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving customer');
    }
  };

  // Quick Product Creation
  const handleQuickProduct = async (e) => {
    e.preventDefault();
    if (!newProdName || !newProdSelling) return;
    try {
      const res = await api.post('/products', {
        name: newProdName,
        sku: newProdSku || undefined,
        hsn: newProdHsn || undefined,
        gstPercent: parseFloat(newProdGst) || 18,
        purchasePrice: parseFloat(newProdPurchase) || 0,
        sellingPrice: parseFloat(newProdSelling) || 0,
        stockQty: parseFloat(newProdStock) || 0,
        unit: newProdUnit
      });

      setProducts([...products, res.data]);
      setProdModalOpen(false);

      // Reset
      setNewProdName('');
      setNewProdSku('');
      setNewProdHsn('');
      setNewProdSelling('0');
      setNewProdStock('100');
      setSuccess('Quick Product created successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating product');
    }
  };

  const clearForm = () => {
    if (!window.confirm('Clear all fields? Draft auto-save will be wiped.')) return;
    setSelectedCustomer(null);
    setCustomerSearch('');
    setRows([{ productId: '', name: '', sku: '', hsn: '', qty: 1, rate: 0, discount: 0, gstPercent: 18, total: 0 }]);
    localStorage.removeItem('invoice_draft');
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

      {/* Shortcuts Help Bar */}
      <div className={`p-3 rounded-xl border flex flex-wrap items-center justify-between text-[11px] font-bold ${
        theme === 'dark' ? 'bg-zinc-900/60 border-zinc-800/80 text-zinc-400' : 'bg-white border-slate-200 text-zinc-600'
      }`}>
        <div className="flex items-center gap-1.5"><HelpCircle className="h-4 w-4 text-emerald-500" /> Keyboard Shortcuts:</div>
        <div className="flex flex-wrap gap-4">
          <div><kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono border border-zinc-700">F2</kbd> Add Customer</div>
          <div><kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono border border-zinc-700">F4</kbd> Add Row</div>
          <div><kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono border border-zinc-700">F8</kbd> Cash Invoice</div>
          <div><kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono border border-zinc-700">F9</kbd> Credit Invoice</div>
          <div><kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono border border-zinc-700">F10</kbd> Save & Next</div>
        </div>
      </div>

      {/* Main Billing Card Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Invoice Items details (Left 2 cols) */}
        <div className={`lg:col-span-2 p-6 rounded-2xl border flex flex-col space-y-6 ${
          theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h2 className="font-bold text-sm uppercase tracking-wider text-emerald-500">Sales Billing Items</h2>
            <div className="flex items-center gap-2">
              <button 
                onClick={clearForm}
                className="text-[10px] text-zinc-400 hover:text-red-500 font-bold border border-zinc-800 rounded px-2.5 py-1 cursor-pointer hover:bg-zinc-800/30"
              >
                Clear Form
              </button>
            </div>
          </div>

          {/* Customer & Date Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Customer Search Autocomplete */}
            <div className="relative">
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">Customer Profile *</label>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                  <input
                    type="text"
                    ref={customerInputRef}
                    placeholder="Search customer by name..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustSuggestions(true);
                      if (selectedCustomer) setSelectedCustomer(null);
                    }}
                    onFocus={() => setShowCustSuggestions(true)}
                    className={`w-full p-2 pl-9 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                    }`}
                  />
                  {showCustSuggestions && customerSearch && (
                    <div className={`absolute z-35 left-0 right-0 mt-1 rounded-xl border shadow-2xl max-h-40 overflow-y-auto ${
                      theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'
                    }`}>
                      {filteredCustomers.length === 0 ? (
                        <div className="p-3 text-xs opacity-60">No customers found.</div>
                      ) : (
                        filteredCustomers.map(c => (
                          <div
                            key={c.id}
                            onClick={() => selectCustomer(c)}
                            className={`p-2.5 text-xs font-semibold cursor-pointer border-b last:border-0 ${
                              theme === 'dark' ? 'border-zinc-850 hover:bg-zinc-800' : 'border-slate-100 hover:bg-slate-50'
                            }`}
                          >
                            <div className="font-bold">{c.name}</div>
                            {c.mobile && <div className="text-[10px] opacity-60 font-mono mt-0.5">{c.mobile} | {c.gstin || 'No GSTIN'}</div>}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setCustModalOpen(true)}
                  className={`p-2 rounded-lg border hover:scale-105 active:scale-95 transition-all text-emerald-400 border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 cursor-pointer`}
                  title="Add new customer profile shortcut"
                >
                  <UserPlus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Date Picker */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">Invoice Date & Time</label>
              <input
                type="datetime-local"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className={`w-full p-2 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                  theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                }`}
              />
            </div>
          </div>

          {/* Dynamic Invoice Item Rows */}
          <div className="space-y-3 flex-1 overflow-x-auto min-w-[500px]">
            <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-wider opacity-60 border-b border-zinc-800 pb-2">
              <div className="col-span-5">Product SKU Item</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-2 text-right">Rate (₹)</div>
              <div className="col-span-2 text-right">Discount (₹)</div>
              <div className="col-span-1 text-center">Action</div>
            </div>

            {rows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center relative">
                {/* Autocomplete Product Search */}
                <div className="col-span-5 relative">
                  <input
                    type="text"
                    placeholder="Search product..."
                    value={productSearchInput[idx] !== undefined ? productSearchInput[idx] : row.name}
                    onChange={(e) => {
                      const text = e.target.value;
                      setProductSearchInput({ ...productSearchInput, [idx]: text });
                      setShowProdSuggestions({ ...showProdSuggestions, [idx]: true });
                      
                      const updated = [...rows];
                      updated[idx].productId = '';
                      setRows(updated);
                    }}
                    onFocus={() => setShowProdSuggestions({ ...showProdSuggestions, [idx]: true })}
                    className={`w-full p-2 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                    }`}
                  />
                  {showProdSuggestions[idx] && (productSearchInput[idx] || row.name) && (
                    <div className={`absolute z-30 left-0 right-0 mt-1 rounded-xl border shadow-2xl max-h-40 overflow-y-auto ${
                      theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-slate-200'
                    }`}>
                      {products.filter(p => p.name.toLowerCase().includes((productSearchInput[idx] || '').toLowerCase()) || (p.sku && p.sku.toLowerCase().includes((productSearchInput[idx] || '').toLowerCase()))).length === 0 ? (
                        <div className="p-3 text-xs opacity-60">No items found.</div>
                      ) : (
                        products.filter(p => p.name.toLowerCase().includes((productSearchInput[idx] || '').toLowerCase()) || (p.sku && p.sku.toLowerCase().includes((productSearchInput[idx] || '').toLowerCase()))).map(p => (
                          <div
                            key={p.id}
                            onClick={() => selectProduct(idx, p)}
                            className={`p-2.5 text-xs font-semibold cursor-pointer border-b last:border-0 ${
                              theme === 'dark' ? 'border-zinc-850 hover:bg-zinc-800' : 'border-slate-100 hover:bg-slate-50'
                            }`}
                          >
                            <div className="font-bold flex items-center justify-between">
                              <span>{p.name}</span>
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1 rounded">{p.stockQty} {p.unit}</span>
                            </div>
                            <div className="text-[10px] opacity-60 font-mono mt-0.5">Rate: ₹{p.sellingPrice} | HSN: {p.hsn} | GST: {parseFloat(p.gstPercent)}%</div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Quantity */}
                <div className="col-span-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={row.qty}
                    onChange={(e) => updateRowField(idx, 'qty', e.target.value)}
                    className={`w-full p-2 text-right rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                    }`}
                  />
                </div>

                {/* Rate */}
                <div className="col-span-2">
                  <input
                    type="number"
                    step="0.01"
                    value={row.rate}
                    onChange={(e) => updateRowField(idx, 'rate', e.target.value)}
                    className={`w-full p-2 text-right rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                    }`}
                  />
                </div>

                {/* Discount */}
                <div className="col-span-2">
                  <input
                    type="number"
                    step="0.01"
                    value={row.discount}
                    onChange={(e) => updateRowField(idx, 'discount', e.target.value)}
                    placeholder="0"
                    className={`w-full p-2 text-right rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                    }`}
                  />
                </div>

                {/* Delete button */}
                <div className="col-span-1 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    disabled={rows.length === 1}
                    className={`p-2 rounded-lg border hover:scale-105 active:scale-95 transition-all cursor-pointer ${
                      rows.length === 1 
                        ? 'opacity-40 border-zinc-800 text-zinc-600' 
                        : 'border-zinc-800 hover:border-red-500 bg-zinc-900/60 hover:bg-red-500/10 text-zinc-400 hover:text-red-500'
                    }`}
                    title="Remove item row"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
            <button
              type="button"
              onClick={addRow}
              className={`flex items-center gap-1 px-4 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                theme === 'dark'
                  ? 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-zinc-700'
              }`}
            >
              <PlusCircle className="h-4 w-4 text-emerald-500" /> Add Product Row
            </button>
            <button
              type="button"
              onClick={() => setProdModalOpen(true)}
              className={`flex items-center gap-1 px-4 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                theme === 'dark'
                  ? 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 text-emerald-400'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-emerald-600'
              }`}
            >
              <Plus className="h-4 w-4 text-emerald-500" /> Quick Add Product
            </button>
          </div>
        </div>

        {/* Calculations / Summary (Right 1 col) */}
        <div className={`p-6 rounded-2xl border flex flex-col justify-between ${
          theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="space-y-6">
            <div className="border-b border-zinc-800 pb-3">
              <h2 className="font-bold text-sm uppercase tracking-wider text-emerald-500">Invoice Calculations</h2>
              <p className="text-[10px] opacity-60 mt-1">Configure cash/credit rules and finalize invoice.</p>
            </div>

            {/* Bill Type & Payments Selection */}
            <div className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 opacity-70">Billing Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setBillType('Cash'); setPaymentMode('Cash'); }}
                    className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      billType === 'Cash' 
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-sm' 
                        : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:bg-zinc-800/80'
                    }`}
                  >
                    Cash Bill
                  </button>
                  <button
                    type="button"
                    onClick={() => { setBillType('Credit'); setPaymentMode('Credit'); }}
                    className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      billType === 'Credit' 
                        ? 'border-amber-500 bg-amber-500/10 text-amber-500 shadow-sm' 
                        : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:bg-zinc-800/80'
                    }`}
                  >
                    Credit / Outstanding
                  </button>
                </div>
              </div>

              {billType === 'Cash' && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 opacity-70">Payment Method</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                    }`}
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="Card">Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              )}
            </div>

            {/* Calculations Breakdown */}
            <div className={`p-4 rounded-xl border space-y-2.5 text-xs ${
              theme === 'dark' ? 'bg-zinc-950/40 border-zinc-850' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className="opacity-70">Subtotal Value:</span>
                <span className="font-mono font-bold">₹{totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span className="opacity-70">Discount Allowed:</span>
                <span className="font-mono font-semibold">₹{totals.discount.toFixed(2)}</span>
              </div>
              
              {totals.igst > 0 ? (
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="opacity-70">IGST Tax Collected:</span>
                  <span className="font-mono font-semibold">₹{totals.igst.toFixed(2)}</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="opacity-70">CGST Tax (Central):</span>
                    <span className="font-mono font-semibold">₹{totals.cgst.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-400">
                    <span className="opacity-70">SGST Tax (State):</span>
                    <span className="font-mono font-semibold">₹{totals.sgst.toFixed(2)}</span>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between border-t border-zinc-800 pt-2 text-zinc-400">
                <label className="flex items-center gap-1.5 opacity-70 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRoundOff}
                    onChange={(e) => setAutoRoundOff(e.target.checked)}
                    className="accent-emerald-500"
                  />
                  Auto Round-off:
                </label>
                <span className="font-mono font-semibold">₹{totals.roundOff.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between border-t border-zinc-800 pt-2.5 text-sm font-black">
                <span className="text-emerald-500">Grand Total:</span>
                <span className="font-mono text-emerald-500 text-base">₹{totals.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={() => submitInvoice()}
              disabled={loading}
              className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-lg cursor-pointer ${
                billType === 'Credit' 
                  ? 'bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-amber-500/10' 
                  : 'bg-emerald-500 hover:bg-emerald-600 text-zinc-950 shadow-emerald-500/10'
              }`}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Save className="h-4 w-4" /> 
                  {billType === 'Credit' ? 'Save Outstanding Bill' : 'Print Cash Receipt'}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => submitInvoice(null, true)}
              disabled={loading}
              className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition border shadow-md cursor-pointer ${
                theme === 'dark'
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700 hover:border-zinc-600'
                  : 'bg-slate-100 hover:bg-slate-200 text-zinc-850 border-slate-250 hover:border-slate-300'
              }`}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4 text-emerald-500" /> 
                  Save & Next Bill (F10)
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Quick Customer Creation Modal */}
      {custModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setCustModalOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-xs" />
          <div className={`relative w-full max-w-md rounded-2xl border shadow-2xl p-6 transition-all ${
            theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-slate-200 text-zinc-900'
          }`}>
            <h3 className="font-bold text-sm uppercase tracking-wider text-emerald-500 mb-4 flex items-center gap-1.5"><UserPlus className="h-4 w-4" /> Quick Customer Creation</h3>
            <form onSubmit={handleQuickCustomer} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider mb-1 opacity-75">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Baldev Farmers"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className={`w-full p-2 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                    theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                  }`}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider mb-1 opacity-75">Mobile</label>
                  <input
                    type="text"
                    placeholder="e.g. 9988776655"
                    value={newCustMobile}
                    onChange={(e) => setNewCustMobile(e.target.value)}
                    className={`w-full p-2 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider mb-1 opacity-75">GSTIN</label>
                  <input
                    type="text"
                    placeholder="e.g. 06BBBBB2222B2Z2"
                    value={newCustGstin}
                    onChange={(e) => setNewCustGstin(e.target.value)}
                    className={`w-full p-2 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                    }`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider mb-1 opacity-75">Address</label>
                <textarea
                  rows="2"
                  placeholder="Address..."
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  className={`w-full p-2 rounded-lg border text-xs outline-none focus:border-emerald-500 resize-none ${
                    theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                  }`}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCustModalOpen(false)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border text-center ${
                    theme === 'dark' ? 'border-zinc-800 hover:bg-zinc-800' : 'border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-lg text-xs"
                >
                  Create & Select
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Product Creation Modal */}
      {prodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setProdModalOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-xs" />
          <div className={`relative w-full max-w-md rounded-2xl border shadow-2xl p-6 transition-all ${
            theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-slate-200 text-zinc-900'
          }`}>
            <h3 className="font-bold text-sm uppercase tracking-wider text-emerald-500 mb-4 flex items-center gap-1.5"><PlusCircle className="h-4 w-4" /> Quick Product Creation</h3>
            <form onSubmit={handleQuickProduct} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider mb-1 opacity-75">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Zinc Spray (500ml)"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className={`w-full p-2 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                    theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                  }`}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider mb-1 opacity-75">SKU / Code</label>
                  <input
                    type="text"
                    placeholder="e.g. ZINC-500"
                    value={newProdSku}
                    onChange={(e) => setNewProdSku(e.target.value)}
                    className={`w-full p-2 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider mb-1 opacity-75">HSN Code</label>
                  <input
                    type="text"
                    placeholder="e.g. 38089000"
                    value={newProdHsn}
                    onChange={(e) => setNewProdHsn(e.target.value)}
                    className={`w-full p-2 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                    }`}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider mb-1 opacity-75">GST (%)</label>
                  <select
                    value={newProdGst}
                    onChange={(e) => setNewProdGst(e.target.value)}
                    className={`w-full p-2 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                    }`}
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider mb-1 opacity-75">Selling Rate *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newProdSelling}
                    onChange={(e) => setNewProdSelling(e.target.value)}
                    className={`w-full p-2 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider mb-1 opacity-75">Stock Qty</label>
                  <input
                    type="number"
                    value={newProdStock}
                    onChange={(e) => setNewProdStock(e.target.value)}
                    className={`w-full p-2 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                    }`}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setProdModalOpen(false)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border text-center ${
                    theme === 'dark' ? 'border-zinc-800 hover:bg-zinc-800' : 'border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-lg text-xs"
                >
                  Create Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default Billing;
