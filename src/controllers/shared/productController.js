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
      productType,
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

    // Product type filter (single or package)
    if (productType) {
      filter.productType = productType;
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

    let product = await Product.findById(productId);
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

    // Populate package items if it's a package
    if (product.productType === "package") {
      product = await Product.findById(productId).populate({
        path: "packageItems.productId",
        select: "name price images inventory status",
      });
    }

    // Get related products (same category)
    const relatedProducts = await Product.find({
      category: product.category,
      status: "active",
      _id: { $ne: productId },
    })
      .limit(4)
      .select("name price images productType packageDetails");

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
      .select("name price images category specifications");

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
      .select("name price images category specifications");

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
            { tags: { $in: [new RegExp(q, "i")] } },
          ],
        },
      ],
    })
      .limit(parseInt(limit))
      .select("name price images category");

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

// @desc    Get search suggestions (auto-complete)
// @route   GET /api/products/search/suggestions
// @access  Public
const getSearchSuggestions = async (req, res) => {
  try {
    const { q, limit = 8 } = req.query;

    if (!q || q.length < 2) {
      return res.json({
        success: true,
        data: { suggestions: [], products: [] },
      });
    }

    // Get product name suggestions
    const products = await Product.find({
      status: "active",
      name: { $regex: q, $options: "i" },
    })
      .limit(parseInt(limit))
      .select("name images price category");

    res.json({
      success: true,
      data: {
        products,
        categories: categories.slice(0, 5),
        searchQuery: q,
      },
    });
  } catch (error) {
    console.error("Get search suggestions error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching suggestions",
      error: error.message,
    });
  }
};

// @desc    Get all packages/bundles
// @route   GET /api/products/packages
// @access  Public
const getPackages = async (req, res) => {
  try {
    const { page = 1, limit = 12, sortBy = "createdAt", sortOrder = "desc" } = req.query;

    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "asc" ? 1 : -1;

    const packages = await Product.find({
      productType: "package",
      status: "active",
    })
      .populate({
        path: "packageItems.productId",
        select: "name price images inventory status",
      })
      .sort(sortConfig)
      .limit(parseInt(limit))
      .skip((page - 1) * limit)
      .select("-__v");

    const totalPackages = await Product.countDocuments({
      productType: "package",
      status: "active",
    });

    res.json({
      success: true,
      data: {
        packages,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalPackages / limit),
          totalPackages,
          hasNext: page * limit < totalPackages,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get packages error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching packages",
      error: error.message,
    });
  }
};

// @desc    Get advanced filters data
// @route   GET /api/products/filters
// @access  Public
const getFiltersData = async (req, res) => {
  try {
    const { category } = req.query;

    const baseFilter = { status: "active" };
    if (category) {
      baseFilter.category = { $regex: category, $options: "i" };
    }

    // Get all filter options in parallel
    const [categories, priceRange, attributes] = await Promise.all([
      // Categories with count
      Product.aggregate([
        { $match: { status: "active" } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      // Price range
      Product.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: null,
            min: { $min: "$price" },
            max: { $max: "$price" },
          },
        },
      ]),
      // Other attributes (storage, color etc)
      // This is a more complex aggregation to get all unique values for these fields
      Product.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: null,
            colors: { $addToSet: "$specifications.color" },
            storage: { $addToSet: "$specifications.storage" },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        categories: categories.map(c => ({ name: c._id, count: c.count })),
        priceRange: priceRange[0] || { min: 0, max: 0 },
        attributes: attributes[0] || { colors: [], storage: [] },
        stockOptions: [
          { value: "in_stock", label: "In Stock" },
          { value: "out_of_stock", label: "Out of Stock" },
        ],
        sortOptions: [
          { value: "newest", label: "Newest First" },
          { value: "price_low", label: "Price: Low to High" },
          { value: "price_high", label: "Price: High to Low" },
          { value: "popular", label: "Most Popular" },
          { value: "rating", label: "Highest Rated" },
        ],
      },
    });
  } catch (error) {
    console.error("Get filters data error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching filters",
      error: error.message,
    });
  }
};

// @desc    Record product view (for recently viewed)
// @route   POST /api/products/:productId/view
// @access  Private (optional)
const recordProductView = async (req, res) => {
  try {
    const { productId } = req.params;

    // Increment view count on product
    const product = await Product.findByIdAndUpdate(
      productId,
      { $inc: { views: 1 } },
      { new: true }
    ).select("name views");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // If user is logged in, add to their recently viewed
    if (req.user) {
      const User = require("../../models/User");
      const user = await User.findById(req.user.userId);
      if (user) {
        await user.addRecentlyViewed(productId);
      }
    }

    res.json({
      success: true,
      message: "Product view recorded",
      data: { views: product.views },
    });
  } catch (error) {
    console.error("Record product view error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while recording view",
      error: error.message,
    });
  }
};

// @desc    Get stock availability for product
// @route   GET /api/products/:productId/stock
// @access  Public
const getStockAvailability = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId)
      .select("name inventory status productType packageItems");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    let stockInfo = {
      productId: product._id,
      name: product.name,
      inStock: product.inventory.quantity > 0,
      quantity: product.inventory.quantity,
      lowStock: product.inventory.quantity <= (product.inventory.lowStockAlert || 10),
      status: product.status,
    };

    // For package products, check all items
    if (product.productType === "package" && product.packageItems) {
      const packageItemsStock = await Promise.all(
        product.packageItems.map(async (item) => {
          const itemProduct = await Product.findById(item.productId)
            .select("name inventory status");
          return {
            productId: item.productId,
            name: item.name,
            inStock: itemProduct ? itemProduct.inventory.quantity >= item.quantity : false,
            available: itemProduct?.inventory.quantity || 0,
            required: item.quantity,
          };
        })
      );

      stockInfo.packageItems = packageItemsStock;
      stockInfo.allItemsAvailable = packageItemsStock.every(item => item.inStock);
    }

    res.json({
      success: true,
      data: stockInfo,
    });
  } catch (error) {
    console.error("Get stock availability error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while checking stock",
      error: error.message,
    });
  }
};

// @desc    Estimate shipping for product
// @route   POST /api/products/:productId/estimate-shipping
// @access  Public
const estimateShipping = async (req, res) => {
  try {
    const { productId } = req.params;
    const { zipCode, quantity = 1 } = req.body;

    const product = await Product.findById(productId).select("name price weight dimensions");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Get shipping methods from ShippingFee model
    const ShippingFee = require("../../models/ShippingFee");
    const shippingMethods = await ShippingFee.find({ isActive: true });

    const estimates = shippingMethods.map(method => {
      let baseFee = method.baseFee || 0;
      const itemTotal = product.price * quantity;

      // Free shipping threshold
      if (method.freeShippingThreshold && itemTotal >= method.freeShippingThreshold) {
        baseFee = 0;
      }

      // Calculate estimated delivery
      const now = new Date();
      const minDays = method.estimatedDays?.min || 3;
      const maxDays = method.estimatedDays?.max || 7;
      const minDate = new Date(now.getTime() + minDays * 24 * 60 * 60 * 1000);
      const maxDate = new Date(now.getTime() + maxDays * 24 * 60 * 60 * 1000);

      return {
        methodId: method._id,
        name: method.name,
        description: method.description,
        fee: baseFee,
        isFree: baseFee === 0,
        estimatedDelivery: {
          minDays,
          maxDays,
          minDate: minDate.toISOString().split("T")[0],
          maxDate: maxDate.toISOString().split("T")[0],
        },
      };
    });

    res.json({
      success: true,
      data: {
        product: {
          id: product._id,
          name: product.name,
          price: product.price,
          quantity,
        },
        zipCode,
        shippingOptions: estimates,
      },
    });
  } catch (error) {
    console.error("Estimate shipping error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while estimating shipping",
      error: error.message,
    });
  }
};


module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkProductOperation,
  updateProductInventory,
  getFeaturedProducts,
  getProductsByCategory,
  searchProducts,
  getSearchSuggestions,
  getPackages,
  getFiltersData,
  recordProductView,
  getStockAvailability,
  estimateShipping,
};
