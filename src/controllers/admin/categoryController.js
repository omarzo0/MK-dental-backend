// controllers/admin/categoryController.js
const Category = require("../../models/Category");
const Product = require("../../models/Product");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

// @desc    Get all categories with filtering and pagination
// @route   GET /api/admin/categories
// @access  Private (Admin)
const getAllCategories = async (req, res) => {
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
      limit = 50,
      search,
      isActive,
      parent,
      level,
      tree = false,
      sortBy = "displayOrder",
      sortOrder = "asc",
    } = req.query;

    // If tree view requested, return hierarchical structure
    if (tree === "true") {
      const categoryTree = await Category.getCategoryTree({
        includeInactive: isActive === "false" || isActive === undefined,
      });

      return res.json({
        success: true,
        data: {
          categories: categoryTree,
          totalCategories: categoryTree.length,
        },
      });
    }

    // Build filter
    const filter = {};

    // Search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Active filter
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    // Parent filter
    if (parent === "null" || parent === "root") {
      filter.parent = null;
    } else if (parent) {
      filter.parent = parent;
    }

    // Level filter
    if (level !== undefined) {
      filter.level = parseInt(level);
    }

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Get categories with pagination
    const categories = await Category.find(filter)
      .populate("parent", "name slug")
      .populate("createdBy", "username profile.firstName profile.lastName")
      .sort(sortConfig)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get total count
    const totalCategories = await Category.countDocuments(filter);

    // Get category statistics
    const categoryStats = await Category.aggregate([
      {
        $group: {
          _id: null,
          totalCategories: { $sum: 1 },
          activeCategories: {
            $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
          },
          rootCategories: {
            $sum: { $cond: [{ $eq: ["$parent", null] }, 1, 0] },
          },
          totalProducts: { $sum: "$statistics.productCount" },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        categories,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCategories / limit),
          totalCategories,
          hasNext: page * limit < totalCategories,
          hasPrev: page > 1,
        },
        statistics: categoryStats[0] || {
          totalCategories: 0,
          activeCategories: 0,
          rootCategories: 0,
          totalProducts: 0,
        },
      },
    });
  } catch (error) {
    console.error("Get all categories error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching categories",
      error: error.message,
    });
  }
};

// @desc    Get category by ID
// @route   GET /api/admin/categories/:categoryId
// @access  Private (Admin)
const getCategoryById = async (req, res) => {
  try {
    const { categoryId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const category = await Category.findById(categoryId)
      .populate("parent", "name slug")
      .populate("createdBy", "username profile.firstName profile.lastName")
      .populate("updatedBy", "username profile.firstName profile.lastName")
      .populate({
        path: "children",
        options: { sort: { displayOrder: 1 } },
      });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Get full breadcrumb path
    const breadcrumb = await category.getFullPath();

    // Get product count
    const productCount = await Product.countDocuments({ category: category.name });

    res.json({
      success: true,
      data: {
        category,
        breadcrumb,
        productCount,
      },
    });
  } catch (error) {
    console.error("Get category by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching category",
      error: error.message,
    });
  }
};

// @desc    Create new category
// @route   POST /api/admin/categories
// @access  Private (Admin)
const createCategory = async (req, res) => {
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
      slug,
      description,
      parent,
      image,
      icon,
      displayOrder,
      showInMenu,
      showInHomepage,
      seo,
      isActive,
      attributes,
    } = req.body;

    // Check if name already exists
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: "Category name already exists",
      });
    }

    // Validate parent if provided
    if (parent) {
      const parentCategory = await Category.findById(parent);
      if (!parentCategory) {
        return res.status(400).json({
          success: false,
          message: "Parent category not found",
        });
      }
    }

    const category = new Category({
      name,
      slug,
      description,
      parent: parent || null,
      image,
      icon,
      displayOrder: displayOrder || 0,
      showInMenu: showInMenu !== undefined ? showInMenu : true,
      showInHomepage: showInHomepage || false,
      seo,
      isActive: isActive !== undefined ? isActive : true,
      attributes,
      createdBy: req.admin.adminId,
    });

    await category.save();

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: { category },
    });
  } catch (error) {
    console.error("Create category error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating category",
      error: error.message,
    });
  }
};

// @desc    Update category
// @route   PUT /api/admin/categories/:categoryId
// @access  Private (Admin)
const updateCategory = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { categoryId } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check if name is being changed and if new name exists
    if (updateData.name && updateData.name !== category.name) {
      const existingCategory = await Category.findOne({
        name: { $regex: new RegExp(`^${updateData.name}$`, "i") },
        _id: { $ne: categoryId },
      });
      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: "Category name already exists",
        });
      }

      // Update products with old category name to new name
      await Product.updateMany(
        { category: category.name },
        { $set: { category: updateData.name } }
      );
    }

    // Validate parent if provided
    if (updateData.parent) {
      // Cannot set self as parent
      if (updateData.parent === categoryId) {
        return res.status(400).json({
          success: false,
          message: "Category cannot be its own parent",
        });
      }

      const parentCategory = await Category.findById(updateData.parent);
      if (!parentCategory) {
        return res.status(400).json({
          success: false,
          message: "Parent category not found",
        });
      }

      // Cannot set a descendant as parent
      const descendants = await Category.getDescendants(categoryId);
      if (descendants.some((d) => d._id.toString() === updateData.parent)) {
        return res.status(400).json({
          success: false,
          message: "Cannot set a descendant category as parent",
        });
      }
    }

    // Update category
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] !== undefined) {
        category[key] = updateData[key];
      }
    });

    category.updatedBy = req.admin.adminId;
    await category.save();

    res.json({
      success: true,
      message: "Category updated successfully",
      data: { category },
    });
  } catch (error) {
    console.error("Update category error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating category",
      error: error.message,
    });
  }
};

// @desc    Delete category
// @route   DELETE /api/admin/categories/:categoryId
// @access  Private (Admin)
const deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { moveProductsTo, moveChildrenTo } = req.query;

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Check for products in this category
    const productCount = await Product.countDocuments({ category: category.name });
    if (productCount > 0) {
      if (moveProductsTo) {
        const targetCategory = await Category.findById(moveProductsTo);
        if (!targetCategory) {
          return res.status(400).json({
            success: false,
            message: "Target category for products not found",
          });
        }
        await Product.updateMany(
          { category: category.name },
          { $set: { category: targetCategory.name } }
        );
      } else {
        return res.status(400).json({
          success: false,
          message: `Category has ${productCount} products. Provide moveProductsTo parameter to move products to another category.`,
        });
      }
    }

    // Check for child categories
    const childCategories = await Category.find({ parent: categoryId });
    if (childCategories.length > 0) {
      if (moveChildrenTo) {
        await Category.updateMany(
          { parent: categoryId },
          { $set: { parent: moveChildrenTo === "root" ? null : moveChildrenTo } }
        );
      } else {
        return res.status(400).json({
          success: false,
          message: `Category has ${childCategories.length} child categories. Provide moveChildrenTo parameter (or 'root') to move children.`,
        });
      }
    }

    await Category.findByIdAndDelete(categoryId);

    res.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Delete category error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting category",
      error: error.message,
    });
  }
};

// @desc    Toggle category status
// @route   PATCH /api/admin/categories/:categoryId/toggle-status
// @access  Private (Admin)
const toggleCategoryStatus = async (req, res) => {
  try {
    const { categoryId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    category.isActive = !category.isActive;
    category.updatedBy = req.admin.adminId;
    await category.save();

    res.json({
      success: true,
      message: `Category ${category.isActive ? "activated" : "deactivated"} successfully`,
      data: { category },
    });
  } catch (error) {
    console.error("Toggle category status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while toggling category status",
      error: error.message,
    });
  }
};

// @desc    Update category display order
// @route   PATCH /api/admin/categories/reorder
// @access  Private (Admin)
const reorderCategories = async (req, res) => {
  try {
    const { categories } = req.body; // Array of { categoryId, displayOrder }

    if (!Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of categories with display orders",
      });
    }

    const bulkOps = categories.map(({ categoryId, displayOrder }) => ({
      updateOne: {
        filter: { _id: categoryId },
        update: { $set: { displayOrder, updatedBy: req.admin.adminId } },
      },
    }));

    await Category.bulkWrite(bulkOps);

    res.json({
      success: true,
      message: "Categories reordered successfully",
    });
  } catch (error) {
    console.error("Reorder categories error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while reordering categories",
      error: error.message,
    });
  }
};

// @desc    Get category statistics
// @route   GET /api/admin/categories/:categoryId/statistics
// @access  Private (Admin)
const getCategoryStatistics = async (req, res) => {
  try {
    const { categoryId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // Get product statistics
    const productStats = await Product.aggregate([
      { $match: { category: category.name } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          activeProducts: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
          },
          totalStock: { $sum: "$inventory.quantity" },
          totalValue: {
            $sum: { $multiply: ["$price", "$inventory.quantity"] },
          },
          avgPrice: { $avg: "$price" },
          minPrice: { $min: "$price" },
          maxPrice: { $max: "$price" },
        },
      },
    ]);

    // Get sales statistics
    const salesStats = await mongoose.model("Order").aggregate([
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      { $match: { "product.category": category.name } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$items.subtotal" },
          totalQuantity: { $sum: "$items.quantity" },
        },
      },
    ]);

    // Update category statistics
    await category.updateProductCount();

    res.json({
      success: true,
      data: {
        category: {
          _id: category._id,
          name: category.name,
          slug: category.slug,
        },
        products: productStats[0] || {
          totalProducts: 0,
          activeProducts: 0,
          totalStock: 0,
          totalValue: 0,
          avgPrice: 0,
          minPrice: 0,
          maxPrice: 0,
        },
        sales: salesStats[0] || {
          totalOrders: 0,
          totalRevenue: 0,
          totalQuantity: 0,
        },
      },
    });
  } catch (error) {
    console.error("Get category statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching category statistics",
      error: error.message,
    });
  }
};

// @desc    Update all category statistics
// @route   POST /api/admin/categories/update-statistics
// @access  Private (Admin)
const updateAllStatistics = async (req, res) => {
  try {
    await Category.updateAllStatistics();

    res.json({
      success: true,
      message: "All category statistics updated successfully",
    });
  } catch (error) {
    console.error("Update all statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating category statistics",
      error: error.message,
    });
  }
};

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
  reorderCategories,
  getCategoryStatistics,
  updateAllStatistics,
};
