const express = require('express');
const router = express.Router();
const { Customer, Invoice } = require('../models');
const auth = require('../middleware/auth');
const { Op } = require('sequelize');

// GET /api/customers - Get all customers with search
router.get('/', auth, async (req, res) => {
  const { search } = req.query;
  try {
    let whereCondition = {};
    if (search) {
      whereCondition = {
        [Op.or]: [
          { name: { [Op.like]: `%${search}%` } },
          { mobile: { [Op.like]: `%${search}%` } },
          { gstin: { [Op.like]: `%${search}%` } }
        ]
      };
    }
    const customers = await Customer.findAll({ where: whereCondition, order: [['name', 'ASC']] });
    res.json(customers);
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/customers/:id - Get specific customer details
router.get('/:id', auth, async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    console.error('Get customer by ID error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/customers/:id/ledger - Get customer ledger & outstanding details
router.get('/:id/ledger', auth, async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Get all invoices associated with customer
    const invoices = await Invoice.findAll({
      where: { customerId: req.params.id },
      order: [['date', 'DESC']],
    });

    // Calculate outstanding
    let totalPurchased = 0;
    let totalOutstanding = 0;
    
    invoices.forEach(inv => {
      if (inv.status !== 'Cancelled') {
        totalPurchased += parseFloat(inv.grandTotal);
        if (inv.billType === 'Credit' && inv.status === 'Unpaid') {
          totalOutstanding += parseFloat(inv.grandTotal);
        }
      }
    });

    res.json({
      customer,
      totalPurchased,
      totalOutstanding,
      ledger: invoices
    });
  } catch (error) {
    console.error('Get customer ledger error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/customers - Create a customer
router.post('/', auth, async (req, res) => {
  const { name, mobile, address, gstin, email } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Customer name is required' });
  }

  try {
    const newCustomer = await Customer.create({
      name,
      mobile,
      address,
      gstin,
      email,
    });
    res.status(201).json(newCustomer);
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/customers/:id - Update customer info
router.put('/:id', auth, async (req, res) => {
  const { name, mobile, address, gstin, email } = req.body;
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    await customer.update({
      name: name !== undefined ? name : customer.name,
      mobile: mobile !== undefined ? mobile : customer.mobile,
      address: address !== undefined ? address : customer.address,
      gstin: gstin !== undefined ? gstin : customer.gstin,
      email: email !== undefined ? email : customer.email,
    });

    res.json(customer);
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/customers/:id - Delete customer
router.delete('/:id', auth, async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Check if customer has associated invoices
    const invoiceCount = await Invoice.count({ where: { customerId: req.params.id } });
    if (invoiceCount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete customer. Outstanding bills/invoices exist in records.' 
      });
    }

    await customer.destroy();
    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
