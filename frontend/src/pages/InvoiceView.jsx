import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { 
  Printer, 
  Download, 
  Copy, 
  XOctagon, 
  ArrowLeft, 
  CheckCircle,
  AlertTriangle,
  Loader2,
  FileText
} from 'lucide-react';

function InvoiceView({ invoiceId, navigate, theme }) {
  const [invoice, setInvoice] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [template, setTemplate] = useState('classic'); // 'classic', 'modern', 'thermal', 'distributor', 'minimal'
  const [actionLoading, setActionLoading] = useState(false);

  const fetchInvoiceDetails = async () => {
    try {
      setLoading(true);
      const [invRes, compRes] = await Promise.all([
        api.get(`/invoices/${invoiceId}`),
        api.get('/settings/company')
      ]);
      setInvoice(invRes.data);
      setCompany(compRes.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch invoice details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (invoiceId) {
      fetchInvoiceDetails();
    }
  }, [invoiceId]);

  const handlePrint = () => {
    window.print();
  };

  const handleDuplicate = () => {
    if (!invoice) return;
    // Save current details as draft in local storage and redirect to billing page
    const draftData = {
      customer: invoice.customer,
      rows: invoice.items.map(item => ({
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
      paymentMode: invoice.paymentMode,
      billType: invoice.billType
    };
    localStorage.setItem('invoice_draft', JSON.stringify(draftData));
    navigate('billing');
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to CANCEL this invoice? This will restore product stocks.')) return;
    setActionLoading(true);
    try {
      await api.put(`/invoices/${invoice.id}/cancel`);
      fetchInvoiceDetails();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel invoice.');
    } finally {
      setActionLoading(false);
    }
  };

  // PDF Export via jsPDF
  const handleDownloadPDF = () => {
    if (!invoice || !company) return;

    const doc = new jsPDF();
    const isInterstate = parseFloat(invoice.igst) > 0;

    // Header Company Details
    doc.setFontSize(18);
    doc.text(company.name, 14, 20);
    doc.setFontSize(10);
    doc.text(company.address || '', 14, 26);
    doc.text(`GSTIN: ${company.gstin || ''} | Phone: ${company.phone || ''}`, 14, 32);

    // Divider line
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 36, 196, 36);

    // Bill metadata
    doc.text(`Invoice No: ${invoice.invoiceNo}`, 14, 44);
    doc.text(`Date: ${new Date(invoice.date).toLocaleString('en-IN')}`, 14, 50);
    doc.text(`Payment Mode: ${invoice.paymentMode} | Type: ${invoice.billType}`, 14, 56);

    // Customer info
    doc.setFont("helvetica", "bold");
    doc.text("BILLED TO:", 110, 44);
    doc.setFont("helvetica", "normal");
    doc.text(invoice.customer ? invoice.customer.name : 'Cash Customer', 110, 50);
    if (invoice.customer) {
      doc.text(invoice.customer.address || '', 110, 56);
      doc.text(`GSTIN: ${invoice.customer.gstin || 'Unregistered'}`, 110, 62);
    }

    // Invoice items table
    const tableHeaders = ['#', 'Product Item', 'HSN', 'Qty', 'Rate', 'Disc', 'GST%', 'Total'];
    const tableRows = invoice.items.map((item, idx) => [
      idx + 1,
      item.product?.name || 'Product',
      item.product?.hsn || '',
      item.qty,
      `Rs.${parseFloat(item.rate).toFixed(2)}`,
      `Rs.${parseFloat(item.discount).toFixed(2)}`,
      `${parseFloat(item.gstPercent)}%`,
      `Rs.${parseFloat(item.total).toFixed(2)}`
    ]);

    doc.autoTable({
      head: [tableHeaders],
      body: tableRows,
      startY: 72,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 185, 129] } // Emerald header
    });

    const finalY = doc.previousAutoTable.finalY + 10;

    // Totals calculations summary block
    doc.setFontSize(10);
    doc.text(`Subtotal: Rs.${parseFloat(invoice.subtotal).toFixed(2)}`, 130, finalY);
    if (isInterstate) {
      doc.text(`IGST Collected: Rs.${parseFloat(invoice.igst).toFixed(2)}`, 130, finalY + 6);
    } else {
      doc.text(`CGST Collected: Rs.${parseFloat(invoice.cgst).toFixed(2)}`, 130, finalY + 6);
      doc.text(`SGST Collected: Rs.${parseFloat(invoice.sgst).toFixed(2)}`, 130, finalY + 12);
    }
    doc.text(`Round Off: Rs.${parseFloat(invoice.roundOff).toFixed(2)}`, 130, finalY + 18);
    
    doc.setFont("helvetica", "bold");
    doc.text(`GRAND TOTAL: Rs.${parseFloat(invoice.grandTotal).toFixed(2)}`, 130, finalY + 26);

    // Terms and Bank Details
    doc.setFont("helvetica", "bold");
    doc.text("Bank Accounts details:", 14, finalY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Bank: ${company.bankName || ''}`, 14, finalY + 5);
    doc.text(`A/C No: ${company.accountNo || ''}`, 14, finalY + 9);
    doc.text(`IFSC: ${company.ifsc || ''} | Branch: ${company.branch || ''}`, 14, finalY + 13);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Terms & Conditions:", 14, finalY + 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const termsLines = doc.splitTextToSize(company.invoiceTerms || '', 100);
    doc.text(termsLines, 14, finalY + 26);

    doc.save(`Invoice_${invoice.invoiceNo}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        <span className="ml-2 font-medium">Retrieving invoice layouts...</span>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl max-w-xl mx-auto mt-10">
        <h3 className="font-bold text-lg">Error Loading Invoice</h3>
        <p className="text-sm mt-1">{error || 'Invoice not found.'}</p>
        <button onClick={() => navigate('dashboard')} className="mt-4 px-4 py-2 bg-red-500 text-white rounded-xl text-xs font-semibold hover:bg-red-650 transition">
          Return to Dashboard
        </button>
      </div>
    );
  }

  // Common metadata values
  const invoiceDateFormatted = new Date(invoice.date).toLocaleString('en-IN');
  const companyState = company.gstin ? company.gstin.substring(0, 2) : '06';
  const customerState = invoice.customer?.gstin ? invoice.customer.gstin.substring(0, 2) : companyState;
  const isInterstate = companyState !== customerState;

  return (
    <div className="space-y-6">
      
      {/* Top Controller Ribbon (Hides in Print) */}
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <button
          onClick={() => navigate('billing')}
          className={`flex items-center gap-1 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
            theme === 'dark'
              ? 'border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-zinc-300'
              : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-zinc-700'
          }`}
        >
          <ArrowLeft className="h-4 w-4" /> Back to Billing
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {invoice.status !== 'Cancelled' && (
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-2 border border-red-500/20 hover:border-red-500/30 bg-red-500/5 hover:bg-red-500/10 text-red-400 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              <XOctagon className="h-4 w-4" /> Cancel Invoice
            </button>
          )}
          <button
            onClick={handleDuplicate}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              theme === 'dark'
                ? 'border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-zinc-300'
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-zinc-700'
            }`}
          >
            <Copy className="h-4 w-4 text-emerald-400" /> Duplicate Bill
          </button>
          <button
            onClick={handleDownloadPDF}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              theme === 'dark'
                ? 'border-zinc-800 bg-zinc-900 hover:bg-zinc-850 text-zinc-300'
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-zinc-700'
            }`}
          >
            <Download className="h-4 w-4 text-blue-400" /> Download PDF
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-zinc-950 font-bold rounded-xl transition shadow-lg shadow-emerald-500/10 text-xs cursor-pointer"
          >
            <Printer className="h-4 w-4" /> Print Invoice
          </button>
        </div>
      </div>

      {/* Design Switcher Ribbon (Hides in Print) */}
      <div className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 no-print ${
        theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-500">Invoice Theme Templates</h3>
          <p className={`text-[10px] ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>Choose a design styling to suit A4 formats or Thermal paper rolls.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {['classic', 'modern', 'thermal', 'distributor', 'minimal'].map(tName => (
            <button
              key={tName}
              onClick={() => setTemplate(tName)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer capitalize ${
                template === tName
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400 font-extrabold'
                  : theme === 'dark'
                  ? 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-800'
                  : 'border-slate-200 bg-slate-50 text-zinc-600 hover:bg-slate-100'
              }`}
            >
              {tName} {tName === 'thermal' ? '(POS)' : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice Cancelled Warning Banner */}
      {invoice.status === 'Cancelled' && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl text-sm font-semibold flex items-center gap-2 no-print">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          This invoice has been CANCELLED. Stocks have been restored and calculations will be skipped in profit indices.
        </div>
      )}

      {/* -------------------- INVOICE PRINT VIEW AREA -------------------- */}
      <div className="flex justify-center w-full">
        
        {/* Printable Card Container */}
        <div className={`print-area shadow-2xl overflow-hidden text-zinc-900 font-sans border border-transparent ${
          template === 'thermal' 
            ? 'paper-thermal-80 bg-white text-black font-mono text-[9px] border-dashed border-zinc-300' 
            : 'paper-a4 bg-white'
        }`}>
          
          {/* 1. CLASSIC GST TEMPLATE */}
          {template === 'classic' && (
            <div className="space-y-5 text-sm text-zinc-900">
              
              {/* Header Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <h1 className="text-3xl font-black text-zinc-950 leading-none">{company.name}</h1>
                  <p className="opacity-80 text-xs leading-normal">{company.address}</p>
                  <p className="font-bold text-xs mt-1">GSTIN: <span className="font-mono">{company.gstin}</span> | Phone: {company.phone}</p>
                </div>
                <div className="text-right space-y-1">
                  <h2 className="text-2xl font-black uppercase tracking-wider text-emerald-600 leading-none">TAX INVOICE</h2>
                  <p className="font-mono font-bold text-zinc-950 text-sm mt-1">Invoice No: {invoice.invoiceNo}</p>
                  <p className="font-mono text-zinc-500 text-xs">Date: {invoiceDateFormatted}</p>
                  <p className="text-xs font-bold">Payment: <span className="text-emerald-600">{invoice.paymentMode} ({invoice.billType})</span></p>
                </div>
              </div>

              {/* Billed To / Shipping Address */}
              <div className="grid grid-cols-2 gap-4 border-t-2 border-b-2 border-zinc-900 py-2.5 bg-zinc-50/50 px-3">
                <div>
                  <h3 className="font-bold uppercase tracking-widest text-[10px] text-zinc-400">Billed To (Recipient)</h3>
                  <div className="font-black text-zinc-950 text-base mt-1">{invoice.customer ? invoice.customer.name : 'Cash Sale'}</div>
                  {invoice.customer && (
                    <div className="mt-1 space-y-0.5 leading-normal text-xs">
                      <p>{invoice.customer.address}</p>
                      <p>Mobile: {invoice.customer.mobile}</p>
                      {invoice.customer.gstin ? (
                        <p className="font-bold text-emerald-600">GSTIN: <span className="font-mono">{invoice.customer.gstin}</span></p>
                      ) : (
                        <p className="text-zinc-500 italic">Unregistered customer</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-right space-y-1 leading-normal text-xs self-end">
                  <h3 className="font-bold uppercase tracking-widest text-[10px] text-zinc-400 mb-1">Transaction Status</h3>
                  <div>
                    <span className={`inline-flex px-2.5 py-0.5 rounded text-xs font-bold ${
                      invoice.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                    }`}>
                      {invoice.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Grid Table */}
              <table className="w-full text-left border border-zinc-300 border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-100 border-b-2 border-zinc-400 font-bold text-zinc-800 text-[11px] uppercase">
                    <th className="py-2 px-2.5 border-r border-zinc-300 text-center w-8">#</th>
                    <th className="py-2 px-2.5 border-r border-zinc-300">Description of Goods</th>
                    <th className="py-2 px-2.5 border-r border-zinc-300 text-center">HSN</th>
                    <th className="py-2 px-2.5 border-r border-zinc-300 text-right">Qty</th>
                    <th className="py-2 px-2.5 border-r border-zinc-300 text-right">Rate</th>
                    <th className="py-2 px-2.5 border-r border-zinc-300 text-right">Disc</th>
                    <th className="py-2 px-2.5 border-r border-zinc-300 text-center">GST%</th>
                    <th className="py-2 px-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 text-xs">
                  {invoice.items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-zinc-50/40">
                      <td className="py-2 px-2.5 border-r border-zinc-300 text-center font-mono">{idx + 1}</td>
                      <td className="py-2 px-2.5 border-r border-zinc-300 font-bold text-zinc-950">{item.product?.name}</td>
                      <td className="py-2 px-2.5 border-r border-zinc-300 text-center font-mono text-zinc-500">{item.product?.hsn || '—'}</td>
                      <td className="py-2 px-2.5 border-r border-zinc-300 text-right font-mono font-semibold">{parseFloat(item.qty)} {item.product?.unit}</td>
                      <td className="py-2 px-2.5 border-r border-zinc-300 text-right font-mono">₹{parseFloat(item.rate).toFixed(2)}</td>
                      <td className="py-2 px-2.5 border-r border-zinc-300 text-right font-mono text-zinc-500">₹{parseFloat(item.discount).toFixed(2)}</td>
                      <td className="py-2 px-2.5 border-r border-zinc-300 text-center font-mono">{parseFloat(item.gstPercent)}%</td>
                      <td className="py-2 px-2.5 text-right font-mono font-bold text-zinc-950">₹{parseFloat(item.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Calculations and Bank Panel */}
              <div className="grid grid-cols-12 gap-4 pt-2">
                
                {/* Left Panel: Bank Info & Terms */}
                <div className="col-span-7 space-y-4">
                  <div className="p-3 rounded-lg border border-zinc-200 bg-zinc-50/50 space-y-1 text-xs">
                    <div className="font-bold text-zinc-950 uppercase tracking-wide">Bank Settlement Account:</div>
                    <p><span className="opacity-60">Bank Name:</span> {company.bankName}</p>
                    <p><span className="opacity-60">A/C No:</span> <span className="font-mono font-bold">{company.accountNo}</span></p>
                    <p><span className="opacity-60">IFSC Code:</span> <span className="font-mono font-bold">{company.ifsc}</span></p>
                    <p><span className="opacity-60">Branch:</span> {company.branch}</p>
                  </div>

                  <div className="text-[11px] leading-relaxed space-y-1">
                    <div className="font-bold text-zinc-950 uppercase tracking-wide">Terms & Conditions:</div>
                    <div className="whitespace-pre-line opacity-80">{company.invoiceTerms}</div>
                  </div>
                </div>

                {/* Right Panel: Tax Aggregation */}
                <div className="col-span-5 space-y-3">
                  <div className="space-y-1.5 text-right font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="opacity-60">Taxable Value:</span>
                      <span className="font-bold">₹{parseFloat(invoice.subtotal).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-500">
                      <span className="opacity-60">Discount Allowed:</span>
                      <span>-₹{parseFloat(invoice.discount).toFixed(2)}</span>
                    </div>
                    
                    {isInterstate ? (
                      <div className="flex justify-between text-zinc-650">
                        <span className="opacity-60">IGST Collected:</span>
                        <span className="font-bold text-zinc-900">₹{parseFloat(invoice.igst).toFixed(2)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between text-zinc-650">
                          <span className="opacity-60">CGST (Central Tax):</span>
                          <span className="font-bold text-zinc-900">₹{parseFloat(invoice.cgst).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-zinc-650">
                          <span className="opacity-60">SGST (State Tax):</span>
                          <span className="font-bold text-zinc-900">₹{parseFloat(invoice.sgst).toFixed(2)}</span>
                        </div>
                      </>
                    )}

                    <div className="flex justify-between border-t border-zinc-200 pt-1.5 text-zinc-500">
                      <span className="opacity-60">Round Off:</span>
                      <span>₹{parseFloat(invoice.roundOff).toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between border-t border-zinc-900 pt-2 text-sm font-black text-zinc-950">
                      <span>Invoice Total:</span>
                      <span className="text-lg text-emerald-600">₹{parseFloat(invoice.grandTotal).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Signatures */}
                  <div className="pt-6 text-right space-y-1 mt-4">
                    <p className="text-xs opacity-60">For {company.name}</p>
                    <div className="h-12"></div>
                    <p className="text-xs font-bold border-t border-zinc-400 pt-1 inline-block w-48 text-center">Authorized Signatory</p>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* 2. MODERN BUSINESS TEMPLATE */}
          {template === 'modern' && (
            <div className="space-y-6 text-xs text-zinc-900">
              {/* Header color accent bar */}
              <div className="h-3.5 bg-zinc-900 -mx-10 -mt-10 mb-8 rounded-t-xl" />

              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="px-2 py-0.5 bg-emerald-500 text-zinc-950 font-black rounded-sm text-[9px] uppercase tracking-wider">TAX INVOICE</span>
                  <h1 className="text-2xl font-bold text-zinc-950 mt-1 leading-none">{company.name}</h1>
                  <p className="text-zinc-500 text-[10px] mt-1">{company.address}</p>
                  <p className="text-[10px] font-semibold">GSTIN: {company.gstin} | Tel: {company.phone}</p>
                </div>
                <div className="text-right space-y-1 font-mono">
                  <div className="text-2xl font-black text-zinc-900 tracking-tighter">#{invoice.invoiceNo}</div>
                  <p className="text-[10px] text-zinc-400">Date: {invoiceDateFormatted}</p>
                  <p className="text-[10px] text-emerald-600 font-bold">Status: {invoice.status}</p>
                </div>
              </div>

              {/* Billed info */}
              <div className="grid grid-cols-2 gap-4 border-t border-b border-zinc-100 py-4 mt-6">
                <div>
                  <div className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">Billed To</div>
                  <div className="font-black text-zinc-950 text-base mt-1.5">{invoice.customer ? invoice.customer.name : 'Cash Sale'}</div>
                  {invoice.customer && (
                    <div className="mt-1 text-[10px] text-zinc-500 space-y-0.5 leading-normal">
                      <p>{invoice.customer.address}</p>
                      <p>Phone: {invoice.customer.mobile}</p>
                      {invoice.customer.gstin && <p className="font-bold text-emerald-600">GSTIN: {invoice.customer.gstin}</p>}
                    </div>
                  )}
                </div>
                <div className="text-right space-y-1 text-[10px] self-end">
                  <p><span className="opacity-60 font-semibold">Payment mode:</span> <span className="font-bold text-zinc-950">{invoice.paymentMode}</span></p>
                  <p><span className="opacity-60 font-semibold">Invoice type:</span> <span className="font-bold text-zinc-950">{invoice.billType}</span></p>
                </div>
              </div>

              {/* Table */}
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-900 font-bold text-zinc-700">
                    <th className="py-2 pb-1.5 uppercase tracking-wider text-[9px] w-6">#</th>
                    <th className="py-2 pb-1.5 uppercase tracking-wider text-[9px]">Description</th>
                    <th className="py-2 pb-1.5 uppercase tracking-wider text-[9px] text-center">HSN</th>
                    <th className="py-2 pb-1.5 uppercase tracking-wider text-[9px] text-right">Qty</th>
                    <th className="py-2 pb-1.5 uppercase tracking-wider text-[9px] text-right">Rate</th>
                    <th className="py-2 pb-1.5 uppercase tracking-wider text-[9px] text-right">Disc</th>
                    <th className="py-2 pb-1.5 uppercase tracking-wider text-[9px] text-center">GST</th>
                    <th className="py-2 pb-1.5 uppercase tracking-wider text-[9px] text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {invoice.items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-zinc-50/50">
                      <td className="py-3 font-mono text-zinc-400">{idx + 1}</td>
                      <td className="py-3 font-bold text-zinc-950">{item.product?.name}</td>
                      <td className="py-3 text-center font-mono text-zinc-500">{item.product?.hsn || '—'}</td>
                      <td className="py-3 text-right font-mono">{parseFloat(item.qty)} {item.product?.unit}</td>
                      <td className="py-3 text-right font-mono">₹{parseFloat(item.rate).toFixed(2)}</td>
                      <td className="py-3 text-right font-mono text-zinc-400">₹{parseFloat(item.discount).toFixed(2)}</td>
                      <td className="py-3 text-center font-mono">{parseFloat(item.gstPercent)}%</td>
                      <td className="py-3 text-right font-mono font-bold text-zinc-950">₹{parseFloat(item.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Calculations Block */}
              <div className="flex flex-col md:flex-row justify-between items-start gap-8 pt-4">
                
                <div className="space-y-4 md:max-w-xs flex-1">
                  <div className="space-y-1 text-[9px]">
                    <div className="font-bold text-zinc-950 uppercase text-[10px] tracking-wide">Bank Transfers</div>
                    <p><span className="opacity-60 font-semibold">Bank:</span> {company.bankName} | IFSC: {company.ifsc}</p>
                    <p><span className="opacity-60 font-semibold">Account:</span> <span className="font-mono font-bold text-zinc-950">{company.accountNo}</span></p>
                  </div>
                  <div className="text-[8px] leading-tight text-zinc-500 whitespace-pre-line">{company.invoiceTerms}</div>
                </div>

                <div className="w-56 space-y-2 text-xs border-t border-zinc-100 pt-4 md:pt-0">
                  <div className="flex justify-between font-mono text-[10px]">
                    <span className="opacity-60">Subtotal:</span>
                    <span>₹{parseFloat(invoice.subtotal).toFixed(2)}</span>
                  </div>
                  
                  {isInterstate ? (
                    <div className="flex justify-between font-mono text-[10px] text-zinc-500">
                      <span className="opacity-60">IGST (Interstate):</span>
                      <span>₹{parseFloat(invoice.igst).toFixed(2)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between font-mono text-[10px] text-zinc-500">
                        <span className="opacity-60">CGST (Central):</span>
                        <span>₹{parseFloat(invoice.cgst).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-mono text-[10px] text-zinc-500">
                        <span className="opacity-60">SGST (State):</span>
                        <span>₹{parseFloat(invoice.sgst).toFixed(2)}</span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between font-mono text-[10px] text-zinc-400">
                    <span className="opacity-60">Round-off:</span>
                    <span>₹{parseFloat(invoice.roundOff).toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between border-t border-zinc-900 pt-2 text-sm font-black text-zinc-950">
                    <span>Grand Total:</span>
                    <span className="text-base text-emerald-600 font-mono">₹{parseFloat(invoice.grandTotal).toFixed(2)}</span>
                  </div>
                  
                  <div className="pt-8 text-right">
                    <div className="h-6"></div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 border-t pt-1 border-dashed">Receiver signature</p>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* 3. THERMAL / POS RECEIPT STYLE */}
          {template === 'thermal' && (
            <div className="text-zinc-900 space-y-3 font-mono leading-tight">
              {/* Header */}
              <div className="text-center space-y-0.5">
                <div className="text-xs font-bold uppercase">{company.name}</div>
                <div className="text-[7px]">{company.address}</div>
                <div className="text-[8px] font-bold">GSTIN: {company.gstin}</div>
                <div className="text-[8px]">Ph: {company.phone}</div>
              </div>

              {/* Meta */}
              <div className="border-t border-b border-dashed border-zinc-400 py-1 space-y-0.5 text-[8px]">
                <div>No: <span className="font-bold">{invoice.invoiceNo}</span></div>
                <div>Date: {invoiceDateFormatted}</div>
                <div>Customer: {invoice.customer ? invoice.customer.name : 'Cash Sale'}</div>
                {invoice.customer?.gstin && <div>Cust GSTIN: {invoice.customer.gstin}</div>}
              </div>

              {/* Table */}
              <table className="w-full text-left text-[8px] border-collapse">
                <thead>
                  <tr className="border-b border-dashed border-zinc-400 font-bold">
                    <th className="py-1">Item</th>
                    <th className="py-1 text-right">Qty</th>
                    <th className="py-1 text-right">Rate</th>
                    <th className="py-1 text-right">GST</th>
                    <th className="py-1 text-right font-bold">Amt</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map(item => (
                    <tr key={item.id} className="border-b border-dotted border-zinc-300">
                      <td className="py-1 max-w-[30mm] truncate font-bold">{item.product?.name}</td>
                      <td className="py-1 text-right font-mono">{parseFloat(item.qty)}</td>
                      <td className="py-1 text-right font-mono">{parseFloat(item.rate)}</td>
                      <td className="py-1 text-right font-mono">{parseFloat(item.gstPercent)}%</td>
                      <td className="py-1 text-right font-mono font-bold">{parseFloat(item.total).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Calculation Breakdown */}
              <div className="text-[8px] space-y-0.5 text-right font-mono border-t border-dashed border-zinc-400 pt-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{parseFloat(invoice.subtotal).toFixed(1)}</span>
                </div>
                {isInterstate ? (
                  <div className="flex justify-between">
                    <span>IGST Tax:</span>
                    <span>₹{parseFloat(invoice.igst).toFixed(1)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span>CGST Tax:</span>
                      <span>₹{parseFloat(invoice.cgst).toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SGST Tax:</span>
                      <span>₹{parseFloat(invoice.sgst).toFixed(1)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-bold border-t border-dashed border-zinc-400 pt-1 text-[10px]">
                  <span>NET TOTAL:</span>
                  <span>₹{parseFloat(invoice.grandTotal).toFixed(1)}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center text-[7px] pt-2 border-t border-dashed border-zinc-450">
                <p className="font-bold">THANK YOU, VISIT AGAIN!</p>
                <p className="opacity-80">Software powered by TALLY Lite</p>
              </div>
            </div>
          )}

          {/* 4. DISTRIBUTOR INVOICE STYLE */}
          {template === 'distributor' && (
            <div className="space-y-6 text-xs text-zinc-900 border-2 border-zinc-800 p-4">
              
              <div className="text-center border-b-2 border-zinc-800 pb-2">
                <h1 className="text-2xl font-black tracking-widest text-zinc-950 uppercase">{company.name}</h1>
                <p className="font-bold text-[9px] uppercase tracking-wider">AUTHORIZED DISTRIBUTOR & STOCKIST</p>
                <p className="text-[10px] mt-0.5">{company.address}</p>
                <p className="font-bold text-[10px] font-mono mt-1">GSTIN: {company.gstin} | Tel: {company.phone} | Email: {company.email}</p>
              </div>

              {/* Meta information columns */}
              <div className="grid grid-cols-3 gap-2 border-b-2 border-zinc-800 pb-4 text-[10px]">
                <div className="border-r border-zinc-300 pr-2">
                  <span className="font-black uppercase tracking-wider block opacity-70">Buyer Details</span>
                  <div className="font-bold text-sm text-zinc-900 mt-1">{invoice.customer ? invoice.customer.name : 'Cash Sale'}</div>
                  {invoice.customer && (
                    <div className="mt-1 space-y-0.5 text-zinc-600 leading-tight">
                      <p>{invoice.customer.address}</p>
                      <p>Mob: {invoice.customer.mobile}</p>
                      <p className="font-bold text-emerald-600">GSTIN: {invoice.customer.gstin || 'No GSTIN'}</p>
                    </div>
                  )}
                </div>

                <div className="border-r border-zinc-300 px-2 space-y-1.5">
                  <span className="font-black uppercase tracking-wider block opacity-70">Despatch Details</span>
                  <p><span className="opacity-60">Challan No:</span> <span className="font-mono">CH-{invoice.id}</span></p>
                  <p><span className="opacity-60">L.R. Number:</span> — </p>
                  <p><span className="opacity-60">Vehicle Number:</span> Local Transport</p>
                </div>

                <div className="pl-2 space-y-1 font-mono text-right">
                  <span className="font-black uppercase tracking-wider block text-left opacity-70">Invoice Metadata</span>
                  <div className="text-base font-bold text-zinc-900 mt-1">NO: {invoice.invoiceNo}</div>
                  <div>Date: {invoiceDateFormatted}</div>
                  <div>Pay Type: <span className="font-bold text-emerald-600">{invoice.billType}</span></div>
                  <div>Mode: <span className="font-bold">{invoice.paymentMode}</span></div>
                </div>
              </div>

              {/* Detailed Grid Table */}
              <table className="w-full text-left border border-zinc-800 border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-200 border-b border-zinc-800 font-bold text-zinc-900 uppercase text-[9px]">
                    <th className="py-2 px-1 border-r border-zinc-800 text-center w-8">#</th>
                    <th className="py-2 px-2 border-r border-zinc-800">Description of Goods</th>
                    <th className="py-2 px-2 border-r border-zinc-800 text-center">HSN</th>
                    <th className="py-2 px-2 border-r border-zinc-800 text-right">Weight/Qty</th>
                    <th className="py-2 px-2 border-r border-zinc-800 text-right">Rate (₹)</th>
                    <th className="py-2 px-2 border-r border-zinc-800 text-right">Disc (₹)</th>
                    <th className="py-2 px-2 border-r border-zinc-800 text-center">GST %</th>
                    <th className="py-2 px-2 text-right">Total Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 font-medium">
                  {invoice.items.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="py-2 px-1 border-r border-zinc-800 text-center font-mono">{idx + 1}</td>
                      <td className="py-2 px-2 border-r border-zinc-800 font-bold text-zinc-950">
                        {item.product?.name} 
                        <span className="text-[10px] text-zinc-500 font-normal block font-mono">SKU: {item.product?.sku}</span>
                      </td>
                      <td className="py-2 px-2 border-r border-zinc-800 text-center font-mono">{item.product?.hsn || '—'}</td>
                      <td className="py-2 px-2 border-r border-zinc-800 text-right font-mono">{parseFloat(item.qty)} {item.product?.unit}</td>
                      <td className="py-2 px-2 border-r border-zinc-800 text-right font-mono">₹{parseFloat(item.rate).toFixed(2)}</td>
                      <td className="py-2 px-2 border-r border-zinc-800 text-right font-mono text-zinc-400">₹{parseFloat(item.discount).toFixed(2)}</td>
                      <td className="py-2 px-2 border-r border-zinc-800 text-center font-mono">{parseFloat(item.gstPercent)}%</td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-zinc-950">₹{parseFloat(item.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Terms, Dues, and Grand Calculations */}
              <div className="grid grid-cols-12 gap-4 border border-zinc-800 p-3 bg-zinc-50/50">
                <div className="col-span-8 text-[9px] leading-tight space-y-2">
                  <div>
                    <span className="font-bold text-zinc-950 uppercase block tracking-wider">Bank Details</span>
                    <p>{company.bankName} | Branch: {company.branch} | A/c: <span className="font-bold font-mono">{company.accountNo}</span> | IFSC: <span className="font-bold font-mono">{company.ifsc}</span></p>
                  </div>
                  <div>
                    <span className="font-bold text-zinc-950 uppercase block tracking-wider">Terms of Sale</span>
                    <div className="whitespace-pre-line text-zinc-500 text-[8px]">{company.invoiceTerms}</div>
                  </div>
                </div>

                <div className="col-span-4 text-right space-y-1.5 font-mono text-[10px] border-l border-zinc-300 pl-3">
                  <div className="flex justify-between">
                    <span className="opacity-60">Subtotal:</span>
                    <span className="font-bold">₹{parseFloat(invoice.subtotal).toFixed(2)}</span>
                  </div>
                  {isInterstate ? (
                    <div className="flex justify-between text-zinc-500">
                      <span className="opacity-60">IGST:</span>
                      <span>₹{parseFloat(invoice.igst).toFixed(2)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-zinc-500">
                        <span className="opacity-60">CGST:</span>
                        <span>₹{parseFloat(invoice.cgst).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-zinc-500">
                        <span className="opacity-60">SGST:</span>
                        <span>₹{parseFloat(invoice.sgst).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-zinc-400">
                    <span className="opacity-60">Round-off:</span>
                    <span>₹{parseFloat(invoice.roundOff).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-800 pt-1.5 text-xs font-black text-zinc-950">
                    <span>GRAND TOTAL:</span>
                    <span className="text-sm">₹{parseFloat(invoice.grandTotal).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Distributor Footer Signatures */}
              <div className="flex justify-between items-center pt-8 border-t border-zinc-300 mt-6 text-[10px]">
                <div className="text-center w-48 border-t border-dashed pt-1">Buyer's Seal & Signature</div>
                <div className="text-center w-48 border-t border-dashed pt-1">
                  <p className="text-[8px] opacity-60">For {company.name}</p>
                  <p className="font-bold mt-4">Authorized Signature</p>
                </div>
              </div>

            </div>
          )}

          {/* 5. MINIMAL PREMIUM TEMPLATE */}
          {template === 'minimal' && (
            <div className="space-y-8 text-zinc-800 text-xs font-light">
              
              {/* Top Details */}
              <div className="flex justify-between items-start border-b border-zinc-100 pb-6">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-zinc-950">{company.name}</h1>
                  <p className="text-[10px] text-zinc-400 mt-1 leading-tight">{company.address}</p>
                  <p className="text-[10px] mt-1 font-semibold">GSTIN: {company.gstin} | Tel: {company.phone}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-widest text-emerald-500 font-bold">Tax Invoice</div>
                  <div className="text-xl font-bold text-zinc-950 mt-1 font-mono">{invoice.invoiceNo}</div>
                  <div className="text-[10px] text-zinc-400 mt-1 font-mono">{invoiceDateFormatted}</div>
                </div>
              </div>

              {/* Recipient Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Invoice Issued To</span>
                  <div className="text-sm font-bold text-zinc-950 mt-2">{invoice.customer ? invoice.customer.name : 'Cash Customer'}</div>
                  {invoice.customer && (
                    <div className="mt-1 space-y-0.5 text-zinc-500 leading-normal text-[10px]">
                      <p>{invoice.customer.address}</p>
                      <p>Mobile: {invoice.customer.mobile}</p>
                      {invoice.customer.gstin && <p className="font-bold text-emerald-500">GSTIN: {invoice.customer.gstin}</p>}
                    </div>
                  )}
                </div>
                <div className="text-right flex flex-col justify-end text-[10px] text-zinc-500 space-y-1">
                  <p>Billing Type: <span className="font-semibold text-zinc-800">{invoice.billType}</span></p>
                  <p>Payment Mode: <span className="font-semibold text-zinc-800">{invoice.paymentMode}</span></p>
                  <p>Status: <span className="font-semibold text-zinc-800">{invoice.status}</span></p>
                </div>
              </div>

              {/* Items list */}
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-400 font-bold">
                    <th className="py-2.5 pb-2 w-8">#</th>
                    <th className="py-2.5 pb-2">Description</th>
                    <th className="py-2.5 pb-2 text-center">HSN</th>
                    <th className="py-2.5 pb-2 text-right">Qty</th>
                    <th className="py-2.5 pb-2 text-right">Rate</th>
                    <th className="py-2.5 pb-2 text-right">Discount</th>
                    <th className="py-2.5 pb-2 text-center">GST</th>
                    <th className="py-2.5 pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-normal">
                  {invoice.items.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="py-3 font-mono text-zinc-400">{idx + 1}</td>
                      <td className="py-3 font-bold text-zinc-900">{item.product?.name}</td>
                      <td className="py-3 text-center font-mono text-zinc-400">{item.product?.hsn || '—'}</td>
                      <td className="py-3 text-right font-mono">{parseFloat(item.qty)} {item.product?.unit}</td>
                      <td className="py-3 text-right font-mono">₹{parseFloat(item.rate).toFixed(2)}</td>
                      <td className="py-3 text-right font-mono text-zinc-400">₹{parseFloat(item.discount).toFixed(2)}</td>
                      <td className="py-3 text-center font-mono">{parseFloat(item.gstPercent)}%</td>
                      <td className="py-3 text-right font-mono font-bold text-zinc-900">₹{parseFloat(item.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Subtotal and terms layout */}
              <div className="flex flex-col md:flex-row justify-between items-start gap-8 border-t border-zinc-100 pt-6">
                <div className="space-y-4 md:max-w-xs flex-1">
                  <div className="text-[9px] text-zinc-500 space-y-1">
                    <div className="font-bold text-zinc-900 uppercase">Settlement Details</div>
                    <p>Bank: {company.bankName} | A/c No: {company.accountNo}</p>
                    <p>IFSC: {company.ifsc} | Branch: {company.branch}</p>
                  </div>
                  <div className="text-[8px] text-zinc-400 whitespace-pre-line font-light leading-snug">{company.invoiceTerms}</div>
                </div>

                <div className="w-56 space-y-2.5 text-xs text-zinc-600 font-mono">
                  <div className="flex justify-between text-[10px]">
                    <span className="opacity-75">Subtotal Value:</span>
                    <span>₹{parseFloat(invoice.subtotal).toFixed(2)}</span>
                  </div>
                  {isInterstate ? (
                    <div className="flex justify-between text-[10px]">
                      <span className="opacity-75">IGST collected:</span>
                      <span>₹{parseFloat(invoice.igst).toFixed(2)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-[10px]">
                        <span className="opacity-75">CGST collected:</span>
                        <span>₹{parseFloat(invoice.cgst).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="opacity-75">SGST collected:</span>
                        <span>₹{parseFloat(invoice.sgst).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span className="opacity-75">Round Off:</span>
                    <span>₹{parseFloat(invoice.roundOff).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-100 pt-3 text-sm font-black text-zinc-950">
                    <span className="font-sans font-bold text-zinc-900">GRAND TOTAL:</span>
                    <span className="text-base text-zinc-900">₹{parseFloat(invoice.grandTotal).toFixed(2)}</span>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>

    </div>
  );
}

export default InvoiceView;
