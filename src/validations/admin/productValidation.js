const { body, query, param } = require("express-validator");

const validateGetProducts = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("status")
    .optional()
    .isIn(["active", "inactive", "draft"])
    .withMessage("Invalid product status"),

  query("category")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Category cannot exceed 100 characters"),

  query("search")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Search query cannot exceed 100 characters"),

  query("featured")
    .optional()
    .isBoolean()
    .withMessage("Featured must be a boolean"),

  query("productType")
    .optional()
    .isIn(["single", "package"])
    .withMessage("Product type must be 'single' or 'package'"),

  query("sortBy")
    .optional()
    .isIn(["name", "price", "createdAt", "updatedAt", "inventory.quantity"])
    .withMessage("Invalid sort field"),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be 'asc' or 'desc'"),
];

const validateProductId = [
  param("productId").isMongoId().withMessage("Valid product ID is required"),
];

const validateCreateProduct = [
  body("name")
    .notEmpty()
    .withMessage("Product name is required")
    .isLength({ min: 2, max: 200 })
    .withMessage("Product name must be between 2 and 200 characters"),

  body("description")
    .notEmpty()
    .withMessage("Product description is required")
    .isLength({ min: 10, max: 2000 })
    .withMessage("Product description must be between 10 and 2000 characters"),

  body("category")
    .notEmpty()
    .withMessage("Category is required")
    .isLength({ max: 100 })
    .withMessage("Category cannot exceed 100 characters"),

  body("price")
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),

  body("comparePrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Compare price must be a positive number"),

  body("cost")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Cost must be a positive number"),

  body("inventory.quantity")
    .isInt({ min: 0 })
    .withMessage("Inventory quantity must be a non-negative integer"),

  body("inventory.lowStockAlert")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Low stock alert must be a non-negative integer"),

  body("inventory.trackQuantity")
    .optional()
    .isBoolean()
    .withMessage("Track quantity must be a boolean"),

  body("status")
    .optional()
    .isIn(["active", "inactive", "draft"])
    .withMessage("Invalid product status"),

  body("featured")
    .optional()
    .isBoolean()
    .withMessage("Featured must be a boolean"),

  // Product type validation
  body("productType")
    .optional()
    .isIn(["single", "package"])
    .withMessage("Product type must be 'single' or 'package'"),

  // Package items validation
  body("packageItems")
    .optional()
    .isArray()
    .withMessage("Package items must be an array"),

  body("packageItems.*.productId")
    .optional()
    .isMongoId()
    .withMessage("Each package item must have a valid product ID"),

  body("packageItems.*.quantity")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Package item quantity must be at least 1"),

  body("tags").optional().isArray().withMessage("Tags must be an array"),

  body("tags.*")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Each tag cannot exceed 50 characters"),

  body("images").optional().isArray().withMessage("Images must be an array"),

  body("images.*")
    .optional()
    .isURL()
    .withMessage("Each image must be a valid URL"),

  body("seo.metaTitle")
    .optional()
    .isLength({ max: 60 })
    .withMessage("Meta title cannot exceed 60 characters"),

  body("seo.metaDescription")
    .optional()
    .isLength({ max: 160 })
    .withMessage("Meta description cannot exceed 160 characters"),

  body("seo.slug")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Slug cannot exceed 200 characters")
    .matches(/^[a-z0-9-]+$/)
    .withMessage(
      "Slug can only contain lowercase letters, numbers, and hyphens"
    ),

  body("discount.type")
    .optional()
    .isIn(["percentage", "fixed"])
    .withMessage("Discount type must be 'percentage' or 'fixed'"),

  body("discount.value")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Discount value must be a positive number"),

  body("discount.discountedPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Discounted price must be a positive number"),

  body("discount.startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO date"),

  body("discount.endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO date"),

  body("discount.isActive")
    .optional()
    .isBoolean()
    .withMessage("Discount isActive must be a boolean"),
];

const validateUpdateProduct = [
  body("name")
    .optional()
    .isLength({ min: 2, max: 200 })
    .withMessage("Product name must be between 2 and 200 characters"),

  body("description")
    .optional()
    .isLength({ min: 10, max: 2000 })
    .withMessage("Product description must be between 10 and 2000 characters"),

  body("category")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Category cannot exceed 100 characters"),

  body("price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),

  body("comparePrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Compare price must be a positive number"),

  body("cost")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Cost must be a positive number"),

  body("inventory.quantity")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Inventory quantity must be a non-negative integer"),

  body("inventory.lowStockAlert")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Low stock alert must be a non-negative integer"),

  body("inventory.trackQuantity")
    .optional()
    .isBoolean()
    .withMessage("Track quantity must be a boolean"),

  body("status")
    .optional()
    .isIn(["active", "inactive", "draft"])
    .withMessage("Invalid product status"),

  body("featured")
    .optional()
    .isBoolean()
    .withMessage("Featured must be a boolean"),

  body("discount.type")
    .optional()
    .isIn(["percentage", "fixed"])
    .withMessage("Discount type must be 'percentage' or 'fixed'"),

  body("discount.value")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Discount value must be a positive number"),

  body("discount.discountedPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Discounted price must be a positive number"),

  body("discount.startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO date"),

  body("discount.endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO date"),

  body("discount.isActive")
    .optional()
    .isBoolean()
    .withMessage("Discount isActive must be a boolean"),
];

const validateDeleteProduct = [
  body("reason")
    .optional()
    .isLength({ max: 255 })
    .withMessage("Delete reason cannot exceed 255 characters"),
];

const validateBulkOperations = [
  body("productIds")
    .isArray({ min: 1 })
    .withMessage("At least one product ID is required"),

  body("productIds.*").isMongoId().withMessage("Each product ID must be valid"),

  body("action")
    .isIn([
      "activate",
      "deactivate",
      "delete",
      "updateInventory",
      "updatePrice",
    ])
    .withMessage("Invalid bulk action"),

  body("data").optional().isObject().withMessage("Data must be an object"),
];

const validateInventoryUpdate = [
  body("quantity")
    .isInt({ min: 0 })
    .withMessage("Quantity must be a non-negative integer"),

  body("operation")
    .optional()
    .isIn(["set", "increment", "decrement"])
    .withMessage("Operation must be set, increment, or decrement"),

  body("reason")
    .optional()
    .isLength({ max: 255 })
    .withMessage("Inventory update reason cannot exceed 255 characters"),
];

const validateLowStockQuery = [
  query("threshold")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Threshold must be a non-negative integer"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),
];

module.exports = {
  validateGetProducts,
  validateProductId,
  validateCreateProduct,
  validateUpdateProduct,
  validateDeleteProduct,
  validateBulkOperations,
  validateInventoryUpdate,
  validateLowStockQuery,
};
