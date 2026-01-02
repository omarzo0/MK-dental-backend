// validations/user/paymentValidation.js
const { body, param, query } = require("express-validator");
const Payment = require("../../models/Payment");
const Order = require("../../models/Order");
const PaymentSettings = require("../../models/PaymentSettings");

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

      // Check if order belongs to user
      if (order.userId.toString() !== req.user.userId) {
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
    .isString()
    .withMessage("Payment method must be a string")
    .custom(async (paymentMethod, { req }) => {
      // Validate against configured payment methods
      const settings = await PaymentSettings.getSettings();
      const methods = settings?.methods || [];
      const method = methods.find(m => m.name === paymentMethod && m.enabled);
      
      if (!method) {
        throw new Error(`Payment method '${paymentMethod}' is not available`);
      }
      
      return true;
    }),

  body("amount")
    .notEmpty()
    .withMessage("Amount is required")
    .isFloat({ min: 0.01 })
    .withMessage("Amount must be greater than 0")
    .custom(async (amount, { req }) => {
      if (req.body.orderId) {
        const order = await Order.findById(req.body.orderId);
        if (order && parseFloat(amount) !== order.totals.total) {
          throw new Error(`Payment amount must match order total: ${order.totals.total} EGP`);
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
    .default("EGP"),
];

// Process payment validation
const validateProcessPayment = [
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
      if (payment.userId.toString() !== req.user.userId) {
        throw new Error("Access denied to this payment");
      }

      return true;
    }),
];

// Order ID validation
const validateOrderId = [
  param("orderId")
    .isMongoId()
    .withMessage("Valid order ID is required")
    .custom(async (orderId, { req }) => {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error("Order not found");
      }

      // For users, ensure they can only access their own orders
      if (order.userId.toString() !== req.user.userId) {
        throw new Error("Access denied to this order");
      }

      return true;
    }),
];

// Validate payment method check
const validatePaymentMethodCheck = [
  body("paymentMethod")
    .notEmpty()
    .withMessage("Payment method is required")
    .isString()
    .withMessage("Payment method must be a string"),

  body("orderAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Order amount must be a positive number"),
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
    .isIn(["pending", "completed", "failed", "refunded", "partially_refunded", "cancelled"])
    .withMessage("Invalid status"),

  query("paymentMethod")
    .optional()
    .isString()
    .withMessage("Payment method must be a string"),

  query("sortBy")
    .optional()
    .isIn(["createdAt", "amount", "status"])
    .withMessage("Sort by must be createdAt, amount, or status"),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be either asc or desc"),
];

module.exports = {
  validateCreatePayment,
  validateProcessPayment,
  validatePaymentId,
  validatePaymentQuery,
  validatePaymentMethodCheck,
  validateOrderId,
};
