const express = require("express");
const router = express.Router();
const {
  adminAuth,
  requirePermission,
} = require("../../middleware/adminAuth");

const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkProductOperations,
  updateProductInventory,
  getLowStockAlerts,
} = require("../../controllers/admin/productManagementController");

const {
  validateGetProducts,
  validateProductId,
  validateCreateProduct,
  validateUpdateProduct,
  validateDeleteProduct,
  validateBulkOperations,
  validateInventoryUpdate,
  validateLowStockQuery,
} = require("../../validations/admin/productValidation");

// All routes require admin authentication
router.use(adminAuth);

// Product management routes
router.get(
  "/",
  requirePermission("canManageProducts"),
  validateGetProducts,
  getAllProducts
);
router.get(
  "/alerts/low-stock",
  requirePermission("canManageInventory"),
  validateLowStockQuery,
  getLowStockAlerts
);
router.get(
  "/:productId",
  requirePermission("canManageProducts"),
  validateProductId,
  getProductById
);
router.post(
  "/",
  requirePermission("canManageProducts"),
  validateCreateProduct,
  createProduct
);
router.put(
  "/:productId",
  requirePermission("canManageProducts"),
  validateProductId,
  validateUpdateProduct,
  updateProduct
);
router.delete(
  "/:productId",
  requirePermission("canManageProducts"),
  validateProductId,
  validateDeleteProduct,
  deleteProduct
);
router.put(
  "/:productId/inventory",
  requirePermission("canManageInventory"),
  validateProductId,
  validateInventoryUpdate,
  updateProductInventory
);
router.post(
  "/bulk",
  requirePermission("canManageProducts"),
  validateBulkOperations,
  bulkProductOperations
);

module.exports = router;
