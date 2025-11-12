// controllers/admin/productManagementController.js
const Product = require("../../models/Product");
const Order = require("../../models/Order");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

// @desc    Get all products with advanced filtering and pagination
// @route   GET /api/admin/products
// @access  Private (Admin - canManageProducts)
const getAllProducts = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const {
      page = 1,
      limit = 20,
      search,
      category,
      status,
      featured,
      minPrice,
      maxPrice,
      minStock,
      maxStock,
      sortBy = "createdAt",
      sortOrder = "desc",
      dateFrom,
      dateTo,
    } = req.query;

    // Build filter
    const filter = {};

    // Search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
        { "specifications.brand": { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }

    // Category filter
    if (category) {
      filter.category = { $regex: category, $options: "i" };
    }

    // Status filter
    if (status) {
      filter.status = status;
    }

    // Featured filter
    if (featured !== undefined) {
      filter.featured = featured === "true";
    }

    // Price range filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    // Stock range filter
    if (minStock !== undefined || maxStock !== undefined) {
      filter["inventory.quantity"] = {};
      if (minStock !== undefined)
        filter["inventory.quantity"].$gte = parseInt(minStock);
      if (maxStock !== undefined)
        filter["inventory.quantity"].$lte = parseInt(maxStock);
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Get products with pagination
    const products = await Product.find(filter)
      .select("-__v")
      .sort(sortConfig)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get total count for pagination
    const totalProducts = await Product.countDocuments(filter);

    // Get product statistics with sales data
    const productsWithStats = await Promise.all(
      products.map(async (product) => {
        const salesData = await Order.aggregate([
          {
            $match: {
              "items.productId": product._id,
              paymentStatus: "paid",
            },
          },
          { $unwind: "$items" },
          {
            $match: {
              "items.productId": product._id,
            },
          },
          {
            $group: {
              _id: "$items.productId",
              totalSold: { $sum: "$items.quantity" },
              totalRevenue: { $sum: "$items.subtotal" },
            },
          },
        ]);

        return {
          ...product.toObject(),
          sales: salesData[0] || {
            totalSold: 0,
            totalRevenue: 0,
          },
        };
      })
    );

    // Get overall product statistics
    const productStats = await Product.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          activeProducts: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
          },
          outOfStockProducts: {
            $sum: { $cond: [{ $eq: ["$inventory.quantity", 0] }, 1, 0] },
          },
          lowStockProducts: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$inventory.quantity", 0] },
                    {
                      $lte: ["$inventory.quantity", "$inventory.lowStockAlert"],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
          totalValue: {
            $sum: { $multiply: ["$price", "$inventory.quantity"] },
          },
          averagePrice: { $avg: "$price" },
        },
      },
    ]);

    // Get category distribution
    const categoryStats = await Product.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          totalValue: {
            $sum: { $multiply: ["$price", "$inventory.quantity"] },
          },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      data: {
        products: productsWithStats,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalProducts / limit),
          totalProducts,
          hasNext: page * limit < totalProducts,
          hasPrev: page > 1,
        },
        statistics: productStats[0] || {
          totalProducts: 0,
          activeProducts: 0,
          outOfStockProducts: 0,
          lowStockProducts: 0,
          totalValue: 0,
          averagePrice: 0,
        },
        categories: categoryStats,
        filters: {
          search,
          category,
          status,
          featured,
          minPrice,
          maxPrice,
          minStock,
          maxStock,
          dateFrom,
          dateTo,
        },
      },
    });
  } catch (error) {
    console.error("Get all products error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching products",
      error: error.message,
    });
  }
};

// @desc    Get product by ID with detailed analytics
// @route   GET /api/admin/products/:productId
// @access  Private (Admin - canManageProducts)
const getProductById = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Get detailed sales analytics
    const salesAnalytics = await Order.aggregate([
      {
        $match: {
          "items.productId": new mongoose.Types.ObjectId(productId),
          paymentStatus: "paid",
        },
      },
      { $unwind: "$items" },
      {
        $match: {
          "items.productId": new mongoose.Types.ObjectId(productId),
        },
      },
      {
        $group: {
          _id: null,
          totalSold: { $sum: "$items.quantity" },
          totalRevenue: { $sum: "$items.subtotal" },
          averageSalePrice: { $avg: "$items.price" },
          ordersCount: { $sum: 1 },
        },
      },
    ]);

    // Get monthly sales trend
    const monthlySales = await Order.aggregate([
      {
        $match: {
          "items.productId": new mongoose.Types.ObjectId(productId),
          paymentStatus: "paid",
          createdAt: { $gte: new Date(new Date().getFullYear(), 0, 1) }, // Current year
        },
      },
      { $unwind: "$items" },
      {
        $match: {
          "items.productId": new mongoose.Types.ObjectId(productId),
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          quantitySold: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.subtotal" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Get recent orders containing this product
    const recentOrders = await Order.find({
      "items.productId": productId,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("orderNumber status totals.total createdAt")
      .populate("userId", "username email");

    const salesData = salesAnalytics[0] || {
      totalSold: 0,
      totalRevenue: 0,
      averageSalePrice: 0,
      ordersCount: 0,
    };

    // Calculate inventory metrics
    const inventoryMetrics = {
      stockValue: product.price * product.inventory.quantity,
      stockOutRisk:
        product.inventory.quantity <= product.inventory.lowStockAlert,
      turnoverRate:
        salesData.totalSold > 0
          ? (salesData.totalSold / product.inventory.quantity) * 100
          : 0,
    };

    res.json({
      success: true,
      data: {
        product,
        analytics: {
          sales: salesData,
          monthlyTrend: monthlySales,
          inventory: inventoryMetrics,
          performance: {
            conversionRate: calculateProductConversionRate(
              salesData.ordersCount
            ),
            revenuePerUnit:
              salesData.totalSold > 0
                ? salesData.totalRevenue / salesData.totalSold
                : 0,
          },
        },
        recentOrders,
        recommendations: await getProductRecommendations(
          productId,
          product.category
        ),
      },
    });
  } catch (error) {
    console.error("Get product by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching product",
      error: error.message,
    });
  }
};

// @desc    Create new product
// @route   POST /api/admin/products
// @access  Private (Admin - canManageProducts)
const createProduct = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const {
      name,
      description,
      sku,
      category,
      subcategory,
      price,
      comparePrice,
      cost,
      inventory,
      images,
      specifications,
      seo,
      tags,
      status = "draft",
      featured = false,
    } = req.body;

    // Check if SKU already exists
    const existingProduct = await Product.findOne({ sku });
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: "Product with this SKU already exists",
      });
    }

    // Generate slug from name if not provided
    let productSlug = seo?.slug;
    if (!productSlug) {
      productSlug = generateSlug(name);
    }

    // Create product
    const product = new Product({
      name,
      description,
      sku,
      category,
      subcategory,
      price,
      comparePrice,
      cost,
      inventory: {
        quantity: inventory?.quantity || 0,
        lowStockAlert: inventory?.lowStockAlert || 10,
        trackQuantity: inventory?.trackQuantity !== false,
      },
      images: images || [],
      specifications: specifications || {},
      seo: {
        metaTitle: seo?.metaTitle || name,
        metaDescription: seo?.metaDescription || description.substring(0, 160),
        slug: productSlug,
      },
      tags: tags || [],
      status,
      featured,
      createdBy: req.admin.adminId,
    });

    await product.save();

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: {
        product,
      },
    });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating product",
      error: error.message,
    });
  }
};

// @desc    Update product
// @route   PUT /api/admin/products/:productId
// @access  Private (Admin - canManageProducts)
const updateProduct = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { productId } = req.params;
    const updateData = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Handle SKU uniqueness check if SKU is being updated
    if (updateData.sku && updateData.sku !== product.sku) {
      const existingProduct = await Product.findOne({ sku: updateData.sku });
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: "Product with this SKU already exists",
        });
      }
    }

    // Handle slug generation if name is updated
    if (updateData.name && !updateData.seo?.slug) {
      updateData.seo = {
        ...product.seo,
        ...updateData.seo,
        slug: generateSlug(updateData.name),
      };
    }

    // Update product fields
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] !== undefined && updateData[key] !== null) {
        if (key === "inventory" && typeof updateData[key] === "object") {
          product.inventory = { ...product.inventory, ...updateData[key] };
        } else if (
          key === "specifications" &&
          typeof updateData[key] === "object"
        ) {
          product.specifications = {
            ...product.specifications,
            ...updateData[key],
          };
        } else if (key === "seo" && typeof updateData[key] === "object") {
          product.seo = { ...product.seo, ...updateData[key] };
        } else {
          product[key] = updateData[key];
        }
      }
    });

    product.updatedAt = new Date();
    product.updatedBy = req.admin.adminId;
    await product.save();

    res.json({
      success: true,
      message: "Product updated successfully",
      data: {
        product,
      },
    });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating product",
      error: error.message,
    });
  }
};

// @desc    Delete product (soft delete)
// @route   DELETE /api/admin/products/:productId
// @access  Private (Admin - canManageProducts)
const deleteProduct = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { productId } = req.params;
    const { reason = "Admin deletion" } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check if product has active orders
    const activeOrders = await Order.findOne({
      "items.productId": productId,
      status: { $in: ["pending", "confirmed", "shipped"] },
    });

    if (activeOrders) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete product with active orders. Please handle orders first.",
      });
    }

    // Soft delete - change status to inactive
    product.status = "inactive";
    product.deletedAt = new Date();
    product.deletedBy = req.admin.adminId;
    product.deletionReason = reason;
    await product.save();

    res.json({
      success: true,
      message: "Product deleted successfully",
      data: {
        deletedAt: product.deletedAt,
        deletionReason: product.deletionReason,
      },
    });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting product",
      error: error.message,
    });
  }
};

// @desc    Bulk product operations
// @route   POST /api/admin/products/bulk
// @access  Private (Admin - canManageProducts)
const bulkProductOperations = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { productIds, action, data } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Product IDs array is required",
      });
    }

    let result;
    let message;

    switch (action) {
      case "activate":
        result = await Product.updateMany(
          { _id: { $in: productIds } },
          {
            $set: {
              status: "active",
              updatedAt: new Date(),
              updatedBy: req.admin.adminId,
            },
          }
        );
        message = `${result.modifiedCount} products activated successfully`;
        break;

      case "deactivate":
        result = await Product.updateMany(
          { _id: { $in: productIds } },
          {
            $set: {
              status: "inactive",
              updatedAt: new Date(),
              updatedBy: req.admin.adminId,
            },
          }
        );
        message = `${result.modifiedCount} products deactivated successfully`;
        break;

      case "delete":
        // Soft delete multiple products
        result = await Product.updateMany(
          { _id: { $in: productIds } },
          {
            $set: {
              status: "inactive",
              deletedAt: new Date(),
              deletedBy: req.admin.adminId,
              deletionReason: data?.reason || "Bulk deletion",
            },
          }
        );
        message = `${result.modifiedCount} products deleted successfully`;
        break;

      case "update_inventory":
        if (!data || data.quantity === undefined) {
          return res.status(400).json({
            success: false,
            message: "Quantity is required for inventory update",
          });
        }

        result = await Product.updateMany(
          { _id: { $in: productIds } },
          {
            $set: {
              "inventory.quantity": parseInt(data.quantity),
              updatedAt: new Date(),
              updatedBy: req.admin.adminId,
            },
          }
        );
        message = `${result.modifiedCount} products inventory updated successfully`;
        break;

      case "update_price":
        if (!data || data.price === undefined) {
          return res.status(400).json({
            success: false,
            message: "Price is required for price update",
          });
        }

        const updateField =
          data.field === "comparePrice" ? "comparePrice" : "price";
        result = await Product.updateMany(
          { _id: { $in: productIds } },
          {
            $set: {
              [updateField]: parseFloat(data.price),
              updatedAt: new Date(),
              updatedBy: req.admin.adminId,
            },
          }
        );
        message = `${result.modifiedCount} products ${updateField} updated successfully`;
        break;

      case "export":
        // Get products for export with sales data
        const products = await Product.find({ _id: { $in: productIds } })
          .select("-__v")
          .populate("createdBy", "username profile")
          .populate("updatedBy", "username profile");

        // Add sales data to exported products
        const productsWithSales = await Promise.all(
          products.map(async (product) => {
            const salesData = await Order.aggregate([
              {
                $match: {
                  "items.productId": product._id,
                  paymentStatus: "paid",
                },
              },
              { $unwind: "$items" },
              {
                $match: {
                  "items.productId": product._id,
                },
              },
              {
                $group: {
                  _id: "$items.productId",
                  totalSold: { $sum: "$items.quantity" },
                  totalRevenue: { $sum: "$items.subtotal" },
                },
              },
            ]);

            return {
              ...product.toObject(),
              sales: salesData[0] || { totalSold: 0, totalRevenue: 0 },
            };
          })
        );

        result = {
          action: "export",
          count: productsWithSales.length,
          data: productsWithSales,
        };
        message = `${productsWithSales.length} products exported successfully`;
        break;

      default:
        return res.status(400).json({
          success: false,
          message:
            "Invalid action. Supported actions: activate, deactivate, delete, update_inventory, update_price, export",
        });
    }

    res.json({
      success: true,
      message,
      data: result,
    });
  } catch (error) {
    console.error("Bulk product operations error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while performing bulk operations",
      error: error.message,
    });
  }
};

// @desc    Update product inventory with operation type
// @route   PUT /api/admin/products/:productId/inventory
// @access  Private (Admin - canManageInventory)
const updateProductInventory = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { productId } = req.params;
    const { quantity, operation = "set", reason } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    let newQuantity;
    const oldQuantity = product.inventory.quantity;

    switch (operation) {
      case "set":
        newQuantity = parseInt(quantity);
        break;
      case "increment":
        newQuantity = oldQuantity + parseInt(quantity);
        break;
      case "decrement":
        newQuantity = Math.max(0, oldQuantity - parseInt(quantity));
        break;
      default:
        return res.status(400).json({
          success: false,
          message: "Invalid operation. Use: set, increment, or decrement",
        });
    }

    // Update inventory
    product.inventory.quantity = newQuantity;
    product.updatedAt = new Date();
    product.updatedBy = req.admin.adminId;

    // Add inventory change to history if needed
    if (product.inventoryHistory) {
      product.inventoryHistory.push({
        previousQuantity: oldQuantity,
        newQuantity: newQuantity,
        change: newQuantity - oldQuantity,
        operation,
        reason: reason || "Manual adjustment",
        changedBy: req.admin.adminId,
        changedAt: new Date(),
      });
    }

    await product.save();

    res.json({
      success: true,
      message: "Product inventory updated successfully",
      data: {
        product: {
          _id: product._id,
          name: product.name,
          sku: product.sku,
          inventory: {
            previousQuantity: oldQuantity,
            newQuantity: product.inventory.quantity,
            change: product.inventory.quantity - oldQuantity,
            operation,
          },
        },
      },
    });
  } catch (error) {
    console.error("Update product inventory error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating product inventory",
      error: error.message,
    });
  }
};

// @desc    Get low stock alerts
// @route   GET /api/admin/products/alerts/low-stock
// @access  Private (Admin - canManageInventory)
const getLowStockAlerts = async (req, res) => {
  try {
    const { threshold = 10, page = 1, limit = 20 } = req.query;

    const lowStockProducts = await Product.find({
      "inventory.quantity": { $lte: parseInt(threshold) },
      status: "active",
      "inventory.trackQuantity": true,
    })
      .select(
        "name sku price inventory.quantity inventory.lowStockAlert images category"
      )
      .sort({ "inventory.quantity": 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const totalLowStock = await Product.countDocuments({
      "inventory.quantity": { $lte: parseInt(threshold) },
      status: "active",
      "inventory.trackQuantity": true,
    });

    // Calculate restock urgency
    const productsWithUrgency = lowStockProducts.map((product) => ({
      ...product.toObject(),
      urgency: calculateRestockUrgency(
        product.inventory.quantity,
        product.inventory.lowStockAlert
      ),
      restockNeeded:
        product.inventory.quantity === 0
          ? "CRITICAL"
          : product.inventory.quantity <= product.inventory.lowStockAlert / 2
          ? "HIGH"
          : "MEDIUM",
    }));

    res.json({
      success: true,
      data: {
        products: productsWithUrgency,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalLowStock / limit),
          totalLowStock,
        },
        alertSummary: {
          critical: productsWithUrgency.filter(
            (p) => p.restockNeeded === "CRITICAL"
          ).length,
          high: productsWithUrgency.filter((p) => p.restockNeeded === "HIGH")
            .length,
          medium: productsWithUrgency.filter(
            (p) => p.restockNeeded === "MEDIUM"
          ).length,
          threshold: parseInt(threshold),
        },
      },
    });
  } catch (error) {
    console.error("Get low stock alerts error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching low stock alerts",
      error: error.message,
    });
  }
};

// Helper Functions

const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const calculateProductConversionRate = (ordersCount) => {
  // This would typically involve more complex calculation
  // For now, return a simple percentage
  return ordersCount > 0 ? Math.min(ordersCount * 2, 100) : 0;
};

const getProductRecommendations = async (productId, category) => {
  return await Product.find({
    category: category,
    status: "active",
    _id: { $ne: productId },
  })
    .limit(4)
    .select("name price images slug category")
    .sort({ createdAt: -1 });
};

const calculateRestockUrgency = (currentStock, lowStockAlert) => {
  if (currentStock === 0) return 100;
  if (currentStock <= lowStockAlert / 2) return 75;
  if (currentStock <= lowStockAlert) return 50;
  return 25;
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkProductOperations,
  updateProductInventory,
  getLowStockAlerts,
};
