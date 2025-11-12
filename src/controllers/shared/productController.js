const Product = require("../../models/Product");
const { validationResult } = require("express-validator");

// @desc    Get all products (with filtering, sorting, pagination)
// @route   GET /api/products
// @access  Public
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
      limit = 12,
      category,
      search,
      minPrice,
      maxPrice,
      status = "active",
      featured,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build filter object
    const filter = {};

    // Status filter (for public routes, only show active products)
    if (req.user?.role === "admin") {
      if (status) filter.status = status;
    } else {
      filter.status = "active";
    }

    // Category filter
    if (category) {
      filter.category = { $regex: category, $options: "i" };
    }

    // Search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { "specifications.brand": { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }

    // Price range filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    // Featured filter
    if (featured !== undefined) {
      filter.featured = featured === "true";
    }

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Execute query with pagination
    const products = await Product.find(filter)
      .sort(sortConfig)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select("-__v");

    // Get total count for pagination
    const totalProducts = await Product.countDocuments(filter);

    // Get aggregation data for filters
    const categories = await Product.distinct("category", filter);
    const priceRange = await Product.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          minPrice: { $min: "$price" },
          maxPrice: { $max: "$price" },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalProducts / limit),
          totalProducts,
          hasNext: page * limit < totalProducts,
          hasPrev: page > 1,
        },
        filters: {
          categories,
          priceRange: priceRange[0] || { minPrice: 0, maxPrice: 0 },
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

// @desc    Get single product by ID
// @route   GET /api/products/:productId
// @access  Public
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

    // If user is not admin, only return active products
    if (!req.user?.role === "admin" && product.status !== "active") {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Get related products (same category)
    const relatedProducts = await Product.find({
      category: product.category,
      status: "active",
      _id: { $ne: productId },
    })
      .limit(4)
      .select("name price images slug");

    res.json({
      success: true,
      data: {
        product,
        relatedProducts,
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

// @desc    Get product by slug
// @route   GET /api/products/slug/:slug
// @access  Public
const getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const product = await Product.findOne({
      "seo.slug": slug,
      status: "active",
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Increment view count (you might want to track this differently)
    product.views = (product.views || 0) + 1;
    await product.save();

    // Get related products
    const relatedProducts = await Product.find({
      category: product.category,
      status: "active",
      _id: { $ne: product._id },
    })
      .limit(4)
      .select("name price images slug");

    res.json({
      success: true,
      data: {
        product,
        relatedProducts,
      },
    });
  } catch (error) {
    console.error("Get product by slug error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching product",
      error: error.message,
    });
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private (Admin)
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

    const productData = {
      ...req.body,
      createdBy: req.admin.adminId,
    };

    // Generate slug from name if not provided
    if (!productData.seo?.slug) {
      productData.seo = {
        ...productData.seo,
        slug: generateSlug(productData.name),
      };
    }

    const product = new Product(productData);
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
// @route   PUT /api/products/:productId
// @access  Private (Admin)
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

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Update product fields
    Object.keys(req.body).forEach((key) => {
      if (req.body[key] !== undefined) {
        if (key === "inventory" && typeof req.body[key] === "object") {
          product.inventory = { ...product.inventory, ...req.body[key] };
        } else if (
          key === "specifications" &&
          typeof req.body[key] === "object"
        ) {
          product.specifications = {
            ...product.specifications,
            ...req.body[key],
          };
        } else if (key === "seo" && typeof req.body[key] === "object") {
          product.seo = { ...product.seo, ...req.body[key] };
        } else {
          product[key] = req.body[key];
        }
      }
    });

    product.updatedAt = new Date();
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

// @desc    Delete product
// @route   DELETE /api/products/:productId
// @access  Private (Admin)
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

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Instead of hard delete, you might want to soft delete
    // await Product.findByIdAndDelete(productId);

    // Soft delete by setting status to inactive
    product.status = "inactive";
    await product.save();

    res.json({
      success: true,
      message: "Product deleted successfully",
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
// @route   POST /api/products/bulk
// @access  Private (Admin)
const bulkProductOperation = async (req, res) => {
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

    let result;
    switch (action) {
      case "activate":
        result = await Product.updateMany(
          { _id: { $in: productIds } },
          { $set: { status: "active", updatedAt: new Date() } }
        );
        break;

      case "deactivate":
        result = await Product.updateMany(
          { _id: { $in: productIds } },
          { $set: { status: "inactive", updatedAt: new Date() } }
        );
        break;

      case "delete":
        // Soft delete
        result = await Product.updateMany(
          { _id: { $in: productIds } },
          { $set: { status: "inactive", updatedAt: new Date() } }
        );
        break;

      case "updateInventory":
        if (!data || !data.quantity) {
          return res.status(400).json({
            success: false,
            message: "Quantity is required for inventory update",
          });
        }
        result = await Product.updateMany(
          { _id: { $in: productIds } },
          {
            $set: {
              "inventory.quantity": data.quantity,
              updatedAt: new Date(),
            },
          }
        );
        break;

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid action",
        });
    }

    res.json({
      success: true,
      message: `Bulk operation completed: ${action}`,
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Bulk product operation error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while performing bulk operation",
      error: error.message,
    });
  }
};

// @desc    Update product inventory
// @route   PUT /api/products/:productId/inventory
// @access  Private (Admin)
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
    const { quantity, operation = "set" } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    let newQuantity;
    switch (operation) {
      case "set":
        newQuantity = quantity;
        break;
      case "increment":
        newQuantity = product.inventory.quantity + quantity;
        break;
      case "decrement":
        newQuantity = Math.max(0, product.inventory.quantity - quantity);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: "Invalid operation",
        });
    }

    product.inventory.quantity = newQuantity;
    product.updatedAt = new Date();
    await product.save();

    res.json({
      success: true,
      message: "Product inventory updated successfully",
      data: {
        product: {
          _id: product._id,
          name: product.name,
          inventory: product.inventory,
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

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
const getFeaturedProducts = async (req, res) => {
  try {
    const { limit = 8 } = req.query;

    const products = await Product.find({
      featured: true,
      status: "active",
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select("name price images slug category specifications");

    res.json({
      success: true,
      data: {
        products,
      },
    });
  } catch (error) {
    console.error("Get featured products error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching featured products",
      error: error.message,
    });
  }
};

// @desc    Get products by category
// @route   GET /api/products/category/:category
// @access  Public
const getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 12 } = req.query;

    const products = await Product.find({
      category: { $regex: category, $options: "i" },
      status: "active",
    })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select("name price images slug category specifications");

    const totalProducts = await Product.countDocuments({
      category: { $regex: category, $options: "i" },
      status: "active",
    });

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalProducts / limit),
          totalProducts,
        },
      },
    });
  } catch (error) {
    console.error("Get products by category error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching products by category",
      error: error.message,
    });
  }
};

// @desc    Search products
// @route   GET /api/products/search
// @access  Public
const searchProducts = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const products = await Product.find({
      $and: [
        { status: "active" },
        {
          $or: [
            { name: { $regex: q, $options: "i" } },
            { description: { $regex: q, $options: "i" } },
            { "specifications.brand": { $regex: q, $options: "i" } },
            { tags: { $in: [new RegExp(q, "i")] } },
          ],
        },
      ],
    })
      .limit(parseInt(limit))
      .select("name price images slug category");

    res.json({
      success: true,
      data: {
        products,
        searchQuery: q,
        resultsCount: products.length,
      },
    });
  } catch (error) {
    console.error("Search products error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while searching products",
      error: error.message,
    });
  }
};

// Helper function to generate slug
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

module.exports = {
  getAllProducts,
  getProductById,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkProductOperation,
  updateProductInventory,
  getFeaturedProducts,
  getProductsByCategory,
  searchProducts,
};
