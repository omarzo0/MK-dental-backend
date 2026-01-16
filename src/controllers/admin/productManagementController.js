// controllers/admin/productManagementController.js
const Product = require("../../models/Product");
const Order = require("../../models/Order");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const { formatImageArray, formatImageUrl, stripBaseUrl, stripImageArray } = require("../../utils/imageHelper");
const Category = require("../../models/Category");

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
      productType,
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

    // Product type filter (single or package)
    if (productType) {
      filter.productType = productType;
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

    // Enhance products with stats and sales data
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
          isActive: product.status === "active",
          originalPrice: product.comparePrice || product.price,
          image: product.images?.[0] ? formatImageUrl(req, product.images[0]) : null,
          images: formatImageArray(req, product.images),
          isOnSale: product.discount?.isActive && (!product.discount?.endDate || new Date(product.discount.endDate) > new Date()),
          discountPercentage: product.discount?.type === 'percentage' ? product.discount.value : 0,
          discountedPrice: product.discount?.discountedPrice || product.price,
          items: (product.packageItems || []).map((item) => ({
            ...item.toObject(),
            image: formatImageUrl(req, item.image),
          })),
          ...(product.productType === "package" &&
            product.packageItems && {
            packageItems: product.packageItems.map((item) => ({
              ...item.toObject(),
              image: formatImageUrl(req, item.image),
            })),
          }),
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

    // Determine if we should return 'packages' or 'products' key
    const isPackageType = productType === "package" || (req.originalUrl && req.originalUrl.includes("/packages"));
    const dataKey = isPackageType ? "packages" : "products";

    res.json({
      success: true,
      data: {
        [dataKey]: productsWithStats,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalProducts / limit),
          totalProducts,
          ...(isPackageType && { totalPackages: totalProducts }),
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
          productType
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

    let product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Populate package items if it's a package
    if (product.productType === "package") {
      product = await Product.findById(productId).populate({
        path: "packageItems.productId",
        select: "name price images inventory status",
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
        product: {
          ...product.toObject(),
          isActive: product.status === "active",
          originalPrice: product.comparePrice || product.price,
          image: product.images?.[0] ? formatImageUrl(req, product.images[0]) : null,
          images: formatImageArray(req, product.images),
          isOnSale: product.discount?.isActive && (!product.discount?.endDate || new Date(product.discount.endDate) > new Date()),
          discountPercentage: product.discount?.type === 'percentage' ? product.discount.value : 0,
          discountedPrice: product.discount?.discountedPrice || product.price,
          ...(product.productType === "package" &&
            product.packageItems && {
            items: product.packageItems.map((item) => ({
              ...item.toObject(),
              image: formatImageUrl(req, item.image),
              productId: item.productId
                ? {
                  ...item.productId.toObject(),
                  images: formatImageArray(req, item.productId.images),
                  isOnSale: item.productId.discount?.isActive,
                  discountedPrice: item.productId.discount?.discountedPrice || item.productId.price
                }
                : null,
            })),
            packageItems: product.packageItems.map((item) => ({
              ...item.toObject(),
              image: formatImageUrl(req, item.image),
              productId: item.productId
                ? {
                  ...item.productId.toObject(),
                  images: formatImageArray(req, item.productId.images),
                  isOnSale: item.productId.discount?.isActive,
                  discountedPrice: item.productId.discount?.discountedPrice || item.productId.price
                }
                : null,
            })),
          }),
        },
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
      category,
      price,
      cost,
      inventory,
      images,
      image, // Support singular image field
      specifications,
      seo,
      tags,
      status = "draft",
      featured = false,
      discount,
      productType = "single",
      packageItems,
      subcategory,
    } = req.body;

    let finalCategory = category;
    if (productType === "package") {
      finalCategory = "Packages";
    }

    // Validate category and subcategory
    let categoryDoc;
    if (mongoose.Types.ObjectId.isValid(finalCategory)) {
      categoryDoc = await Category.findById(finalCategory);
    } else {
      categoryDoc = await Category.findOne({ name: finalCategory });
    }

    // Auto-create "Packages" category if missing during package creation
    if (!categoryDoc && productType === "package" && (finalCategory === "Packages" || finalCategory === "packages")) {
      categoryDoc = await Category.create({
        name: "Packages",
        isActive: true,
        createdBy: req.admin.adminId
      });
    }

    if (!categoryDoc) {
      return res.status(400).json({
        success: false,
        message: "Invalid category",
      });
    }

    // Ensure we use the category name for storage
    const categoryName = categoryDoc.name;

    if (subcategory) {
      const subcategoryExists = categoryDoc.subcategories.some(
        (sub) => sub.name === subcategory
      );
      if (!subcategoryExists) {
        return res.status(400).json({
          success: false,
          message: "Invalid subcategory for selected category",
        });
      }
    }

    // Validate package items if product type is package
    if (productType === "package") {
      if (!packageItems || packageItems.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Package must contain at least one product",
        });
      }

      // Verify all package items exist and are single products
      for (const item of packageItems) {
        const itemProduct = await Product.findById(item.productId);
        if (!itemProduct) {
          return res.status(400).json({
            success: false,
            message: `Product with ID ${item.productId} not found`,
          });
        }
        if (itemProduct.productType === "package") {
          return res.status(400).json({
            success: false,
            message: "Cannot add a package inside another package",
          });
        }
      }
    }

    // Map packageItems with stripped baseUrl before creating product
    const finalPackageItems = (productType === "package" && packageItems)
      ? packageItems.map(item => ({
        ...item,
        image: stripBaseUrl(item.image)
      }))
      : [];

    // Create product instance
    const product = new Product({
      name,
      description,
      category: categoryName,
      subcategory,
      price,
      cost,
      productType,
      packageItems: finalPackageItems,
      inventory: {
        quantity: inventory?.quantity || 0,
        lowStockAlert: inventory?.lowStockAlert || 10,
        trackQuantity: inventory?.trackQuantity !== false,
      },
      specifications: specifications || {},
      seo: {
        metaTitle: seo?.metaTitle || name,
        metaDescription: seo?.metaDescription || description.substring(0, 160),
      },
      tags: tags || [],
      featured,
      createdBy: req.admin.adminId,
    });

    // Handle discount if provided
    if (discount) {
      product.discount = {
        type: discount.type || "percentage",
        value: discount.value || 0,
        discountedPrice: discount.discountedPrice || (discount.type === "percentage"
          ? price - (price * (discount.value || 0) / 100)
          : price - (discount.value || 0)),
        startDate: discount.startDate ? new Date(discount.startDate) : undefined,
        endDate: discount.endDate ? new Date(discount.endDate) : undefined,
        isActive: discount.isActive !== undefined ? discount.isActive : true,
      };
    }

    // Calculate package details if it's a package - RUN THIS BEFORE IMAGE HANDLING
    // so that item images are populated for the package fallback
    if (productType === "package") {
      await product.calculatePackageDetails();
    }

    // Handle images: Support both 'image' and 'images' fields
    let processedImages = stripImageArray(images || image);

    // If it's a package and no images provided, default to first package item's image
    if (productType === "package" && processedImages.length === 0 && product.packageItems?.length > 0) {
      const firstItemImage = product.packageItems[0].image;
      if (firstItemImage) {
        processedImages = [firstItemImage];
      }
    }

    product.images = processedImages;

    await product.save();

    res.status(201).json({
      success: true,
      message: productType === "package"
        ? "Package created successfully"
        : "Product created successfully",
      data: {
        product: {
          ...product.toObject(),
          isActive: product.status === "active",
          originalPrice: product.comparePrice || product.price,
          image: product.images?.[0] ? formatImageUrl(req, product.images[0]) : null,
          images: formatImageArray(req, product.images),
          ...(product.productType === "package" &&
            product.packageItems && {
            items: product.packageItems.map((item) => ({
              ...item.toObject(),
              image: formatImageUrl(req, item.image),
            })),
            packageItems: product.packageItems.map((item) => ({
              ...item.toObject(),
              image: formatImageUrl(req, item.image),
            })),
          }),
        },
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

    // Sanitize images: only allow array of strings
    if (Array.isArray(updateData.images)) {
      updateData.images = updateData.images.filter(img => typeof img === "string");
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
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
        } else if (key === "discount" && typeof updateData[key] === "object") {
          // Handle discount updates
          const discountData = updateData[key];
          const currentPrice = updateData.price || product.price;
          product.discount = {
            type: discountData.type || product.discount?.type || "percentage",
            value: discountData.value !== undefined ? discountData.value : (product.discount?.value || 0),
            discountedPrice: discountData.discountedPrice || (
              (discountData.type || product.discount?.type) === "percentage"
                ? currentPrice - (currentPrice * (discountData.value !== undefined ? discountData.value : product.discount?.value || 0) / 100)
                : currentPrice - (discountData.value !== undefined ? discountData.value : product.discount?.value || 0)
            ),
            startDate: discountData.startDate ? new Date(discountData.startDate) : product.discount?.startDate,
            endDate: discountData.endDate ? new Date(discountData.endDate) : product.discount?.endDate,
            isActive: discountData.isActive !== undefined ? discountData.isActive : (product.discount?.isActive ?? true),
          };
        } else if (key === "packageItems" && Array.isArray(updateData[key])) {
          product.packageItems = updateData[key].map(item => ({
            ...item,
            image: stripBaseUrl(item.image)
          }));
        } else if (key === "images" || key === "image") {
          // Handled separately below for robustness
        } else {
          product[key] = updateData[key];
        }
      }
    });

    // Robust image update
    if (updateData.images !== undefined || updateData.image !== undefined) {
      let processedImages = stripImageArray(updateData.images || updateData.image);

      // Keep existing images if update resulted in empty but old one exists? 
      // No, usually update replaces. But for packages, we might want to ensure one exists.
      if (product.productType === "package" && processedImages.length === 0) {
        if (product.packageItems && product.packageItems.length > 0) {
          const firstItemImage = product.packageItems[0].image;
          if (firstItemImage) {
            processedImages = [firstItemImage];
          }
        }
      }
      product.images = processedImages;
    }

    // Recalculate package details if it's a package and items were updated
    if (product.productType === "package" && updateData.packageItems) {
      await product.calculatePackageDetails();
    }

    // Validate category/subcategory if changed
    if (updateData.category || updateData.subcategory || product.productType === "package") {
      let newCategory = updateData.category || product.category;
      const newSubcategory = updateData.subcategory !== undefined ? updateData.subcategory : product.subcategory;

      if (product.productType === "package") {
        newCategory = "Packages";
      }

      let categoryDoc;
      if (mongoose.Types.ObjectId.isValid(newCategory)) {
        categoryDoc = await Category.findById(newCategory);
      } else {
        categoryDoc = await Category.findOne({ name: newCategory });
      }

      if (!categoryDoc) {
        return res.status(400).json({
          success: false,
          message: "Invalid category",
        });
      }

      // Ensure we update with the name
      product.category = categoryDoc.name;

      if (newSubcategory) {
        const subcategoryExists = categoryDoc.subcategories.some(
          (sub) => sub.name === newSubcategory
        );
        if (!subcategoryExists) {
          return res.status(400).json({
            success: false,
            message: "Invalid subcategory for this category",
          });
        }
      }
    }

    product.updatedAt = new Date();
    product.updatedBy = req.admin.adminId;
    await product.save();

    res.json({
      success: true,
      message: "Product updated successfully",
      data: {
        product: {
          ...product.toObject(),
          isActive: product.status === "active",
          originalPrice: product.comparePrice || product.price,
          image: product.images?.[0] ? formatImageUrl(req, product.images[0]) : null,
          images: formatImageArray(req, product.images),
          ...(product.productType === "package" &&
            product.packageItems && {
            items: product.packageItems.map((item) => ({
              ...item.toObject(),
              image: formatImageUrl(req, item.image),
            })),
            packageItems: product.packageItems.map((item) => ({
              ...item.toObject(),
              image: formatImageUrl(req, item.image),
            })),
          }),
        },
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

        result = await Product.updateMany(
          { _id: { $in: productIds } },
          {
            $set: {
              price: parseFloat(data.price),
              updatedAt: new Date(),
              updatedBy: req.admin.adminId,
            },
          }
        );
        message = `${result.modifiedCount} products price updated successfully`;
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
              images: formatImageArray(req, product.images),
              ...(product.productType === "package" &&
                product.packageItems && {
                packageItems: product.packageItems.map((item) => ({
                  ...item.toObject(),
                  image: formatImageUrl(req, item.image),
                })),
              }),
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
        "name price inventory.quantity inventory.lowStockAlert images category"
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
      images: formatImageArray(req, product.images),
      ...(product.productType === "package" &&
        product.packageItems && {
        packageItems: product.packageItems.map((item) => ({
          ...item.toObject(),
          image: formatImageUrl(req, item.image),
        })),
      }),
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
    .select("name price images category")
    .sort({ createdAt: -1 });
};

const calculateRestockUrgency = (currentStock, lowStockAlert) => {
  if (currentStock === 0) return 100;
  if (currentStock <= lowStockAlert / 2) return 75;
  if (currentStock <= lowStockAlert) return 50;
  return 25;
};

const getAllPackages = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const filter = { productType: "package" };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }

    if (category) {
      filter.category = { $regex: category, $options: "i" };
    }

    if (status) {
      filter.status = status;
    }

    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "asc" ? 1 : -1;

    const products = await Product.find(filter)
      .sort(sortConfig)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select("-__v");

    const totalPackages = await Product.countDocuments(filter);

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
          isActive: product.status === "active",
          originalPrice: product.comparePrice || product.price,
          image: product.images?.[0] ? formatImageUrl(req, product.images[0]) : null,
          isOnSale: product.discount?.isActive && (!product.discount?.endDate || new Date(product.discount.endDate) > new Date()),
          discountPercentage: product.discount?.type === 'percentage' ? product.discount.value : 0,
          discountedPrice: product.discount?.discountedPrice || product.price,
          items: (product.packageItems || []).map(item => ({
            ...item.toObject(),
            image: formatImageUrl(req, item.image)
          })),
          sales: salesData[0] || { totalSold: 0, totalRevenue: 0 },
        };
      })
    );

    const productStats = await Product.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          activeProducts: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
          outOfStockProducts: { $sum: { $cond: [{ $eq: ["$inventory.quantity", 0] }, 1, 0] } },
          lowStockProducts: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$inventory.quantity", 0] },
                    { $lte: ["$inventory.quantity", "$inventory.lowStockAlert"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          totalValue: { $sum: { $multiply: ["$price", "$inventory.quantity"] } },
          averagePrice: { $avg: "$price" },
        },
      },
    ]);

    const categoryStats = await Product.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          totalValue: { $sum: { $multiply: ["$price", "$inventory.quantity"] } },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      data: {
        packages: productsWithStats,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalPackages / limit),
          totalPackages,
          totalProducts: totalPackages,
          hasNext: page * limit < totalPackages,
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
      },
    });
  } catch (error) {
    console.error("Admin get all packages error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getAllProducts,
  getAllPackages,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkProductOperations,
  updateProductInventory,
  getLowStockAlerts,
};
