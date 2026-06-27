const bcrypt = require('bcryptjs');
const { sequelize, User, Company, Product, Customer, Invoice, InvoiceItem } = require('../models');

async function seed() {
  try {
    console.log('Syncing database...');
    await sequelize.sync({ force: true });
    console.log('Database synced. Seeding tables...');

    // 1. Create Default Users
    const salt = await bcrypt.genSalt(10);
    const adminPassword = await bcrypt.hash('admin123', salt);
    const staffPassword = await bcrypt.hash('staff123', salt);

    await User.bulkCreate([
      {
        username: 'admin',
        email: 'admin@gstbiller.com',
        password: adminPassword,
        role: 'admin',
      },
      {
        username: 'staff',
        email: 'staff@gstbiller.com',
        password: staffPassword,
        role: 'staff',
      },
    ]);
    console.log('Users seeded.');

    // 2. Create Default Company Profile
    await Company.create({
      name: 'GreenField Agro & Fertilizers',
      address: 'Shop No. 12, Main Market Yard, Karnal, Haryana - 132001',
      gstin: '06AAAAA1111A1Z1', // 06 represents Haryana
      phone: '9876543210',
      email: 'contact@greenfieldagro.com',
      logo: null,
      bankName: 'State Bank of India',
      accountNo: '300123456789',
      ifsc: 'SBIN0001234',
      branch: 'Main Market Branch',
      invoiceTerms: '1. Goods once sold will not be returned or exchanged.\n2. We are not responsible for any damage in transit.\n3. All disputes are subject to local jurisdiction only.',
    });
    console.log('Company profile seeded.');

    // 3. Create Sample Customers
    const customers = await Customer.bulkCreate([
      {
        name: 'Ram Singh Farmers Ltd',
        mobile: '9988776655',
        address: 'Village Ramnagar, Karnal, Haryana',
        gstin: '06BBBBB2222B2Z2', // Same state - CGST/SGST
        email: 'ramsingh@gmail.com',
      },
      {
        name: 'Baldev Singh Union',
        mobile: '8877665544',
        address: 'Grain Market, Panipat, Haryana',
        gstin: null, // Unregistered Cash/Credit customer - CGST/SGST
        email: 'baldev@grainunion.org',
      },
      {
        name: 'Punjab Seed Distributors',
        mobile: '7766554433',
        address: 'Sector 17, Chandigarh, Punjab',
        gstin: '03CCCCC3333C3Z3', // Different state (03 Punjab) - IGST
        email: 'punjabseeds@yahoo.com',
      },
      {
        name: 'Karan Sharma Retailers',
        mobile: '9123456780',
        address: 'Railway Road, Kurukshetra, Haryana',
        gstin: null,
        email: 'karan.kurukshetra@gmail.com',
      },
    ]);
    console.log('Customers seeded.');

    // 4. Create Sample Products
    const products = await Product.bulkCreate([
      {
        name: 'Urea Fertilizer Bag (50kg)',
        sku: 'FERT-UREA-50',
        hsn: '31021000',
        gstPercent: 5.00,
        purchasePrice: 280.00,
        sellingPrice: 350.00,
        stockQty: 450.00,
        unit: 'Bags',
      },
      {
        name: 'DAP Fertilizer (50kg)',
        sku: 'FERT-DAP-50',
        hsn: '31053000',
        gstPercent: 5.00,
        purchasePrice: 1100.00,
        sellingPrice: 1350.00,
        stockQty: 180.00,
        unit: 'Bags',
      },
      {
        name: 'NPK Complex Fertilizer (50kg)',
        sku: 'FERT-NPK-50',
        hsn: '31052000',
        gstPercent: 12.00,
        purchasePrice: 950.00,
        sellingPrice: 1180.00,
        stockQty: 85.00,
        unit: 'Bags',
      },
      {
        name: 'Premium Neem Oil Spray (1 Ltr)',
        sku: 'PEST-NEEM-1L',
        hsn: '38089190',
        gstPercent: 18.00,
        purchasePrice: 180.00,
        sellingPrice: 260.00,
        stockQty: 24.00, // Low stock alert!
        unit: 'Ltr',
      },
      {
        name: 'Organic Compost Fertilizer (25kg)',
        sku: 'ORG-COMP-25',
        hsn: '31010099',
        gstPercent: 5.00,
        purchasePrice: 120.00,
        sellingPrice: 180.00,
        stockQty: 150.00,
        unit: 'Bags',
      },
      {
        name: 'Sprayer Machine (Manual/Battery 16L)',
        sku: 'EQP-SPRAY-16',
        hsn: '84248200',
        gstPercent: 18.00,
        purchasePrice: 1450.00,
        sellingPrice: 1999.00,
        stockQty: 8.00, // Low stock alert!
        unit: 'Pcs',
      },
      {
        name: 'Premium Hybrid Tomato Seeds (500g)',
        sku: 'SEED-TOM-500',
        hsn: '12099190',
        gstPercent: 0.00,
        purchasePrice: 450.00,
        sellingPrice: 599.00,
        stockQty: 50.00,
        unit: 'Pcs',
      },
    ]);
    console.log('Products seeded.');

    // 5. Create Sample Invoices (representing sales over the current month)
    console.log('Creating sample invoices...');
    const now = new Date();
    
    // Helper to format date offset
    const getPastDate = (daysAgo) => {
      const d = new Date();
      d.setDate(now.getDate() - daysAgo);
      return d;
    };

    // Invoice 1: Ram Singh (Intrastate, CGST/SGST) - Paid Cash
    const inv1 = await Invoice.create({
      invoiceNo: 'INV-2026-0001',
      date: getPastDate(15),
      customerId: customers[0].id,
      subtotal: 10450.00,
      discount: 450.00,
      cgst: 250.00,
      sgst: 250.00,
      igst: 0.00,
      roundOff: 0.00,
      grandTotal: 10500.00,
      paymentMode: 'Cash',
      status: 'Paid',
      billType: 'Cash',
    });
    await InvoiceItem.bulkCreate([
      { invoiceId: inv1.id, productId: products[0].id, qty: 10, rate: 350.00, discount: 50.00, gstPercent: 5.00, total: 3150.00 }, // Urea
      { invoiceId: inv1.id, productId: products[1].id, qty: 5, rate: 1350.00, discount: 400.00, gstPercent: 5.00, total: 6667.50 }, // DAP
    ]);

    // Invoice 2: Punjab Seed Distributors (Interstate, IGST) - Unpaid Credit
    const inv2 = await Invoice.create({
      invoiceNo: 'INV-2026-0002',
      date: getPastDate(8),
      customerId: customers[ PunjabSeedIndex = 2 ].id,
      subtotal: 21990.00,
      discount: 990.00,
      cgst: 0.00,
      sgst: 0.00,
      igst: 2520.00,
      roundOff: 0.00,
      grandTotal: 23520.00,
      paymentMode: 'Credit',
      status: 'Unpaid',
      billType: 'Credit',
    });
    await InvoiceItem.bulkCreate([
      { invoiceId: inv2.id, productId: products[1].id, qty: 10, rate: 1350.00, discount: 500.00, gstPercent: 5.00, total: 13650.00 }, // DAP
      { invoiceId: inv2.id, productId: products[5].id, qty: 4, rate: 1999.00, discount: 490.00, gstPercent: 18.00, total: 8857.08 }, // Sprayer
    ]);

    // Invoice 3: Baldev Singh (Intrastate, CGST/SGST) - Paid UPI
    const inv3 = await Invoice.create({
      invoiceNo: 'INV-2026-0003',
      date: getPastDate(2),
      customerId: customers[1].id,
      subtotal: 5120.00,
      discount: 120.00,
      cgst: 168.00,
      sgst: 168.00,
      igst: 0.00,
      roundOff: -0.00,
      grandTotal: 5336.00,
      paymentMode: 'UPI',
      status: 'Paid',
      billType: 'Cash',
    });
    await InvoiceItem.bulkCreate([
      { invoiceId: inv3.id, productId: products[2].id, qty: 3, rate: 1180.00, discount: 120.00, gstPercent: 12.00, total: 3830.40 }, // NPK
      { invoiceId: inv3.id, productId: products[3].id, qty: 6, rate: 260.00, discount: 0.00, gstPercent: 18.00, total: 1840.80 }, // Neem Oil
    ]);

    console.log('Invoices and items seeded.');
    console.log('All mock data seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

// Run seed if executed directly
if (require.main === module) {
  seed();
}
