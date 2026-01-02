// validations/admin/paymentValidation.js
const { body, param, query } = require("express-validator");
const mongoose = require("mongoose");
const Payment = require("../../models/Payment");
const Order = require("../../models/Order");

// Payment ID validation (Admin - no user check)
const validatePaymentId = [
  param("paymentId")
    .isMongoId()
    .withMessage("Valid payment ID is required")
    .custom(async (paymentId) => {
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        throw new Error("Payment not found");
      }
      return true;
    }),
];

// Create payment validation
const validateCreatePayment = [
  body("orderId")
    .notEmpty()
    .withMessage("Order ID is required")
    .isMongoId()
    .withMessage("Valid order ID is required"),

  body("userId")
    .optional()
    .isMongoId()
    .withMessage("Valid user ID is required"),

  body("paymentMethod")
    .notEmpty()
    .withMessage("Payment method is required")
    .isIn(["visa", "mastercard", "cod", "credit_card", "debit_card", "paypal", "stripe", "bank_transfer"])
    .withMessage("Invalid payment method"),

  body("amount")
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage("Amount must be greater than 0"),

  body("currency")
    .optional()
    .isIn(["EGP", "USD", "EUR"])
    .withMessage("Invalid currency"),

  body("status")
    .optional()
    .isIn(["pending", "completed"])
    .withMessage("Status must be pending or completed"),

  body("notes")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
];

// Query validation for payment listing
const validatePaymentQuery = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("status")
    .optional()
    .isIn(["pending", "completed", "failed", "refunded", "partially_refunded", "cancelled"])
    .withMessage("Invalid status"),

  query("paymentMethod")
    .optional()
    .isIn(["visa", "mastercard", "cod", "credit_card", "debit_card", "paypal", "stripe", "bank_transfer"])
    .withMessage("Invalid payment method"),

  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid date")
    .custom((endDate, { req }) => {
      if (req.query.startDate && new Date(endDate) < new Date(req.query.startDate)) {
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
    .withMessage("Maximum amount must be a positive number"),

  query("sortBy")
    .optional()
    .isIn(["createdAt", "amount", "status", "paymentMethod"])
    .withMessage("Invalid sort field"),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be either asc or desc"),
];

// Refund payment validation
const validateRefundPayment = [
  body("refundAmount")
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage("Refund amount must be greater than 0"),

  body("reason")
    .optional()
    .isLength({ min: 5, max: 500 })
    .withMessage("Reason must be between 5 and 500 characters"),
];

// Update payment status validation
const validateUpdatePaymentStatus = [
  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(["pending", "completed", "failed", "refunded", "partially_refunded", "cancelled"])
    .withMessage("Invalid status"),

  body("refundAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Refund amount must be a positive number"),
];

// Bulk payment operations validation
const validateBulkPaymentOperation = [
  body("paymentIds")
    .isArray({ min: 1 })
    .withMessage("Payment IDs array is required with at least one ID")
    .custom((paymentIds) => {
      if (!paymentIds.every((id) => mongoose.Types.ObjectId.isValid(id))) {
        throw new Error("All payment IDs must be valid MongoDB IDs");
      }
      return true;
    }),

  body("action")
    .isIn(["export", "refund", "update_status", "analyze"])
    .withMessage("Action must be one of: export, refund, update_status, analyze"),

  body("data")
    .optional()
    .isObject()
    .withMessage("Data must be an object"),
];

// Webhook validation
const validateWebhook = [
  body("type")
    .notEmpty()
    .withMessage("Webhook type is required"),

  body("data")
    .notEmpty()
    .withMessage("Webhook data is required")
    .isObject()
    .withMessage("Webhook data must be an object"),

  body("signature")
    .optional()
    .isLength({ min: 10 })
    .withMessage("Signature must be at least 10 characters"),
];

// Create payment method validation
const validateCreatePaymentMethod = [
  body("name")
    .notEmpty()
    .withMessage("Payment method name is required")
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters")
    .matches(/^[a-z_]+$/)
    .withMessage("Name must be lowercase letters and underscores only"),

  body("displayName")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Display name cannot exceed 100 characters"),

  body("description")
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("instructions")
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage("Instructions cannot exceed 1000 characters"),

  body("icon")
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage("Icon cannot exceed 100 characters"),

  body("enabled")
    .optional()
    .isBoolean()
    .withMessage("Enabled must be a boolean"),

  body("testMode")
    .optional()
    .isBoolean()
    .withMessage("Test mode must be a boolean"),

  body("credentials")
    .optional()
    .isObject()
    .withMessage("Credentials must be an object"),

  body("fees")
    .optional()
    .isObject()
    .withMessage("Fees must be an object"),

  body("fees.type")
    .optional()
    .isIn(["fixed", "percentage"])
    .withMessage("Fee type must be fixed or percentage"),

  body("fees.value")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Fee value must be a positive number"),

  body("minAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Minimum amount must be a positive number"),

  body("maxAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Maximum amount must be a positive number"),

  body("order")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Order must be a non-negative integer"),
];

// Update payment method validation
const validateUpdatePaymentMethod = [
  body("displayName")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Display name cannot exceed 100 characters"),

  body("description")
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("instructions")
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage("Instructions cannot exceed 1000 characters"),

  body("icon")
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage("Icon cannot exceed 100 characters"),

  body("enabled")
    .optional()
    .isBoolean()
    .withMessage("Enabled must be a boolean"),

  body("testMode")
    .optional()
    .isBoolean()
    .withMessage("Test mode must be a boolean"),

  body("credentials")
    .optional()
    .isObject()
    .withMessage("Credentials must be an object"),

  body("fees")
    .optional()
    .isObject()
    .withMessage("Fees must be an object"),

  body("fees.type")
    .optional()
    .isIn(["fixed", "percentage"])
    .withMessage("Fee type must be fixed or percentage"),

  body("fees.value")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Fee value must be a positive number"),

  body("minAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Minimum amount must be a positive number"),

  body("maxAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Maximum amount must be a positive number"),

  body("order")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Order must be a non-negative integer"),
];

// Reorder payment methods validation
const validateReorderPaymentMethods = [
  body("methodOrder")
    .isArray({ min: 1 })
    .withMessage("methodOrder must be a non-empty array of method names"),

  body("methodOrder.*")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Each method name must be a non-empty string"),
];

module.exports = {
  validatePaymentId,
  validateCreatePayment,
  validatePaymentQuery,
  validateRefundPayment,
  validateUpdatePaymentStatus,
  validateBulkPaymentOperation,
  validateWebhook,
  validateCreatePaymentMethod,
  validateUpdatePaymentMethod,
  validateReorderPaymentMethods,
};
