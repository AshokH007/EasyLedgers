const express = require('express');
const router = express.Router();
const { Product } = require('../models');
const auth = require('../middleware/auth');
const { Op } = require('sequelize');

// GET /api/products - Get all products with optional search query
router.get('/', auth, async (req, res) => {
  const { search } = req.query;
  try {
    let whereCondition = {};
    if (search) {
      whereCondition = {
        [Op.or]: [
          { name: { [Op.like]: `%${search}%` } },
          { sku: { [Op.like]: `%${search}%` } },
          { hsn: { [Op.like]: `%${search}%` } }
        ]
      };
    }
    const products = await Product.findAll({ where: whereCondition, order: [['name', 'ASC']] });
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/products/:id - Get specific product
router.get('/:id', auth, async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error('Get product by ID error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/products - Create a product
router.post('/', auth, async (req, res) => {
  const { name, sku, hsn, gstPercent, purchasePrice, sellingPrice, stockQty, unit, minStockLimit } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Product name is required' });
  }

  try {
    // Check if SKU exists
    if (sku) {
      const existing = await Product.findOne({ where: { sku } });
      if (existing) {
        return res.status(400).json({ message: 'Product with this SKU already exists' });
      }
    }

    const newProduct = await Product.create({
      name,
      sku: sku || `SKU-${Date.now()}`,
      hsn,
      gstPercent: gstPercent || 18.00,
      purchasePrice: purchasePrice || 0,
      sellingPrice: sellingPrice || 0,
      stockQty: stockQty || 0,
      unit: unit || 'Pcs',
      minStockLimit: minStockLimit !== undefined ? parseFloat(minStockLimit) : 10.00,
    });
    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/products/:id - Update product details
router.put('/:id', auth, async (req, res) => {
  const { name, sku, hsn, gstPercent, purchasePrice, sellingPrice, stockQty, unit, minStockLimit } = req.body;
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check SKU conflicts
    if (sku && sku !== product.sku) {
      const existing = await Product.findOne({ where: { sku } });
      if (existing) {
        return res.status(400).json({ message: 'Product with this SKU already exists' });
      }
    }

    await product.update({
      name: name !== undefined ? name : product.name,
      sku: sku !== undefined ? sku : product.sku,
      hsn: hsn !== undefined ? hsn : product.hsn,
      gstPercent: gstPercent !== undefined ? gstPercent : product.gstPercent,
      purchasePrice: purchasePrice !== undefined ? purchasePrice : product.purchasePrice,
      sellingPrice: sellingPrice !== undefined ? sellingPrice : product.sellingPrice,
      stockQty: stockQty !== undefined ? stockQty : product.stockQty,
      unit: unit !== undefined ? unit : product.unit,
      minStockLimit: minStockLimit !== undefined ? parseFloat(minStockLimit) : product.minStockLimit,
    });

    res.json(product);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/products/:id - Delete product (Admin only)
router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden. Only Admins can delete products.' });
  }

  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    await product.destroy();
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/products/import - Bulk import from JSON or CSV arrays
router.post('/import', auth, async (req, res) => {
  const { products } = req.body;
  if (!products || !Array.isArray(products)) {
    return res.status(400).json({ message: 'Invalid products data. Must be an array.' });
  }

  try {
    let createdCount = 0;
    let updatedCount = 0;

    for (const item of products) {
      if (!item.name) continue;
      
      const sku = item.sku || `SKU-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

      // Check if item SKU already exists
      const existingProduct = await Product.findOne({ where: { sku } });
      if (existingProduct) {
        await existingProduct.update({
          name: item.name,
          hsn: item.hsn || existingProduct.hsn,
          gstPercent: item.gstPercent !== undefined ? parseFloat(item.gstPercent) : existingProduct.gstPercent,
          purchasePrice: item.purchasePrice !== undefined ? parseFloat(item.purchasePrice) : existingProduct.purchasePrice,
          sellingPrice: item.sellingPrice !== undefined ? parseFloat(item.sellingPrice) : existingProduct.sellingPrice,
          stockQty: item.stockQty !== undefined ? parseFloat(item.stockQty) : existingProduct.stockQty,
          unit: item.unit || existingProduct.unit,
          minStockLimit: item.minStockLimit !== undefined ? parseFloat(item.minStockLimit) : existingProduct.minStockLimit,
        });
        updatedCount++;
      } else {
        await Product.create({
          name: item.name,
          sku,
          hsn: item.hsn || '',
          gstPercent: item.gstPercent !== undefined ? parseFloat(item.gstPercent) : 18.00,
          purchasePrice: item.purchasePrice !== undefined ? parseFloat(item.purchasePrice) : 0,
          sellingPrice: item.sellingPrice !== undefined ? parseFloat(item.sellingPrice) : 0,
          stockQty: item.stockQty !== undefined ? parseFloat(item.stockQty) : 0,
          unit: item.unit || 'Pcs',
          minStockLimit: item.minStockLimit !== undefined ? parseFloat(item.minStockLimit) : 10.00,
        });
        createdCount++;
      }
    }

    res.json({ message: 'Import completed successfully', createdCount, updatedCount });
  } catch (error) {
    console.error('Import products error:', error);
    res.status(500).json({ message: 'Server error during import' });
  }
});

module.exports = router;
