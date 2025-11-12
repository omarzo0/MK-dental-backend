const { body, param, query } = require("express-validator");
const Transaction = require("../../models/Transaction");
const Payment = require("../../models/Payment");
const Order = require("../../models/Order");

// Create transaction validation
const validateCreateTransaction = [
  body("paymentId")
    .notEmpty()
    .withMessage("Payment ID is required")
    .isMongoId()
    .withMessage("Valid payment ID is required")
    .custom(async (paymentId) => {
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        throw new Error("Payment not found");
      }
      return true;
    }),

  body("type")
    .notEmpty()
    .withMessage("Transaction type is required")
    .isIn(["sale", "refund", "authorization", "capture", "void"])
    .withMessage("Type must be sale, refund, authorization, capture, or void"),

  body("amount")
    .notEmpty()
    .withMessage("Amount is required")
    .isFloat({ min: 0.01 })
    .withMessage("Amount must be greater than 0"),

  body("gatewayTransactionId")
    .notEmpty()
    .withMessage("Gateway transaction ID is required")
    .isLength({ min: 5, max: 100 })
    .withMessage("Gateway transaction ID must be between 5 and 100 characters"),

  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(["success", "failed", "pending", "cancelled"])
    .withMessage("Status must be success, failed, pending, or cancelled"),

  body("currency")
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage("Currency must be a 3-letter code")
    .default("USD"),

  body("gatewayResponse")
    .optional()
    .isObject()
    .withMessage("Gateway response must be an object"),
];

// Transaction ID validation
const validateTransactionId = [
  param("transactionId")
    .isMongoId()
    .withMessage("Valid transaction ID is required")
    .custom(async (transactionId) => {
      const transaction = await Transaction.findById(transactionId);
      if (!transaction) {
        throw new Error("Transaction not found");
      }
      return true;
    }),
];

// Query validation for transaction listing
const validateTransactionQuery = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("type")
    .optional()
    .isIn(["sale", "refund", "authorization", "capture", "void"])
    .withMessage("Type must be sale, refund, authorization, capture, or void"),

  query("status")
    .optional()
    .isIn(["success", "failed", "pending", "cancelled"])
    .withMessage("Status must be success, failed, pending, or cancelled"),

  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid date")
    .custom((endDate, { req }) => {
      if (
        req.query.startDate &&
        new Date(endDate) < new Date(req.query.startDate)
      ) {
        throw new Error("End date cannot be before start date");
      }
      return true;
    }),

  query("minAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Minimum amount must be a positive number"),

  query("maxAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Maximum amount must be a positive number")
    .custom((maxAmount, { req }) => {
      if (
        maxAmount &&
        req.query.minAmount &&
        parseFloat(maxAmount) < parseFloat(req.query.minAmount)
      ) {
        throw new Error("Maximum amount cannot be less than minimum amount");
      }
      return true;
    }),

  query("gateway")
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage("Gateway must be between 2 and 50 characters"),

  query("sortBy")
    .optional()
    .isIn(["createdAt", "processedAt", "amount", "type"])
    .withMessage("Sort by must be createdAt, processedAt, amount, or type"),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be either asc or desc"),
];

// Refund transaction validation
const validateRefundTransaction = [
  param("transactionId")
    .isMongoId()
    .withMessage("Valid transaction ID is required"),

  body("refundAmount")
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage("Refund amount must be greater than 0"),

  body("reason")
    .optional()
    .isLength({ min: 5, max: 500 })
    .withMessage("Reason must be between 5 and 500 characters"),
];

// Update transaction status validation
const validateUpdateTransactionStatus = [
  param("transactionId")
    .isMongoId()
    .withMessage("Valid transaction ID is required"),

  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(["success", "failed", "pending", "cancelled"])
    .withMessage("Status must be success, failed, pending, or cancelled"),

  body("gatewayResponse")
    .optional()
    .isObject()
    .withMessage("Gateway response must be an object"),
];

// Bulk transaction operations validation
const validateBulkTransactionOperation = [
  body("transactionIds")
    .isArray({ min: 1 })
    .withMessage("Transaction IDs array is required with at least one ID")
    .custom((transactionIds) => {
      if (!transactionIds.every((id) => mongoose.Types.ObjectId.isValid(id))) {
        throw new Error("All transaction IDs must be valid MongoDB IDs");
      }
      return true;
    }),

  body("action")
    .isIn(["export", "analyze", "reconcile"])
    .withMessage("Action must be one of: export, analyze, reconcile"),

  body("format")
    .optional()
    .isIn(["csv", "json", "pdf"])
    .withMessage("Format must be csv, json, or pdf"),
];

// Transaction search validation
const validateTransactionSearch = [
  query("q")
    .notEmpty()
    .withMessage("Search query is required")
    .isLength({ min: 1, max: 100 })
    .withMessage("Search query must be between 1 and 100 characters"),

  query("searchField")
    .optional()
    .isIn(["gatewayTransactionId", "paymentId", "orderId", "all"])
    .withMessage(
      "Search field must be gatewayTransactionId, paymentId, orderId, or all"
    ),
];

// Transaction analytics validation
const validateTransactionAnalytics = [
  query("period")
    .optional()
    .isIn(["today", "yesterday", "week", "month", "quarter", "year", "custom"])
    .withMessage(
      "Period must be today, yesterday, week, month, quarter, year, or custom"
    ),

  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid date")
    .custom((endDate, { req }) => {
      if (
        req.query.startDate &&
        new Date(endDate) < new Date(req.query.startDate)
      ) {
        throw new Error("End date cannot be before start date");
      }
      return true;
    }),

  query("groupBy")
    .optional()
    .isIn(["day", "week", "month", "year", "type", "status", "gateway"])
    .withMessage(
      "Group by must be day, week, month, year, type, status, or gateway"
    ),
];

module.exports = {
  validateCreateTransaction,
  validateTransactionId,
  validateTransactionQuery,
  validateRefundTransaction,
  validateUpdateTransactionStatus,
  validateBulkTransactionOperation,
  validateTransactionSearch,
  validateTransactionAnalytics,
};
