// routes/admin/transactionRoutes.js
const express = require("express");
const router = express.Router();
const { adminAuth, requirePermission } = require("../../middleware/adminAuth");

const {
  validateCreateTransaction,
  validateTransactionId,
  validateTransactionQuery,
  validateRefundTransaction,
  validateUpdateTransactionStatus,
  validateBulkTransactionOperation,
  validateTransactionSearch,
  validateTransactionAnalytics,
} = require("../../validations/admin/transactionValidation");

const {
  createTransaction,
  getAllTransactions,
  getTransactionById,
  getTransactionsByUser,
  updateTransactionStatus,
  processRefundTransaction,
  searchTransactions,
  getTransactionAnalytics,
  bulkTransactionOperation,
} = require("../../controllers/admin/transactionController");

// All routes require admin authentication
router.use(adminAuth);

// Transaction listing and search
router.get(
  "/",
  requirePermission("canManagePayments"),
  validateTransactionQuery,
  getAllTransactions
);

router.get(
  "/search",
  requirePermission("canManagePayments"),
  validateTransactionSearch,
  searchTransactions
);

router.get(
  "/analytics",
  requirePermission("canViewAnalytics"),
  validateTransactionAnalytics,
  getTransactionAnalytics
);

// Create transaction
router.post(
  "/",
  requirePermission("canManagePayments"),
  validateCreateTransaction,
  createTransaction
);

// Bulk operations
router.post(
  "/bulk",
  requirePermission("canManagePayments"),
  validateBulkTransactionOperation,
  bulkTransactionOperation
);

// Get transactions by user
router.get(
  "/user/:userId",
  requirePermission("canManagePayments"),
  getTransactionsByUser
);

// Single transaction operations
router.get(
  "/:transactionId",
  requirePermission("canManagePayments"),
  validateTransactionId,
  getTransactionById
);

router.put(
  "/:transactionId/status",
  requirePermission("canManagePayments"),
  validateTransactionId,
  validateUpdateTransactionStatus,
  updateTransactionStatus
);

router.post(
  "/:transactionId/refund",
  requirePermission("canManagePayments"),
  validateTransactionId,
  validateRefundTransaction,
  processRefundTransaction
);

module.exports = router;
