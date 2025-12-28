const express = require("express");
const router = express.Router();
const { adminAuth, requirePermission, checkPermission } = require("../../middleware/adminAuth");

const {
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  updatePaymentStatus,
  deleteOrder,
  getOrderStats,
  exportOrders,
  getOrderAnalytics,
  processRefund,
  addOrderNote,
  getOrderNotes,
  generateInvoice,
  cancelOrder,
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
  checkPermission("canManageOrders"),
  validateOrderQuery,
  getAllOrders
);

// Get order statistics
router.get(
  "/stats/overview",
  checkPermission("canViewAnalytics"),
  validateOrderAnalytics,
  getOrderStats
);

// Export orders
router.get(
  "/export",
  checkPermission("canManageOrders"),
  validateOrderExport,
  exportOrders
);

// Get order analytics
router.get(
  "/analytics",
  checkPermission("canViewAnalytics"),
  validateOrderAnalytics,
  getOrderAnalytics
);

// Get specific order by ID
router.get("/:id", checkPermission("canManageOrders"), getOrderById);

// Update order status
router.put(
  "/:id/status",
  checkPermission("canManageOrders"),
  validateOrderStatusUpdate,
  updateOrderStatus
);

// Update payment status
router.put(
  "/:id/payment-status",
  checkPermission("canManageOrders"),
  validatePaymentStatusUpdate,
  updatePaymentStatus
);

// Process refund
router.post(
  "/:id/refund",
  checkPermission("canManagePayments"),
  processRefund
);

// Cancel order
router.post(
  "/:id/cancel",
  checkPermission("canManageOrders"),
  cancelOrder
);

// Order notes
router.get(
  "/:id/notes",
  checkPermission("canManageOrders"),
  getOrderNotes
);

router.post(
  "/:id/notes",
  checkPermission("canManageOrders"),
  addOrderNote
);

// Generate invoice
router.get(
  "/:id/invoice",
  checkPermission("canManageOrders"),
  generateInvoice
);

// Delete order (soft delete)
router.delete("/:id", checkPermission("canManageOrders"), deleteOrder);

module.exports = router;
