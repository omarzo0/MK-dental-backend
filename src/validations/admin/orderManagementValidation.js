const { body, query, param } = require("express-validator");

const validateOrderQuery = [
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
    .isIn(["pending", "confirmed", "shipped", "delivered", "cancelled"])
    .withMessage("Invalid order status"),

  query("paymentStatus")
    .optional()
    .isIn(["pending", "paid", "failed", "refunded"])
    .withMessage("Invalid payment status"),

  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid date"),

  query("search")
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search query must be between 1 and 100 characters"),

  query("sortBy")
    .optional()
    .isIn(["createdAt", "updatedAt", "totals.total", "orderNumber"])
    .withMessage("Invalid sort field"),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be 'asc' or 'desc'"),
];

const validateOrderStatusUpdate = [
  param("id").isMongoId().withMessage("Valid order ID is required"),

  body("status")
    .isIn(["pending", "confirmed", "shipped", "delivered", "cancelled"])
    .withMessage("Invalid order status"),

  body("trackingNumber")
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage("Tracking number must be between 1 and 100 characters"),

  body("notes")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
];

const validatePaymentStatusUpdate = [
  param("id").isMongoId().withMessage("Valid order ID is required"),

  body("paymentStatus")
    .isIn(["pending", "paid", "failed", "refunded"])
    .withMessage("Invalid payment status"),

  body("refundAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Refund amount must be a positive number"),

  body("refundReason")
    .optional()
    .isLength({ max: 255 })
    .withMessage("Refund reason cannot exceed 255 characters"),
];

const validateOrderExport = [
  query("format")
    .optional()
    .isIn(["csv", "json", "excel"])
    .withMessage("Export format must be csv, json, or excel"),

  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid date"),

  query("fields").optional().isArray().withMessage("Fields must be an array"),
];

const validateOrderAnalytics = [
  query("period")
    .optional()
    .isIn(["7d", "30d", "90d", "1y", "custom"])
    .withMessage("Period must be 7d, 30d, 90d, 1y, or custom"),

  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid date"),

  query("groupBy")
    .optional()
    .isIn(["day", "week", "month", "year"])
    .withMessage("Group by must be day, week, month, or year"),

  query("metrics").optional().isArray().withMessage("Metrics must be an array"),

  query("metrics.*")
    .optional()
    .isIn(["revenue", "orders", "customers", "aov", "conversion"])
    .withMessage("Invalid metric"),
];

module.exports = {
  validateOrderQuery,
  validateOrderStatusUpdate,
  validatePaymentStatusUpdate,
  validateOrderExport,
  validateOrderAnalytics,
};
