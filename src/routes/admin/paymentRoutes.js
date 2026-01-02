// routes/admin/paymentRoutes.js
const express = require("express");
const router = express.Router();
const { adminAuth, requirePermission } = require("../../middleware/adminAuth");

const {
  validatePaymentId,
  validatePaymentQuery,
  validateCreatePayment,
  validateRefundPayment,
  validateUpdatePaymentStatus,
  validateBulkPaymentOperation,
  validateWebhook,
  validateCreatePaymentMethod,
  validateUpdatePaymentMethod,
  validateReorderPaymentMethods,
} = require("../../validations/admin/paymentValidation");

const {
  getAllPayments,
  getPaymentById,
  getPaymentsByUser,
  createPayment,
  refundPayment,
  updatePaymentStatus,
  confirmCODPayment,
  failCODPayment,
  getPaymentStatistics,
  bulkPaymentOperation,
  processWebhook,
  // Payment Methods Management
  getAllPaymentMethods,
  getPaymentMethodByName,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  togglePaymentMethod,
  setDefaultPaymentMethod,
  reorderPaymentMethods,
} = require("../../controllers/admin/paymentController");

// All routes require admin authentication
router.use(adminAuth);

// Payment listing and statistics
router.get(
  "/",
  requirePermission("canManagePayments"),
  validatePaymentQuery,
  getAllPayments
);

// Create payment
router.post(
  "/",
  requirePermission("canManagePayments"),
  validateCreatePayment,
  createPayment
);

router.get(
  "/statistics",
  requirePermission("canViewAnalytics"),
  getPaymentStatistics
);

// ==================== PAYMENT METHODS ROUTES ====================

// Get all payment methods
router.get(
  "/methods",
  requirePermission("canManagePayments"),
  getAllPaymentMethods
);

// Create payment method
router.post(
  "/methods",
  requirePermission("canManagePayments"),
  validateCreatePaymentMethod,
  createPaymentMethod
);

// Reorder payment methods
router.put(
  "/methods/reorder",
  requirePermission("canManagePayments"),
  validateReorderPaymentMethods,
  reorderPaymentMethods
);

// Get single payment method
router.get(
  "/methods/:methodName",
  requirePermission("canManagePayments"),
  getPaymentMethodByName
);

// Update payment method
router.put(
  "/methods/:methodName",
  requirePermission("canManagePayments"),
  validateUpdatePaymentMethod,
  updatePaymentMethod
);

// Delete payment method
router.delete(
  "/methods/:methodName",
  requirePermission("canManagePayments"),
  deletePaymentMethod
);

// Toggle payment method status
router.patch(
  "/methods/:methodName/toggle",
  requirePermission("canManagePayments"),
  togglePaymentMethod
);

// Set default payment method
router.patch(
  "/methods/:methodName/set-default",
  requirePermission("canManagePayments"),
  setDefaultPaymentMethod
);

// ==================== BULK OPERATIONS ====================

router.post(
  "/bulk",
  requirePermission("canManagePayments"),
  validateBulkPaymentOperation,
  bulkPaymentOperation
);

// Get payments by user
router.get(
  "/user/:userId",
  requirePermission("canManagePayments"),
  getPaymentsByUser
);

// ==================== SINGLE PAYMENT OPERATIONS ====================

router.get(
  "/:paymentId",
  requirePermission("canManagePayments"),
  validatePaymentId,
  getPaymentById
);

router.put(
  "/:paymentId/status",
  requirePermission("canManagePayments"),
  validatePaymentId,
  validateUpdatePaymentStatus,
  updatePaymentStatus
);

router.post(
  "/:paymentId/refund",
  requirePermission("canManagePayments"),
  validatePaymentId,
  validateRefundPayment,
  refundPayment
);

router.post(
  "/:paymentId/confirm-cod",
  requirePermission("canManagePayments"),
  validatePaymentId,
  confirmCODPayment
);

router.post(
  "/:paymentId/fail-cod",
  requirePermission("canManagePayments"),
  validatePaymentId,
  failCODPayment
);

// Webhook routes (public, called by payment gateways) - moved outside adminAuth
module.exports = router;

// Export webhook handler separately for public access
module.exports.webhookHandler = { processWebhook, validateWebhook };
