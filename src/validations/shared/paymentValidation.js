const { body, param, query } = require("express-validator");
const Payment = require("../../models/Payment");
const Order = require("../../models/Order");

// Create payment validation
const validateCreatePayment = [
  body("orderId")
    .notEmpty()
    .withMessage("Order ID is required")
    .isMongoId()
    .withMessage("Valid order ID is required")
    .custom(async (orderId, { req }) => {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error("Order not found");
      }

      // Check if order belongs to user (for user payments)
      if (
        req.user?.role === "user" &&
        order.userId.toString() !== req.user.userId
      ) {
        throw new Error("Access denied to this order");
      }

      // Check if payment already exists for this order
      const existingPayment = await Payment.findOne({ orderId });
      if (existingPayment) {
        throw new Error("Payment already exists for this order");
      }

      return true;
    }),

  body("paymentMethod")
    .notEmpty()
    .withMessage("Payment method is required")
    .isIn(["credit_card", "debit_card", "paypal", "stripe", "bank_transfer"])
    .withMessage(
      "Payment method must be credit_card, debit_card, paypal, stripe, or bank_transfer"
    ),

  body("amount")
    .notEmpty()
    .withMessage("Amount is required")
    .isFloat({ min: 0.01 })
    .withMessage("Amount must be greater than 0")
    .custom(async (amount, { req }) => {
      if (req.body.orderId) {
        const order = await Order.findById(req.body.orderId);
        if (order && parseFloat(amount) !== order.totals.total) {
          throw new Error(
            `Payment amount must match order total: $${order.totals.total}`
          );
        }
      }
      return true;
    }),

  body("paymentDetails.cardNumber")
    .optional()
    .isCreditCard()
    .withMessage("Valid credit card number is required"),

  body("paymentDetails.cardHolder")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Card holder name must be between 2 and 100 characters"),

  body("paymentDetails.expiryMonth")
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage("Expiry month must be between 1 and 12"),

  body("paymentDetails.expiryYear")
    .optional()
    .isInt({
      min: new Date().getFullYear(),
      max: new Date().getFullYear() + 20,
    })
    .withMessage("Expiry year must be valid"),

  body("paymentDetails.cvv")
    .optional()
    .isLength({ min: 3, max: 4 })
    .withMessage("CVV must be 3 or 4 digits")
    .isNumeric()
    .withMessage("CVV must contain only numbers"),

  body("currency")
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage("Currency must be a 3-letter code")
    .default("USD"),
];

// Process payment validation
const validateProcessPayment = [
  param("paymentId")
    .isMongoId()
    .withMessage("Valid payment ID is required")
    .custom(async (paymentId, { req }) => {
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        throw new Error("Payment not found");
      }

      // For users, ensure they can only access their own payments
      if (
        req.user?.role === "user" &&
        payment.userId.toString() !== req.user.userId
      ) {
        throw new Error("Access denied to this payment");
      }

      return true;
    }),

  body("paymentToken")
    .optional()
    .isLength({ min: 10, max: 500 })
    .withMessage("Payment token must be between 10 and 500 characters"),

  body("savePaymentMethod")
    .optional()
    .isBoolean()
    .withMessage("savePaymentMethod must be a boolean value"),
];

// Payment ID validation
const validatePaymentId = [
  param("paymentId")
    .isMongoId()
    .withMessage("Valid payment ID is required")
    .custom(async (paymentId, { req }) => {
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        throw new Error("Payment not found");
      }

      // For users, ensure they can only access their own payments
      if (
        req.user?.role === "user" &&
        payment.userId.toString() !== req.user.userId
      ) {
        throw new Error("Access denied to this payment");
      }

      return true;
    }),
];

// Query validation for payment listing
const validatePaymentQuery = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),

  query("status")
    .optional()
    .isIn([
      "pending",
      "completed",
      "failed",
      "refunded",
      "partially_refunded",
      "cancelled",
    ])
    .withMessage(
      "Status must be pending, completed, failed, refunded, partially_refunded, or cancelled"
    ),

  query("paymentMethod")
    .optional()
    .isIn(["credit_card", "debit_card", "paypal", "stripe", "bank_transfer"])
    .withMessage(
      "Payment method must be credit_card, debit_card, paypal, stripe, or bank_transfer"
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

  query("sortBy")
    .optional()
    .isIn(["createdAt", "paymentDate", "amount", "status"])
    .withMessage("Sort by must be createdAt, paymentDate, amount, or status"),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be either asc or desc"),
];

// Refund payment validation
const validateRefundPayment = [
  param("paymentId").isMongoId().withMessage("Valid payment ID is required"),

  body("refundAmount")
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage("Refund amount must be greater than 0"),

  body("reason")
    .notEmpty()
    .withMessage("Refund reason is required")
    .isLength({ min: 5, max: 500 })
    .withMessage("Reason must be between 5 and 500 characters"),
];

// Update payment status validation (Admin)
const validateUpdatePaymentStatus = [
  param("paymentId").isMongoId().withMessage("Valid payment ID is required"),

  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn([
      "pending",
      "completed",
      "failed",
      "refunded",
      "partially_refunded",
      "cancelled",
    ])
    .withMessage(
      "Status must be pending, completed, failed, refunded, partially_refunded, or cancelled"
    ),

  body("refundAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Refund amount must be a positive number"),
];

// Payment method validation
const validatePaymentMethod = [
  body("type")
    .notEmpty()
    .withMessage("Payment method type is required")
    .isIn(["credit_card", "debit_card", "paypal", "bank_account"])
    .withMessage(
      "Type must be credit_card, debit_card, paypal, or bank_account"
    ),

  body("isDefault")
    .optional()
    .isBoolean()
    .withMessage("isDefault must be a boolean value"),

  body("cardDetails.cardNumber")
    .optional()
    .isCreditCard()
    .withMessage("Valid credit card number is required"),

  body("cardDetails.cardHolder")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Card holder name must be between 2 and 100 characters"),

  body("cardDetails.expiryMonth")
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage("Expiry month must be between 1 and 12"),

  body("cardDetails.expiryYear")
    .optional()
    .isInt({
      min: new Date().getFullYear(),
      max: new Date().getFullYear() + 20,
    })
    .withMessage("Expiry year must be valid"),

  body("cardDetails.last4")
    .optional()
    .isLength(4)
    .withMessage("Last 4 digits must be 4 characters")
    .isNumeric()
    .withMessage("Last 4 digits must contain only numbers"),

  body("cardDetails.brand")
    .optional()
    .isIn(["visa", "mastercard", "amex", "discover", "other"])
    .withMessage("Brand must be visa, mastercard, amex, discover, or other"),
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
    .withMessage(
      "Action must be one of: export, refund, update_status, analyze"
    ),

  body("data").optional().isObject().withMessage("Data must be an object"),
];

// Payment webhook validation
const validateWebhook = [
  body("type").notEmpty().withMessage("Webhook type is required"),

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

module.exports = {
  validateCreatePayment,
  validateProcessPayment,
  validatePaymentId,
  validatePaymentQuery,
  validateRefundPayment,
  validateUpdatePaymentStatus,
  validatePaymentMethod,
  validateBulkPaymentOperation,
  validateWebhook,
};
