const express = require("express");
const router = express.Router();
const { userAuth } = require("../../middleware/userAuth");
const { adminAuth, requirePermission } = require("../../middleware/adminAuth");
const { optionalAuth } = require("../../middleware/userAuth");

// Import validation middleware
const {
  validateCreateProduct,
  validateUpdateProduct,
  validateProductId,
  validateProductQuery,
  validateBulkOperation,
  validateInventoryUpdate,
} = require("../../validations/shared/productValidation");

// Import controller
const {
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
} = require("../../controllers/shared/productController");

// Public routes (no authentication required)
router.get("/", optionalAuth, validateProductQuery, getAllProducts);
router.get("/featured", getFeaturedProducts);
router.get("/search", searchProducts);
router.get("/category/:category", getProductsByCategory);
router.get("/slug/:slug", getProductBySlug);
router.get("/:productId", optionalAuth, validateProductId, getProductById);

// Protected Admin routes
router.post(
  "/",
  adminAuth,
  requirePermission("canManageProducts"),
  validateCreateProduct,
  createProduct
);
router.put(
  "/:productId",
  adminAuth,
  requirePermission("canManageProducts"),
  validateProductId,
  validateUpdateProduct,
  updateProduct
);
router.delete(
  "/:productId",
  adminAuth,
  requirePermission("canManageProducts"),
  validateProductId,
  deleteProduct
);
router.post(
  "/bulk",
  adminAuth,
  requirePermission("canManageProducts"),
  validateBulkOperation,
  bulkProductOperation
);
router.put(
  "/:productId/inventory",
  adminAuth,
  requirePermission("canManageInventory"),
  validateProductId,
  validateInventoryUpdate,
  updateProductInventory
);

module.exports = router;
