const Product = require("../../models/Product");
const Category = require("../../models/Category");
const { validationResult } = require("express-validator");
const { formatImageArray, formatImageUrl } = require("../../utils/imageHelper");

const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true });

    res.json({
      success: true,
      data: categories,
    });
  } catch (err) {
    console.error("Get shared categories error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

// @desc    Get category by ID
// @route   GET /api/products/categories/:categoryId
// @access  Public
const getCategoryById = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 12 } = req.query;

    const category = await Category.findOne({ _id: categoryId, isActive: true });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const Product = require("../../models/Product");

    const skip = (page - 1) * limit;

    const products = await Product.find({
      category: categoryId,
      status: "active"
    })
      .select("name price images slug productType featured specifications discount")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const totalProducts = await Product.countDocuments({
      category: categoryId,
      status: "active"
    });

    const categoryData = {
      ...category.toObject(),
      image: category.image ? { ...category.image, url: formatImageUrl(req, category.image.url) } : null,
      products: products.map(p => ({
        ...p.toObject(),
        images: formatImageArray(req, p.images),
        isOnSale: p.discount?.isActive && (!p.discount?.endDate || new Date(p.discount.endDate) > new Date()),
        discountPercentage: p.discount?.type === 'percentage' ? p.discount.value : 0,
        discountedPrice: p.discount?.discountedPrice || p.price
      })),
      productsPagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalProducts / limit),
        totalProducts,
        hasNext: page * limit < totalProducts,
        hasPrev: page > 1,
      }
    };

    res.json({ success: true, data: categoryData });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
}
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

    const Order = require("../../models/Order");

    // Enhance products with stats and sales data
    const productsWithStats = await Promise.all(
      products.map(async (p) => {
        const salesData = await Order.aggregate([
          {
            $match: {
              "items.productId": p._id,
              paymentStatus: "paid",
            },
          },
          { $unwind: "$items" },
          {
            $match: {
              "items.productId": p._id,
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
          ...p.toObject(),
          isActive: p.status === "active",
          originalPrice: p.comparePrice || p.price,
          image: p.images?.[0] ? formatImageUrl(req, p.images[0]) : null,
          images: formatImageArray(req, p.images),
          isOnSale: p.discount?.isActive && (!p.discount?.endDate || new Date(p.discount.endDate) > new Date()),
          discountPercentage: p.discount?.type === 'percentage' ? p.discount.value : 0,
          discountedPrice: p.discount?.discountedPrice || p.price,
          items: p.packageItems.map((item) => ({
            ...item.toObject(),
            image: formatImageUrl(req, item.image),
          })),
          packageItems: p.packageItems.map((item) => ({
            ...item.toObject(),
            image: formatImageUrl(req, item.image),
          })),
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

    // Get category distribution with counts and values
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
        select: "name price images inventory status seo.slug discount",
      });
    }

    // Get related products (same category)
    const relatedProducts = await Product.find({
      category: product.category,
      status: "active",
      _id: { $ne: productId },
    })
      .limit(4)
      .select("name price images slug productType packageDetails discount");

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
        relatedProducts: relatedProducts.map(p => ({
          ...p.toObject(),
          images: formatImageArray(req, p.images),
          isOnSale: p.discount?.isActive && (!p.discount?.endDate || new Date(p.discount.endDate) > new Date()),
          discountPercentage: p.discount?.type === 'percentage' ? p.discount.value : 0,
          discountedPrice: p.discount?.discountedPrice || p.price
        })),
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
      .select("name price images slug discount");

    res.json({
      success: true,
      data: {
        product: {
          ...product.toObject(),
          images: formatImageArray(req, product.images),
          isOnSale: product.discount?.isActive && (!product.discount?.endDate || new Date(product.discount.endDate) > new Date()),
          discountPercentage: product.discount?.type === 'percentage' ? product.discount.value : 0,
          discountedPrice: product.discount?.discountedPrice || product.price
        },
        relatedProducts: relatedProducts.map(p => ({
          ...p.toObject(),
          images: formatImageArray(req, p.images),
          isOnSale: p.discount?.isActive && (!p.discount?.endDate || new Date(p.discount.endDate) > new Date()),
          discountPercentage: p.discount?.type === 'percentage' ? p.discount.value : 0,
          discountedPrice: p.discount?.discountedPrice || p.price
        })),
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
      .select("name price images slug category specifications discount");

    res.json({
      success: true,
      data: {
        products: products.map(p => ({
          ...p.toObject(),
          images: formatImageArray(req, p.images),
          isOnSale: p.discount?.isActive && (!p.discount?.endDate || new Date(p.discount.endDate) > new Date()),
          discountPercentage: p.discount?.type === 'percentage' ? p.discount.value : 0,
          discountedPrice: p.discount?.discountedPrice || p.price
        })),
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
      .select("name price images slug category discount");

    res.json({
      success: true,
      data: {
        products: products.map(p => ({
          ...p.toObject(),
          images: formatImageArray(req, p.images),
          isOnSale: p.discount?.isActive && (!p.discount?.endDate || new Date(p.discount.endDate) > new Date()),
          discountPercentage: p.discount?.type === 'percentage' ? p.discount.value : 0,
          discountedPrice: p.discount?.discountedPrice || p.price
        })),
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
      .select("name slug images price category discount");

    // Get category suggestions
    const categories = await Product.distinct("category", {
      status: "active",
      category: { $regex: q, $options: "i" },
    });

    // Get brand suggestions
    const brands = await Product.distinct("specifications.brand", {
      status: "active",
      "specifications.brand": { $regex: q, $options: "i" },
    });

    res.json({
      success: true,
      data: {
        products: products.map(p => ({
          ...p.toObject(),
          images: formatImageArray(req, p.images),
          isOnSale: p.discount?.isActive && (!p.discount?.endDate || new Date(p.discount.endDate) > new Date()),
          discountPercentage: p.discount?.type === 'percentage' ? p.discount.value : 0,
          discountedPrice: p.discount?.discountedPrice || p.price
        })),
        categories: categories.slice(0, 5),
        brands: brands.slice(0, 5),
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
    const [categories, brands, priceRange, attributes] = await Promise.all([
      // Categories with count
      Product.aggregate([
        { $match: { status: "active" } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      // Brands with count
      Product.aggregate([
        { $match: baseFilter },
        { $group: { _id: "$specifications.brand", count: { $sum: 1 } } },
        { $match: { _id: { $ne: null } } },
        { $sort: { count: -1 } },
      ]),
      // Price range
      Product.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: null,
            minPrice: { $min: "$price" },
            maxPrice: { $max: "$price" },
            avgPrice: { $avg: "$price" },
          },
        },
      ]),
      // Product attributes (colors, sizes, etc.)
      Product.aggregate([
        { $match: baseFilter },
        { $unwind: { path: "$attributes", preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: "$attributes.name",
            values: { $addToSet: "$attributes.value" },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        categories: categories.map(c => ({ name: c._id, count: c.count })),
        brands: brands.map(b => ({ name: b._id, count: b.count })),
        priceRange: priceRange[0] || { minPrice: 0, maxPrice: 1000, avgPrice: 500 },
        attributes,
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
  getProductBySlug,
  getFeaturedProducts,
  searchProducts,
  getSearchSuggestions,
  getFiltersData,
  recordProductView,
  getStockAvailability,
  estimateShipping,
  getAllCategories,
  getCategoryById,
};
