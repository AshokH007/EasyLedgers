const express = require('express');
const router = express.Router();
const { Invoice, InvoiceItem, Customer, Product, sequelize } = require('../models');
const auth = require('../middleware/auth');
const { Op } = require('sequelize');

// GET /api/invoices - List invoices with filters
router.get('/', auth, async (req, res) => {
  const { search, status, paymentMode, startDate, endDate } = req.query;
  try {
    let whereCondition = {};
    
    // Search by invoice no
    if (search) {
      whereCondition.invoiceNo = { [Op.like]: `%${search}%` };
    }

    // Status filter
    if (status) {
      whereCondition.status = status;
    }

    // Payment mode filter
    if (paymentMode) {
      whereCondition.paymentMode = paymentMode;
    }

    // Date range filter
    if (startDate && endDate) {
      whereCondition.date = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    } else if (startDate) {
      whereCondition.date = {
        [Op.gte]: new Date(startDate)
      };
    } else if (endDate) {
      whereCondition.date = {
        [Op.lte]: new Date(endDate)
      };
    }

    const invoices = await Invoice.findAll({
      where: whereCondition,
      include: [
        { model: Customer, as: 'customer', attributes: ['name', 'mobile', 'gstin'] }
      ],
      order: [['date', 'DESC'], ['id', 'DESC']]
    });

    res.json(invoices);
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/invoices/:id - Detailed invoice view
router.get('/:id', auth, async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id, {
      include: [
        { model: Customer, as: 'customer' },
        { 
          model: InvoiceItem, 
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['name', 'sku', 'hsn', 'unit'] }]
        }
      ]
    });

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json(invoice);
  } catch (error) {
    console.error('Get invoice details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/invoices - Create a new invoice (auto-increments number, updates product inventory stock)
router.post('/', auth, async (req, res) => {
  const { 
    customerId, 
    date, 
    items, 
    subtotal, 
    discount, 
    cgst, 
    sgst, 
    igst, 
    roundOff, 
    grandTotal, 
    paymentMode, 
    billType, 
    status 
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'At least one product item is required' });
  }

  // Start a transaction to ensure database consistency
  const t = await sequelize.transaction();

  try {
    // 1. Auto-generate next Invoice Number
    const lastInvoice = await Invoice.findOne({
      order: [['id', 'DESC']],
      lock: true, // Lock for concurrency
      transaction: t,
    });

    let nextInvoiceNo = 'INV-2026-0001';
    if (lastInvoice) {
      const lastNo = lastInvoice.invoiceNo;
      const match = lastNo.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1]) + 1;
        const padding = match[1].length;
        const prefix = lastNo.substring(0, lastNo.length - match[1].length);
        nextInvoiceNo = prefix + String(num).padStart(padding, '0');
      } else {
        nextInvoiceNo = `INV-2026-${Date.now()}`;
      }
    }

    // 2. Create the Invoice
    const newInvoice = await Invoice.create({
      invoiceNo: nextInvoiceNo,
      date: date || new Date(),
      customerId,
      subtotal,
      discount: discount || 0.00,
      cgst: cgst || 0.00,
      sgst: sgst || 0.00,
      igst: igst || 0.00,
      roundOff: roundOff || 0.00,
      grandTotal,
      paymentMode: paymentMode || 'Cash',
      billType: billType || 'Cash',
      status: status || 'Paid',
    }, { transaction: t });

    // 3. Process items and update stock
    for (const item of items) {
      const { productId, qty, rate, discount: itemDiscount, gstPercent, total } = item;
      
      // Save item record
      await InvoiceItem.create({
        invoiceId: newInvoice.id,
        productId,
        qty,
        rate,
        discount: itemDiscount || 0.00,
        gstPercent,
        total,
      }, { transaction: t });

      // Update product inventory stock qty
      const product = await Product.findByPk(productId, { transaction: t, lock: true });
      if (product) {
        const newStock = parseFloat(product.stockQty) - parseFloat(qty);
        await product.update({ stockQty: newStock }, { transaction: t });
      }
    }

    // Commit transaction
    await t.commit();

    res.status(201).json(newInvoice);
  } catch (error) {
    // Rollback transaction on failure
    await t.rollback();
    console.error('Invoice creation error:', error);
    res.status(500).json({ message: 'Server error during invoice creation' });
  }
});

// PUT /api/invoices/:id/status - Update invoice payment status (e.g. Credit Invoice paid later)
router.put('/:id/status', auth, async (req, res) => {
  const { status, paymentMode } = req.body;
  if (!status) {
    return res.status(400).json({ message: 'Status is required' });
  }

  try {
    const invoice = await Invoice.findByPk(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    await invoice.update({
      status,
      paymentMode: paymentMode || invoice.paymentMode,
    });

    res.json({ message: 'Invoice status updated successfully', invoice });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/invoices/:id/cancel - Cancel Invoice & return inventory products to stock
router.put('/:id/cancel', auth, async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const invoice = await Invoice.findByPk(req.params.id, {
      include: [{ model: InvoiceItem, as: 'items' }],
      transaction: t,
    });

    if (!invoice) {
      await t.rollback();
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (invoice.status === 'Cancelled') {
      await t.rollback();
      return res.status(400).json({ message: 'Invoice is already cancelled' });
    }

    // Restore inventory quantities
    for (const item of invoice.items) {
      const product = await Product.findByPk(item.productId, { transaction: t, lock: true });
      if (product) {
        const restoredStock = parseFloat(product.stockQty) + parseFloat(item.qty);
        await product.update({ stockQty: restoredStock }, { transaction: t });
      }
    }

    // Set invoice status to Cancelled
    await invoice.update({ status: 'Cancelled' }, { transaction: t });

    await t.commit();
    res.json({ message: 'Invoice cancelled and stock restored successfully', invoice });
  } catch (error) {
    await t.rollback();
    console.error('Cancel invoice error:', error);
    res.status(500).json({ message: 'Server error during invoice cancellation' });
  }
});

// DELETE /api/invoices/:id - Delete invoice (resets stock if not already cancelled, Admin only)
router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden. Only Admins can delete invoice records.' });
  }

  const t = await sequelize.transaction();
  try {
    const invoice = await Invoice.findByPk(req.params.id, {
      include: [{ model: InvoiceItem, as: 'items' }],
      transaction: t,
    });

    if (!invoice) {
      await t.rollback();
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // If invoice was not cancelled, return stock first
    if (invoice.status !== 'Cancelled') {
      for (const item of invoice.items) {
        const product = await Product.findByPk(item.productId, { transaction: t, lock: true });
        if (product) {
          const restoredStock = parseFloat(product.stockQty) + parseFloat(item.qty);
          await product.update({ stockQty: restoredStock }, { transaction: t });
        }
      }
    }

    await invoice.destroy({ transaction: t });
    await t.commit();

    res.json({ message: 'Invoice permanently deleted from database and stock adjusted.' });
  } catch (error) {
    await t.rollback();
    console.error('Delete invoice error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/invoices/:id - Update an existing invoice (restores old stock, updates details, deducts new stock)
router.put('/:id', auth, async (req, res) => {
  const { 
    customerId, 
    date, 
    items, 
    subtotal, 
    discount, 
    cgst, 
    sgst, 
    igst, 
    roundOff, 
    grandTotal, 
    paymentMode, 
    billType, 
    status 
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'At least one product item is required' });
  }

  const t = await sequelize.transaction();

  try {
    const invoice = await Invoice.findByPk(req.params.id, {
      include: [{ model: InvoiceItem, as: 'items' }],
      transaction: t,
    });

    if (!invoice) {
      await t.rollback();
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (invoice.status === 'Cancelled') {
      await t.rollback();
      return res.status(400).json({ message: 'Cannot edit a cancelled invoice' });
    }

    // 1. Revert old stock levels
    for (const oldItem of invoice.items) {
      const product = await Product.findByPk(oldItem.productId, { transaction: t, lock: true });
      if (product) {
        const restoredStock = parseFloat(product.stockQty) + parseFloat(oldItem.qty);
        await product.update({ stockQty: restoredStock }, { transaction: t });
      }
    }

    // 2. Delete old invoice items
    await InvoiceItem.destroy({
      where: { invoiceId: invoice.id },
      transaction: t,
    });

    // 3. Create new invoice items and deduct new stock
    for (const newItem of items) {
      const { productId, qty, rate, discount: itemDiscount, gstPercent, total } = newItem;
      
      await InvoiceItem.create({
        invoiceId: invoice.id,
        productId,
        qty,
        rate,
        discount: itemDiscount || 0.00,
        gstPercent,
        total,
      }, { transaction: t });

      const product = await Product.findByPk(productId, { transaction: t, lock: true });
      if (product) {
        const newStock = parseFloat(product.stockQty) - parseFloat(qty);
        await product.update({ stockQty: newStock }, { transaction: t });
      }
    }

    // 4. Update the Invoice main record
    await invoice.update({
      date: date || invoice.date,
      customerId,
      subtotal,
      discount: discount || 0.00,
      cgst: cgst || 0.00,
      sgst: sgst || 0.00,
      igst: igst || 0.00,
      roundOff: roundOff || 0.00,
      grandTotal,
      paymentMode: paymentMode || invoice.paymentMode,
      billType: billType || invoice.billType,
      status: status || invoice.status,
    }, { transaction: t });

    await t.commit();
    res.json({ message: 'Invoice updated successfully', invoice });
  } catch (error) {
    await t.rollback();
    console.error('Invoice update error:', error);
    res.status(500).json({ message: 'Server error during invoice update' });
  }
});

module.exports = router;
