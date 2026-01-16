const Category = require('../../models/Category');

// @desc    Get all categories
// @route   GET /api/user/categories
// @access  Public
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true });

    // Get products for each category
    const categoriesWithProducts = await Promise.all(
      categories.map(async (category) => {
        const Product = require('../../models/Product');

        const products = await Product.find({
          category: category.name, // Changed from category._id to category.name
          status: "active"
        })
          .select("name _id")
          .limit(10); // Limit to 10 products per category for performance

        return {
          ...category.toObject(),
          statistics: {
            ...category.statistics,
            productCount: await Product.countDocuments({ category: category.name }),
            activeProductCount: await Product.countDocuments({ category: category.name, status: "active" })
          },
          products: products
        };
      })
    );

    res.json({ success: true, data: categoriesWithProducts });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get category by ID
// @route   GET /api/user/categories/:categoryId
// @access  Public
exports.getCategoryById = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 12 } = req.query;

    const category = await Category.findOne({ _id: categoryId, isActive: true });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const Product = require('../../models/Product');

    const skip = (page - 1) * limit;

    const products = await Product.find({
      category: category.name, // Changed from categoryId to category.name
      status: "active"
    })
      .select("name price images slug productType featured specifications discount")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const totalProducts = await Product.countDocuments({
      category: category.name, // Changed from categoryId to category.name
      status: "active"
    });

    const { formatImageArray } = require('../../utils/imageHelper');

    const categoryData = {
      ...category.toObject(),
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
};
