const express = require("express");
const router = express.Router();
const {
  adminAuth,
} = require("../../middleware/adminAuth");

const {
  getAllProducts,
  getAllPackages,
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
  validateGetProducts,
  getAllProducts
);
router.get(
  "/packages",
  validateGetProducts,
  getAllPackages
);
router.get(
  "/alerts/low-stock",
  validateLowStockQuery,
  getLowStockAlerts
);
router.get(
  "/:productId",
  validateProductId,
  getProductById
);
router.post(
  "/",
  validateCreateProduct,
  createProduct
);
router.put(
  "/:productId",
  validateProductId,
  validateUpdateProduct,
  updateProduct
);
router.delete(
  "/:productId",
  validateProductId,
  validateDeleteProduct,
  deleteProduct
);
router.put(
  "/:productId/inventory",
  validateProductId,
  validateInventoryUpdate,
  updateProductInventory
);
router.post(
  "/bulk",
  validateBulkOperations,
  bulkProductOperations
);

module.exports = router;
