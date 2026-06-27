import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { 
  Package, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  FileSpreadsheet, 
  Upload, 
  X, 
  Loader2,
  AlertCircle
} from 'lucide-react';

function Products({ user, theme }) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form Fields
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [hsn, setHsn] = useState('');
  const [gstPercent, setGstPercent] = useState('18');
  const [purchasePrice, setPurchasePrice] = useState('0');
  const [sellingPrice, setSellingPrice] = useState('0');
  const [stockQty, setStockQty] = useState('0');
  const [unit, setUnit] = useState('Pcs');

  // File Upload Reference
  const fileInputRef = useRef(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/products?search=${search}`);
      setProducts(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to retrieve products list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce search slightly
    const delayDebounceFn = setTimeout(() => {
      fetchProducts();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const openAddModal = () => {
    setModalMode('add');
    setSelectedProduct(null);
    setName('');
    setSku('');
    setHsn('');
    setGstPercent('18');
    setPurchasePrice('0');
    setSellingPrice('0');
    setStockQty('0');
    setUnit('Pcs');
    setModalOpen(true);
  };

  const openEditModal = (prod) => {
    setModalMode('edit');
    setSelectedProduct(prod);
    setName(prod.name);
    setSku(prod.sku || '');
    setHsn(prod.hsn || '');
    setGstPercent(String(parseFloat(prod.gstPercent)));
    setPurchasePrice(String(parseFloat(prod.purchasePrice)));
    setSellingPrice(String(parseFloat(prod.sellingPrice)));
    setStockQty(String(parseFloat(prod.stockQty)));
    setUnit(prod.unit);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) {
      setError('Product Name is required');
      return;
    }

    const payload = {
      name,
      sku: sku || undefined,
      hsn: hsn || undefined,
      gstPercent: parseFloat(gstPercent) || 0,
      purchasePrice: parseFloat(purchasePrice) || 0,
      sellingPrice: parseFloat(sellingPrice) || 0,
      stockQty: parseFloat(stockQty) || 0,
      unit,
    };

    try {
      if (modalMode === 'add') {
        await api.post('/products', payload);
        setSuccess('Product created successfully!');
      } else {
        await api.put(`/products/${selectedProduct.id}`, payload);
        setSuccess('Product updated successfully!');
      }
      setModalOpen(false);
      fetchProducts();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Error occurred while saving product.');
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.delete(`/products/${id}`);
      setSuccess('Product deleted successfully!');
      fetchProducts();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to delete product. It may be linked to invoices.');
      setTimeout(() => setError(''), 4000);
    }
  };

  // Export products to CSV
  const handleExport = () => {
    if (products.length === 0) {
      alert('No products to export.');
      return;
    }
    const headers = ['Product Name', 'SKU', 'HSN Code', 'GST Percent', 'Purchase Price', 'Selling Price', 'Stock Quantity', 'Unit'];
    const rows = products.map(p => [
      `"${p.name.replace(/"/g, '""')}"`,
      `"${(p.sku || '').replace(/"/g, '""')}"`,
      `"${(p.hsn || '').replace(/"/g, '""')}"`,
      p.gstPercent,
      p.purchasePrice,
      p.sellingPrice,
      p.stockQty,
      `"${p.unit}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `products_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import products from CSV
  const handleImportClick = () => {
    fileInputRef.current.click();
  };

  const handleImportFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      try {
        const lines = text.split('\n');
        if (lines.length < 2) {
          alert('CSV file is empty or malformed.');
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
        const parsedProducts = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // Handle double quotes for strings with commas
          const values = [];
          let currentVal = '';
          let inQuotes = false;
          
          for (let c = 0; c < line.length; c++) {
            const char = line[c];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(currentVal.trim());
              currentVal = '';
            } else {
              currentVal += char;
            }
          }
          values.push(currentVal.trim());

          const row = {};
          headers.forEach((header, idx) => {
            row[header] = values[idx] || '';
          });

          // Match columns
          const prodName = row['product name'] || row['name'] || '';
          if (!prodName) continue;

          parsedProducts.push({
            name: prodName,
            sku: row['sku'] || row['code'] || '',
            hsn: row['hsn code'] || row['hsn'] || '',
            gstPercent: parseFloat(row['gst percent'] || row['gst']) || 18,
            purchasePrice: parseFloat(row['purchase price'] || row['purchase']) || 0,
            sellingPrice: parseFloat(row['selling price'] || row['selling']) || 0,
            stockQty: parseFloat(row['stock quantity'] || row['stock']) || 0,
            unit: row['unit'] || 'Pcs'
          });
        }

        if (parsedProducts.length === 0) {
          alert('No valid products parsed from CSV.');
          return;
        }

        setLoading(true);
        const res = await api.post('/products/import', { products: parsedProducts });
        alert(`Import complete! ${res.data.createdCount} new products created, ${res.data.updatedCount} existing products updated.`);
        fetchProducts();
      } catch (err) {
        console.error(err);
        alert('Failed to parse CSV file. Ensure format matches requirements.');
        setLoading(false);
      }
    };
    reader.readAsText(file);
    // Reset file input value
    e.target.value = null;
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
          <h1 className="text-xl font-bold tracking-tight">Products Catalog</h1>
          <p className={`text-xs ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>Manage SKU catalogs, HSN details, pricing, and stock refills.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImportFileChange} 
            accept=".csv" 
            className="hidden" 
          />
          <button
            onClick={handleImportClick}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              theme === 'dark'
                ? 'border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-zinc-300'
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-zinc-700'
            }`}
            title="Upload products catalog via CSV file"
          >
            <Upload className="h-3.5 w-3.5" /> CSV Import
          </button>
          <button
            onClick={handleExport}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              theme === 'dark'
                ? 'border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-zinc-300'
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-zinc-700'
            }`}
            title="Download complete products catalog"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> CSV Export
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-zinc-950 font-bold rounded-xl transition shadow-lg shadow-emerald-500/10 text-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
        theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-white border-slate-200'
      }`}>
        <Search className="h-4 w-4 text-zinc-400 shrink-0" />
        <input
          type="text"
          placeholder="Search product by name, SKU, or HSN Code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent border-none outline-none w-full text-xs"
        />
      </div>

      {/* Products Table Card */}
      <div className={`rounded-2xl border overflow-hidden ${
        theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-white border-slate-200'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className={`border-b ${theme === 'dark' ? 'border-zinc-800 text-zinc-400' : 'border-slate-100 text-zinc-500'}`}>
                <th className="py-3 px-4 font-bold uppercase tracking-wider">SKU</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider">Product Name</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider">HSN Code</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider text-center">GST %</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider text-right">Purchase Price</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider text-right">Selling Price</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider text-center">Stock</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850/30">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-10 text-center font-medium">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-emerald-500 mb-2" />
                    Searching SKUs...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center opacity-60">No products found in database.</td>
                </tr>
              ) : (
                products.map((prod) => {
                  const isLowStock = parseFloat(prod.stockQty) <= 25;
                  return (
                    <tr 
                      key={prod.id}
                      className={`transition-colors ${
                        theme === 'dark' ? 'hover:bg-zinc-900/30' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-zinc-400">{prod.sku}</td>
                      <td className="py-3 px-4 font-bold truncate max-w-[200px]">{prod.name}</td>
                      <td className="py-3 px-4 font-mono">{prod.hsn || '—'}</td>
                      <td className="py-3 px-4 text-center font-bold">{parseFloat(prod.gstPercent)}%</td>
                      <td className="py-3 px-4 text-right font-mono">₹{parseFloat(prod.purchasePrice).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-500">₹{parseFloat(prod.sellingPrice).toFixed(2)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          isLowStock 
                            ? 'bg-rose-500/10 border border-rose-500/20 text-rose-500' 
                            : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'
                        }`}>
                          {prod.stockQty} {prod.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => openEditModal(prod)}
                            className={`p-1.5 rounded-lg border hover:scale-105 active:scale-95 transition-all text-zinc-400 hover:text-emerald-500 cursor-pointer ${
                              theme === 'dark' ? 'border-zinc-800 bg-zinc-900' : 'border-slate-200 bg-slate-50'
                            }`}
                            title="Edit details"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          {user.role === 'admin' && (
                            <button
                              onClick={() => handleDelete(prod.id)}
                              className={`p-1.5 rounded-lg border hover:scale-105 active:scale-95 transition-all text-zinc-400 hover:text-red-500 cursor-pointer ${
                                theme === 'dark' ? 'border-zinc-800 bg-zinc-900' : 'border-slate-200 bg-slate-50'
                              }`}
                              title="Delete SKU"
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
      </div>

      {/* CSV Import Layout instruction overlay */}
      <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
        theme === 'dark' ? 'bg-zinc-900/20 border-zinc-800/50 text-zinc-400' : 'bg-slate-50 border-slate-100 text-zinc-500'
      }`}>
        <Package className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
        <div>
          <span className="font-bold text-emerald-500">CSV Import Guideline:</span> 
          <p className="mt-1">Select a comma-separated `.csv` file. It should contain columns with headers: <code className="font-mono bg-zinc-900/60 p-0.5 rounded text-[10px] text-zinc-300">Product Name, SKU, HSN Code, GST Percent, Purchase Price, Selling Price, Stock Quantity, Unit</code>.</p>
        </div>
      </div>

      {/* Add/Edit Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div onClick={() => setModalOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-xs" />
          
          {/* Modal Container */}
          <div className={`relative w-full max-w-lg rounded-2xl border shadow-2xl p-6 transition-all ${
            theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-slate-200 text-zinc-900'
          }`}>
            <button 
              onClick={() => setModalOpen(false)} 
              className="absolute top-4 right-4 text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-base font-bold mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-emerald-500" />
              {modalMode === 'add' ? 'Add New Product SKU' : 'Modify Product SKU Details'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-80">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Urea Fertilizer Bag (50kg)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                    theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-80">SKU / Product Code</label>
                  <input
                    type="text"
                    placeholder="e.g. FERT-UREA-50"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-80">HSN Code</label>
                  <input
                    type="text"
                    placeholder="e.g. 31021000"
                    value={hsn}
                    onChange={(e) => setHsn(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-80">GST Rate (%)</label>
                  <select
                    value={gstPercent}
                    onChange={(e) => setGstPercent(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                    }`}
                  >
                    <option value="0">0% (Nil Rated)</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-80">Stock Qty</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 100"
                    value={stockQty}
                    onChange={(e) => setStockQty(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-80">Unit</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                    }`}
                  >
                    <option value="Pcs">Pcs (Pieces)</option>
                    <option value="Bags">Bags</option>
                    <option value="Kg">Kg (Kilograms)</option>
                    <option value="Ltr">Ltr (Litres)</option>
                    <option value="Boxes">Boxes</option>
                    <option value="Mtr">Mtr (Metres)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-80">Purchase Cost (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 280"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-80">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 350"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border text-xs outline-none focus:border-emerald-500 ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-850 text-white' : 'bg-slate-50 border-slate-200 text-zinc-950'
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-lg transition text-xs cursor-pointer shadow-lg shadow-emerald-500/10"
              >
                {modalMode === 'add' ? 'Create SKU Product' : 'Save Modifications'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default Products;
