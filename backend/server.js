const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { sequelize, User, Company } = require('./models');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static uploaded files (like logos)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/settings', require('./routes/settings'));

// Simple check API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../frontend', 'dist', 'index.html'));
  });
}

// Database Sync and Server Startup
async function startServer() {
  try {
    console.log('Connecting to database and syncing models...');
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');

    // Sync database
    await sequelize.sync();
    console.log('Database models synced.');

    // Safe auto-migration: Add minStockLimit to Products if it doesn't exist
    try {
      const tableInfo = await sequelize.getQueryInterface().describeTable('Products');
      if (!tableInfo.minStockLimit) {
        console.log('Adding minStockLimit column to Products table...');
        const { DataTypes } = require('sequelize');
        await sequelize.getQueryInterface().addColumn('Products', 'minStockLimit', {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 10.00
        });
        console.log('minStockLimit column added successfully.');
      }
    } catch (migError) {
      console.error('Error verifying or running Product table migration:', migError);
    }

    // Auto-create default admin and company if empty (bootstrap seeding)
    const userCount = await User.count();
    if (userCount === 0) {
      console.log('Database is empty. Bootstrapping initial data...');
      
      // Hashing default passwords
      const salt = await bcrypt.genSalt(10);
      const adminPassword = await bcrypt.hash('admin123', salt);
      const staffPassword = await bcrypt.hash('staff123', salt);

      await User.bulkCreate([
        { username: 'admin', email: 'admin@gstbiller.com', password: adminPassword, role: 'admin' },
        { username: 'staff', email: 'staff@gstbiller.com', password: staffPassword, role: 'staff' },
      ]);

      await Company.create({
        name: 'GreenField Agro & Fertilizers',
        address: 'Shop No. 12, Main Market Yard, Karnal, Haryana - 132001',
        gstin: '06AAAAA1111A1Z1',
        phone: '9876543210',
        email: 'contact@greenfieldagro.com',
        bankName: 'State Bank of India',
        accountNo: '300123456789',
        ifsc: 'SBIN0001234',
        branch: 'Main Market Branch',
        invoiceTerms: '1. Goods once sold will not be returned or exchanged.\n2. We are not responsible for any damage in transit.\n3. All disputes are subject to local jurisdiction only.',
      });
      console.log('Bootstrapping finished successfully.');
    }

    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir);
    }

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to connect to the database or start server:', error);
    process.exit(1);
  }
}

startServer();
