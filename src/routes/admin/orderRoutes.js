const express = require("express");
const router = express.Router();
const { adminAuth, requirePermission } = require("../../middleware/adminAuth");

const {
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  updatePaymentStatus,
  deleteOrder,
  getOrderStats,
  exportOrders,
  getOrderAnalytics,
} = require("../../controllers/admin/orderManagementController");

const {
  validateOrderQuery,
  validateOrderStatusUpdate,
  validatePaymentStatusUpdate,
  validateOrderExport,
  validateOrderAnalytics,
} = require("../../validations/admin/orderManagementValidation");

// All routes require admin authentication
router.use(adminAuth);

// Get all orders with filtering and pagination
router.get(
  "/",
  requirePermission("canViewOrders"),
  validateOrderQuery,
  getAllOrders
);

// Get order statistics
router.get(
  "/stats/overview",
  requirePermission("canViewAnalytics"),
  validateOrderAnalytics,
  getOrderStats
);

// Export orders
router.get(
  "/export",
  requirePermission("canExportOrders"),
  validateOrderExport,
  exportOrders
);

// Get order analytics
router.get(
  "/analytics",
  requirePermission("canViewAnalytics"),
  validateOrderAnalytics,
  getOrderAnalytics
);

// Get specific order by ID
router.get("/:id", requirePermission("canViewOrders"), getOrderById);

// Update order status
router.put(
  "/:id/status",
  requirePermission("canUpdateOrders"),
  validateOrderStatusUpdate,
  updateOrderStatus
);

// Update payment status
router.put(
  "/:id/payment-status",
  requirePermission("canUpdateOrders"),
  validatePaymentStatusUpdate,
  updatePaymentStatus
);

// Delete order (soft delete)
router.delete("/:id", requirePermission("canDeleteOrders"), deleteOrder);

module.exports = router;
