const express = require('express');
const router = express.Router();
const { Invoice, InvoiceItem, Product, Customer, sequelize } = require('../models');
const auth = require('../middleware/auth');
const { Op } = require('sequelize');

// GET /api/reports/dashboard - Dashboard summary cards and chart data
router.get('/dashboard', auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // 1. Calculations for Cards
    // Today's Sales
    const todayInvoices = await Invoice.findAll({
      where: {
        date: { [Op.gte]: today },
        status: { [Op.ne]: 'Cancelled' }
      }
    });
    const todaySales = todayInvoices.reduce((sum, inv) => sum + parseFloat(inv.grandTotal), 0);

    // Monthly Sales
    const monthlyInvoices = await Invoice.findAll({
      where: {
        date: { [Op.gte]: startOfMonth },
        status: { [Op.ne]: 'Cancelled' }
      }
    });
    const monthlySales = monthlyInvoices.reduce((sum, inv) => sum + parseFloat(inv.grandTotal), 0);

    // Pending Credit Payments
    const pendingCreditInvoices = await Invoice.findAll({
      where: {
        billType: 'Credit',
        status: 'Unpaid'
      }
    });
    const pendingPayments = pendingCreditInvoices.reduce((sum, inv) => sum + parseFloat(inv.grandTotal), 0);

    // Counts
    const totalCustomers = await Customer.count();
    const totalProducts = await Product.count();

    // 2. Recent Invoices (limit 5)
    const recentInvoices = await Invoice.findAll({
      limit: 5,
      order: [['date', 'DESC'], ['id', 'DESC']],
      include: [{ model: Customer, as: 'customer', attributes: ['name'] }]
    });

    // 3. Sales Trend for the last 7 days (Chart 1)
    const salesTrend = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      date.setHours(0,0,0,0);
      
      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);

      const dayInvoices = await Invoice.findAll({
        where: {
          date: { [Op.between]: [date, nextDate] },
          status: { [Op.ne]: 'Cancelled' }
        }
      });
      const dayTotal = dayInvoices.reduce((sum, inv) => sum + parseFloat(inv.grandTotal), 0);
      
      salesTrend.push({
        date: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        amount: dayTotal
      });
    }

    // 4. Low stock alerts (alert if stock is <= product-specific minStockLimit)
    const lowStockAlerts = await Product.findAll({
      where: sequelize.literal('stockQty <= minStockLimit'),
      limit: 5,
      order: [['stockQty', 'ASC']]
    });

    res.json({
      cards: {
        todaySales,
        monthlySales,
        pendingPayments,
        totalCustomers,
        totalProducts
      },
      recentInvoices,
      salesTrend,
      lowStockAlerts
    });

  } catch (error) {
    console.error('Get dashboard reports error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/reports/gst - GST Tax liability report
router.get('/gst', auth, async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    let whereCondition = { status: { [Op.ne]: 'Cancelled' } };
    if (startDate && endDate) {
      whereCondition.date = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }

    const invoices = await Invoice.findAll({
      where: whereCondition,
      include: [{ model: InvoiceItem, as: 'items' }],
      order: [['date', 'ASC']]
    });

    // Aggregate GST values by GST Rate Bracket
    const brackets = {
      '0%': { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
      '5%': { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
      '12%': { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
      '18%': { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
      '28%': { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 }
    };

    let totalTaxableVal = 0;
    let totalCgstVal = 0;
    let totalSgstVal = 0;
    let totalIgstVal = 0;

    invoices.forEach(inv => {
      const isInterstate = parseFloat(inv.igst) > 0;
      inv.items.forEach(item => {
        const rate = parseFloat(item.gstPercent);
        const bracketKey = `${Math.round(rate)}%`;
        
        // item.total = taxableValue + tax
        const totalAmount = parseFloat(item.total);
        const gstMultiplier = rate / 100;
        
        // Since item.total includes tax, let's reverse calculate taxable amount
        // Taxable = Total / (1 + gstMultiplier)
        const taxable = totalAmount / (1 + gstMultiplier);
        const tax = totalAmount - taxable;

        if (brackets[bracketKey]) {
          brackets[bracketKey].taxable += taxable;
          if (isInterstate) {
            brackets[bracketKey].igst += tax;
            totalIgstVal += tax;
          } else {
            brackets[bracketKey].cgst += tax / 2;
            brackets[bracketKey].sgst += tax / 2;
            totalCgstVal += tax / 2;
            totalSgstVal += tax / 2;
          }
          brackets[bracketKey].totalTax += tax;
        }
        totalTaxableVal += taxable;
      });
    });

    res.json({
      summary: {
        taxable: totalTaxableVal,
        cgst: totalCgstVal,
        sgst: totalSgstVal,
        igst: totalIgstVal,
        totalGst: totalCgstVal + totalSgstVal + totalIgstVal
      },
      brackets,
      invoicesCount: invoices.length
    });

  } catch (error) {
    console.error('Get GST report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/reports/products - Product-wise sales report
router.get('/products', auth, async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    let whereCondition = { status: { [Op.ne]: 'Cancelled' } };
    if (startDate && endDate) {
      whereCondition.date = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }

    const invoices = await Invoice.findAll({
      where: whereCondition,
      include: [
        { 
          model: InvoiceItem, 
          as: 'items',
          include: [{ model: Product, as: 'product' }]
        }
      ]
    });

    const productSalesMap = {};

    invoices.forEach(inv => {
      inv.items.forEach(item => {
        if (!item.product) return;
        const prodId = item.productId;
        const qty = parseFloat(item.qty);
        const rowTotal = parseFloat(item.total);
        const itemDiscount = parseFloat(item.discount);
        
        // Reverse calculate purchase cost
        const purchaseCost = parseFloat(item.product.purchasePrice) * qty;

        if (!productSalesMap[prodId]) {
          productSalesMap[prodId] = {
            id: prodId,
            name: item.product.name,
            sku: item.product.sku,
            unit: item.product.unit,
            qtySold: 0,
            revenue: 0,
            discountGiven: 0,
            purchaseCost: 0,
            stockRemaining: parseFloat(item.product.stockQty),
          };
        }
        productSalesMap[prodId].qtySold += qty;
        productSalesMap[prodId].revenue += rowTotal;
        productSalesMap[prodId].discountGiven += itemDiscount;
        productSalesMap[prodId].purchaseCost += purchaseCost;
      });
    });

    const productSales = Object.values(productSalesMap).map(p => {
      const grossProfit = p.revenue - p.purchaseCost;
      const marginPercent = p.revenue > 0 ? (grossProfit / p.revenue) * 100 : 0;
      return {
        ...p,
        grossProfit,
        marginPercent
      };
    });

    res.json(productSales);
  } catch (error) {
    console.error('Get Product report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/reports/profit - Monthly gross profit summary
router.get('/profit', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden. Only Admins can access Profit Report.' });
  }
  
  const { startDate, endDate } = req.query;
  try {
    let whereCondition = { status: { [Op.ne]: 'Cancelled' } };
    if (startDate && endDate) {
      whereCondition.date = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }

    const invoices = await Invoice.findAll({
      where: whereCondition,
      include: [
        { 
          model: InvoiceItem, 
          as: 'items',
          include: [{ model: Product, as: 'product' }]
        }
      ]
    });

    let totalRevenue = 0;
    let totalPurchaseCost = 0;
    let totalDiscount = 0;

    invoices.forEach(inv => {
      totalDiscount += parseFloat(inv.discount);
      inv.items.forEach(item => {
        if (item.product) {
          totalRevenue += parseFloat(item.total);
          totalPurchaseCost += parseFloat(item.product.purchasePrice) * parseFloat(item.qty);
        }
      });
    });

    // Net Profit calculation
    const grossProfit = totalRevenue - totalPurchaseCost;

    res.json({
      revenue: totalRevenue,
      purchaseCost: totalPurchaseCost,
      discount: totalDiscount,
      grossProfit,
      marginPercent: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
    });

  } catch (error) {
    console.error('Get Profit report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/reports/outstanding - Invoices with pending payments
router.get('/outstanding', auth, async (req, res) => {
  try {
    const outstandingInvoices = await Invoice.findAll({
      where: {
        billType: 'Credit',
        status: 'Unpaid'
      },
      include: [{ model: Customer, as: 'customer' }],
      order: [['date', 'ASC']]
    });

    res.json(outstandingInvoices);
  } catch (error) {
    console.error('Get outstanding payments report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/reports/hsn - GSTR-1 HSN outward supplies summary report
router.get('/hsn', auth, async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    let whereCondition = { status: { [Op.ne]: 'Cancelled' } };
    if (startDate && endDate) {
      whereCondition.date = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }

    const invoices = await Invoice.findAll({
      where: whereCondition,
      include: [
        {
          model: InvoiceItem,
          as: 'items',
          include: [{ model: Product, as: 'product' }]
        }
      ]
    });

    const hsnMap = {};

    invoices.forEach(inv => {
      const invoiceIsInterstate = parseFloat(inv.igst) > 0;

      inv.items.forEach(item => {
        if (!item.product) return;
        const hsn = item.product.hsn || 'N/A';
        const unit = item.product.unit || 'Pcs';
        const key = `${hsn}_${unit}`;

        const qty = parseFloat(item.qty) || 0;
        const total = parseFloat(item.total) || 0;
        const rate = parseFloat(item.gstPercent) || 0;

        // Calculate taxable value and tax details
        const gstMultiplier = rate / 100;
        const taxable = total / (1 + gstMultiplier);
        const taxAmount = total - taxable;

        let cgst = 0;
        let sgst = 0;
        let igst = 0;

        if (invoiceIsInterstate) {
          igst = taxAmount;
        } else {
          cgst = taxAmount / 2;
          sgst = taxAmount / 2;
        }

        if (!hsnMap[key]) {
          hsnMap[key] = {
            hsn,
            description: item.product.name,
            uqc: unit,
            totalQty: 0,
            totalValue: 0,
            taxableValue: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
            totalTax: 0
          };
        } else {
          if (!hsnMap[key].description.includes(item.product.name)) {
            hsnMap[key].description = `${hsnMap[key].description}, ${item.product.name}`;
          }
        }

        hsnMap[key].totalQty += qty;
        hsnMap[key].totalValue += total;
        hsnMap[key].taxableValue += taxable;
        hsnMap[key].cgst += cgst;
        hsnMap[key].sgst += sgst;
        hsnMap[key].igst += igst;
        hsnMap[key].totalTax += taxAmount;
      });
    });

    const result = Object.values(hsnMap).map(item => {
      if (item.description.length > 100) {
        item.description = item.description.substring(0, 97) + '...';
      }
      return item;
    });

    res.json(result);
  } catch (error) {
    console.error('Get HSN report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
