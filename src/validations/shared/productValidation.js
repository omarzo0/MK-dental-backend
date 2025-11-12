const { body, param, query } = require("express-validator");
const Product = require("../../models/Product");

// Create product validation
const validateCreateProduct = [
  body("name")
    .notEmpty()
    .withMessage("Product name is required")
    .isLength({ min: 3, max: 100 })
    .withMessage("Product name must be between 3 and 100 characters")
    .trim(),

  body("description")
    .notEmpty()
    .withMessage("Product description is required")
    .isLength({ min: 10, max: 2000 })
    .withMessage("Description must be between 10 and 2000 characters")
    .trim(),

  body("sku")
    .notEmpty()
    .withMessage("SKU is required")
    .isLength({ min: 3, max: 50 })
    .withMessage("SKU must be between 3 and 50 characters")
    .matches(/^[A-Z0-9_-]+$/i)
    .withMessage(
      "SKU can only contain letters, numbers, hyphens and underscores"
    )
    .custom(async (sku) => {
      const existingProduct = await Product.findOne({ sku });
      if (existingProduct) {
        throw new Error("SKU already exists");
      }
      return true;
    }),

  body("category")
    .notEmpty()
    .withMessage("Category is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Category must be between 2 and 50 characters")
    .trim(),

  body("price")
    .notEmpty()
    .withMessage("Price is required")
    .isFloat({ min: 0.01, max: 100000 })
    .withMessage("Price must be between 0.01 and 100,000"),

  body("comparePrice")
    .optional()
    .isFloat({ min: 0.01, max: 100000 })
    .withMessage("Compare price must be between 0.01 and 100,000")
    .custom((comparePrice, { req }) => {
      if (comparePrice && comparePrice <= req.body.price) {
        throw new Error("Compare price must be greater than regular price");
      }
      return true;
    }),

  body("cost")
    .optional()
    .isFloat({ min: 0, max: 100000 })
    .withMessage("Cost must be between 0 and 100,000"),

  body("inventory.quantity")
    .notEmpty()
    .withMessage("Inventory quantity is required")
    .isInt({ min: 0, max: 100000 })
    .withMessage("Inventory quantity must be between 0 and 100,000"),

  body("inventory.lowStockAlert")
    .optional()
    .isInt({ min: 0, max: 1000 })
    .withMessage("Low stock alert must be between 0 and 1000"),

  body("specifications.brand")
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage("Brand must be between 2 and 50 characters")
    .trim(),

  body("specifications.model")
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage("Model must be between 1 and 50 characters")
    .trim(),

  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array")
    .custom((tags) => {
      if (tags && tags.length > 10) {
        throw new Error("Cannot have more than 10 tags");
      }
      return true;
    }),

  body("status")
    .optional()
    .isIn(["active", "inactive", "draft"])
    .withMessage("Status must be either active, inactive, or draft"),

  body("featured")
    .optional()
    .isBoolean()
    .withMessage("Featured must be a boolean value"),
];

// Update product validation
const validateUpdateProduct = [
  param("productId").isMongoId().withMessage("Valid product ID is required"),

  body("name")
    .optional()
    .isLength({ min: 3, max: 100 })
    .withMessage("Product name must be between 3 and 100 characters")
    .trim(),

  body("description")
    .optional()
    .isLength({ min: 10, max: 2000 })
    .withMessage("Description must be between 10 and 2000 characters")
    .trim(),

  body("sku")
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage("SKU must be between 3 and 50 characters")
    .matches(/^[A-Z0-9_-]+$/i)
    .withMessage(
      "SKU can only contain letters, numbers, hyphens and underscores"
    )
    .custom(async (sku, { req }) => {
      if (sku) {
        const existingProduct = await Product.findOne({
          sku,
          _id: { $ne: req.params.productId },
        });
        if (existingProduct) {
          throw new Error("SKU already exists");
        }
      }
      return true;
    }),

  body("price")
    .optional()
    .isFloat({ min: 0.01, max: 100000 })
    .withMessage("Price must be between 0.01 and 100,000"),

  body("comparePrice")
    .optional()
    .isFloat({ min: 0.01, max: 100000 })
    .withMessage("Compare price must be between 0.01 and 100,000")
    .custom((comparePrice, { req }) => {
      if (comparePrice && req.body.price && comparePrice <= req.body.price) {
        throw new Error("Compare price must be greater than regular price");
      }
      return true;
    }),

  body("inventory.quantity")
    .optional()
    .isInt({ min: 0, max: 100000 })
    .withMessage("Inventory quantity must be between 0 and 100,000"),

  body("status")
    .optional()
    .isIn(["active", "inactive", "draft"])
    .withMessage("Status must be either active, inactive, or draft"),

  body("featured")
    .optional()
    .isBoolean()
    .withMessage("Featured must be a boolean value"),
];

// Product ID validation
const validateProductId = [
  param("productId")
    .isMongoId()
    .withMessage("Valid product ID is required")
    .custom(async (productId) => {
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error("Product not found");
      }
      return true;
    }),
];

// Query parameters validation for product listing
const validateProductQuery = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("category")
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage("Category must be between 2 and 50 characters")
    .trim(),

  query("search")
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search query must be between 1 and 100 characters")
    .trim(),

  query("minPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Minimum price must be a positive number"),

  query("maxPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Maximum price must be a positive number")
    .custom((maxPrice, { req }) => {
      if (
        maxPrice &&
        req.query.minPrice &&
        parseFloat(maxPrice) < parseFloat(req.query.minPrice)
      ) {
        throw new Error("Maximum price cannot be less than minimum price");
      }
      return true;
    }),

  query("sortBy")
    .optional()
    .isIn(["name", "price", "createdAt", "rating", "popularity"])
    .withMessage(
      "Sort by must be one of: name, price, createdAt, rating, popularity"
    ),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be either asc or desc"),

  query("status")
    .optional()
    .isIn(["active", "inactive", "draft"])
    .withMessage("Status must be either active, inactive, or draft"),

  query("featured")
    .optional()
    .isBoolean()
    .withMessage("Featured must be a boolean value"),
];

// Review validation
const validateReview = [
  param("productId").isMongoId().withMessage("Valid product ID is required"),

  body("rating")
    .notEmpty()
    .withMessage("Rating is required")
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5"),

  body("comment")
    .optional()
    .isLength({ min: 10, max: 1000 })
    .withMessage("Comment must be between 10 and 1000 characters")
    .trim(),
];

// Bulk operation validation
const validateBulkOperation = [
  body("productIds")
    .isArray({ min: 1 })
    .withMessage("Product IDs array is required with at least one ID")
    .custom((productIds) => {
      if (!productIds.every((id) => mongoose.Types.ObjectId.isValid(id))) {
        throw new Error("All product IDs must be valid MongoDB IDs");
      }
      return true;
    }),

  body("action")
    .isIn(["activate", "deactivate", "delete", "updateInventory"])
    .withMessage(
      "Action must be one of: activate, deactivate, delete, updateInventory"
    ),
];

// Inventory update validation
const validateInventoryUpdate = [
  param("productId").isMongoId().withMessage("Valid product ID is required"),

  body("quantity")
    .notEmpty()
    .withMessage("Quantity is required")
    .isInt({ min: 0, max: 100000 })
    .withMessage("Quantity must be between 0 and 100,000"),

  body("operation")
    .optional()
    .isIn(["set", "increment", "decrement"])
    .withMessage("Operation must be one of: set, increment, decrement"),
];

module.exports = {
  validateCreateProduct,
  validateUpdateProduct,
  validateProductId,
  validateProductQuery,
  validateReview,
  validateBulkOperation,
  validateInventoryUpdate,
};
