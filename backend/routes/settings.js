const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Company, User, Product, Customer, Invoice, InvoiceItem, sequelize } = require('../models');
const auth = require('../middleware/auth');

// Configure multer storage for logo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const fileExt = path.extname(file.originalname);
    cb(null, `logo-${Date.now()}${fileExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB Limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only images (JPEG/JPG/PNG/WEBP) are allowed'));
  }
});

// GET /api/settings/company - Retrieve company profile
router.get('/company', auth, async (req, res) => {
  try {
    let company = await Company.findOne();
    if (!company) {
      // Create a default if none exists
      company = await Company.create({
        name: 'My Business Store',
        address: '',
        gstin: '',
        phone: '',
        email: '',
        logo: null,
      });
    }
    res.json(company);
  } catch (error) {
    console.error('Get company settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/settings/company - Update company details
router.put('/company', auth, async (req, res) => {
  const { name, address, gstin, phone, email, bankName, accountNo, ifsc, branch, invoiceTerms } = req.body;
  try {
    let company = await Company.findOne();
    if (!company) {
      company = await Company.create({});
    }

    await company.update({
      name: name !== undefined ? name : company.name,
      address: address !== undefined ? address : company.address,
      gstin: gstin !== undefined ? gstin : company.gstin,
      phone: phone !== undefined ? phone : company.phone,
      email: email !== undefined ? email : company.email,
      bankName: bankName !== undefined ? bankName : company.bankName,
      accountNo: accountNo !== undefined ? accountNo : company.accountNo,
      ifsc: ifsc !== undefined ? ifsc : company.ifsc,
      branch: branch !== undefined ? branch : company.branch,
      invoiceTerms: invoiceTerms !== undefined ? invoiceTerms : company.invoiceTerms,
    });

    res.json(company);
  } catch (error) {
    console.error('Update company settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/settings/company/logo - Upload company logo
router.post('/company/logo', auth, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image file' });
    }

    let company = await Company.findOne();
    if (!company) {
      company = await Company.create({});
    }

    // Delete old logo file if exists
    if (company.logo) {
      const oldPath = path.join(__dirname, '..', company.logo);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (e) {
          console.error('Error deleting old logo file:', e);
        }
      }
    }

    // Store relative path
    const logoUrl = `/uploads/${req.file.filename}`;
    await company.update({ logo: logoUrl });

    res.json({ message: 'Logo uploaded successfully', logo: logoUrl });
  } catch (error) {
    console.error('Upload logo settings error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// GET /api/settings/backup - Generate a database backup as JSON
router.get('/backup', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden. Only Admins can create backups.' });
  }

  try {
    const users = await User.findAll();
    const company = await Company.findAll();
    const products = await Product.findAll();
    const customers = await Customer.findAll();
    const invoices = await Invoice.findAll();
    const invoiceItems = await InvoiceItem.findAll();

    const backupData = {
      backupDate: new Date(),
      version: '1.0',
      users,
      company,
      products,
      customers,
      invoices,
      invoiceItems
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=gst-biller-backup-${Date.now()}.json`);
    res.send(JSON.stringify(backupData, null, 2));
  } catch (error) {
    console.error('Backup creation error:', error);
    res.status(500).json({ message: 'Server error during backup generation' });
  }
});

// POST /api/settings/restore - Restore data from JSON backup
router.post('/restore', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden. Only Admins can restore backups.' });
  }

  const { backupData } = req.body;
  if (!backupData || !backupData.version) {
    return res.status(400).json({ message: 'Invalid backup format' });
  }

  const t = await sequelize.transaction();

  try {
    // Clear existing tables
    await InvoiceItem.destroy({ where: {}, transaction: t });
    await Invoice.destroy({ where: {}, transaction: t });
    await Customer.destroy({ where: {}, transaction: t });
    await Product.destroy({ where: {}, transaction: t });
    await Company.destroy({ where: {}, transaction: t });
    await User.destroy({ where: {}, transaction: t });

    // Restore Users
    if (backupData.users && backupData.users.length > 0) {
      await User.bulkCreate(backupData.users, { transaction: t });
    }
    
    // Restore Company Profile
    if (backupData.company && backupData.company.length > 0) {
      await Company.bulkCreate(backupData.company, { transaction: t });
    }

    // Restore Products
    if (backupData.products && backupData.products.length > 0) {
      await Product.bulkCreate(backupData.products, { transaction: t });
    }

    // Restore Customers
    if (backupData.customers && backupData.customers.length > 0) {
      await Customer.bulkCreate(backupData.customers, { transaction: t });
    }

    // Restore Invoices
    if (backupData.invoices && backupData.invoices.length > 0) {
      await Invoice.bulkCreate(backupData.invoices, { transaction: t });
    }

    // Restore InvoiceItems
    if (backupData.invoiceItems && backupData.invoiceItems.length > 0) {
      await InvoiceItem.bulkCreate(backupData.invoiceItems, { transaction: t });
    }

    await t.commit();
    res.json({ message: 'Backup restored successfully' });
  } catch (error) {
    await t.rollback();
    console.error('Backup restore error:', error);
    res.status(500).json({ message: 'Server error during restore' });
  }
});

module.exports = router;
