const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// 1. User Model
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('admin', 'staff'),
    defaultValue: 'staff',
    allowNull: false,
  },
}, {
  timestamps: true,
});

// 2. Company Model
const Company = sequelize.define('Company', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'My Business Store',
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  gstin: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  logo: {
    type: DataTypes.STRING, // Path to logo file
    allowNull: true,
  },
  bankName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  accountNo: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  ifsc: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  branch: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  invoiceTerms: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: '1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged if payment is not made within due date.',
  },
}, {
  timestamps: true,
});

// 3. Product Model
const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  sku: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  hsn: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  gstPercent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 18.00,
  },
  purchasePrice: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  sellingPrice: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  stockQty: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  unit: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Pcs',
  },
  minStockLimit: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 10.00,
  },
}, {
  timestamps: true,
});

// 4. Customer Model
const Customer = sequelize.define('Customer', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  mobile: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  gstin: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  timestamps: true,
});

// 5. Invoice Model
const Invoice = sequelize.define('Invoice', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  invoiceNo: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  subtotal: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  discount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  cgst: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  sgst: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  igst: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  roundOff: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  grandTotal: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  paymentMode: {
    type: DataTypes.STRING, // 'Cash', 'UPI', 'Card', 'Bank Transfer', 'Credit'
    allowNull: false,
    defaultValue: 'Cash',
  },
  status: {
    type: DataTypes.STRING, // 'Paid', 'Unpaid', 'Cancelled'
    allowNull: false,
    defaultValue: 'Paid',
  },
  billType: {
    type: DataTypes.STRING, // 'Cash', 'Credit'
    allowNull: false,
    defaultValue: 'Cash',
  },
}, {
  timestamps: true,
});

// 6. InvoiceItem Model
const InvoiceItem = sequelize.define('InvoiceItem', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  qty: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  rate: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  discount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00, // Value or percentage? Let's save absolute discount amount for this item row
  },
  gstPercent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
  },
  total: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
}, {
  timestamps: false,
});

// Associations
Invoice.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Customer.hasMany(Invoice, { foreignKey: 'customerId', as: 'invoices' });

Invoice.hasMany(InvoiceItem, { foreignKey: 'invoiceId', as: 'items', onDelete: 'CASCADE' });
InvoiceItem.belongsTo(Invoice, { foreignKey: 'invoiceId' });

InvoiceItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Product.hasMany(InvoiceItem, { foreignKey: 'productId' });

module.exports = {
  sequelize,
  User,
  Company,
  Product,
  Customer,
  Invoice,
  InvoiceItem,
};
