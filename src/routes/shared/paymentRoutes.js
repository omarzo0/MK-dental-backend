const express = require("express");
const router = express.Router();
const { userAuth } = require("../../middleware/userAuth");
const { adminAuth, requirePermission } = require("../../middleware/adminAuth");
const { optionalAuth } = require("../../middleware/userAuth");

// Import validation middleware
const {
  validateCreatePayment,
  validateProcessPayment,
  validatePaymentId,
  validatePaymentQuery,
  validateRefundPayment,
  validateUpdatePaymentStatus,
  validateBulkPaymentOperation,
  validateWebhook,
} = require("../../validations/shared/paymentValidation");

// Import controller
const {
  createPayment,
  processPayment,
  getPaymentById,
  getUserPayments,
  getAllPayments,
  refundPayment,
  updatePaymentStatus,
  processWebhook,
  bulkPaymentOperation,
} = require("../../controllers/shared/paymentController");

// User payment routes
router.post("/", userAuth, validateCreatePayment, createPayment);
router.post(
  "/:paymentId/process",
  userAuth,
  validatePaymentId,
  validateProcessPayment,
  processPayment
);
router.get("/", userAuth, validatePaymentQuery, getUserPayments);
router.get("/:paymentId", userAuth, validatePaymentId, getPaymentById);

// Admin payment routes
router.get(
  "/admin/payments",
  adminAuth,
  requirePermission("canManagePayments"),
  validatePaymentQuery,
  getAllPayments
);
router.post(
  "/admin/payments/:paymentId/refund",
  adminAuth,
  requirePermission("canManagePayments"),
  validatePaymentId,
  validateRefundPayment,
  refundPayment
);
router.put(
  "/admin/payments/:paymentId/status",
  adminAuth,
  requirePermission("canManagePayments"),
  validatePaymentId,
  validateUpdatePaymentStatus,
  updatePaymentStatus
);
router.post(
  "/admin/payments/bulk",
  adminAuth,
  requirePermission("canManagePayments"),
  validateBulkPaymentOperation,
  bulkPaymentOperation
);

// Webhook routes (public, called by payment gateways)
router.post("/webhook/:gateway", validateWebhook, processWebhook);

module.exports = router;
