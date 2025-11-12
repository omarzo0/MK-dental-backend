const express = require("express");
const router = express.Router();
const { userAuth } = require("../../middleware/userAuth");
const { adminAuth, requirePermission } = require("../../middleware/adminAuth");

// Import validation middleware
const {
  validateCreateTransaction,
  validateTransactionId,
  validateTransactionQuery,
  validateRefundTransaction,
  validateUpdateTransactionStatus,
  validateBulkTransactionOperation,
  validateTransactionSearch,
  validateTransactionAnalytics,
} = require("../../validations/shared/transactionValidation");

// Import controller
const {
  createTransaction,
  getAllTransactions,
  getTransactionById,
  getUserTransactions,
  updateTransactionStatus,
  processRefundTransaction,
  searchTransactions,
  getTransactionAnalytics,
  bulkTransactionOperation,
} = require("../../controllers/shared/transactionController");

// User transaction routes
router.get("/", userAuth, validateTransactionQuery, getUserTransactions);
router.get(
  "/:transactionId",
  userAuth,
  validateTransactionId,
  getTransactionById
);

// Admin transaction routes (require authentication and permissions)
router.post(
  "/",
  adminAuth,
  requirePermission("canManagePayments"),
  validateCreateTransaction,
  createTransaction
);
router.get(
  "/admin/transactions",
  adminAuth,
  requirePermission("canManagePayments"),
  validateTransactionQuery,
  getAllTransactions
);
router.get(
  "/admin/transactions/search",
  adminAuth,
  requirePermission("canManagePayments"),
  validateTransactionSearch,
  searchTransactions
);
router.get(
  "/admin/transactions/analytics",
  adminAuth,
  requirePermission("canViewAnalytics"),
  validateTransactionAnalytics,
  getTransactionAnalytics
);
router.get(
  "/admin/transactions/:transactionId",
  adminAuth,
  requirePermission("canManagePayments"),
  validateTransactionId,
  getTransactionById
);
router.put(
  "/admin/transactions/:transactionId/status",
  adminAuth,
  requirePermission("canManagePayments"),
  validateTransactionId,
  validateUpdateTransactionStatus,
  updateTransactionStatus
);
router.post(
  "/admin/transactions/:transactionId/refund",
  adminAuth,
  requirePermission("canManagePayments"),
  validateTransactionId,
  validateRefundTransaction,
  processRefundTransaction
);

// Admin user transactions route
router.get(
  "/admin/user/:userId",
  adminAuth,
  requirePermission("canManagePayments"),
  getUserTransactions
);

// Bulk operations (admin only)
router.post(
  "/admin/transactions/bulk",
  adminAuth,
  requirePermission("canManagePayments"),
  validateBulkTransactionOperation,
  bulkTransactionOperation
);

module.exports = router;
