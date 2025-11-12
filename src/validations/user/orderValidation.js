const { body, param, query } = require("express-validator");

const validateCreateOrder = [
  body("shippingAddress.street")
    .notEmpty()
    .withMessage("Street address is required")
    .isLength({ max: 255 })
    .withMessage("Street address cannot exceed 255 characters"),

  body("shippingAddress.city")
    .notEmpty()
    .withMessage("City is required")
    .isLength({ max: 100 })
    .withMessage("City cannot exceed 100 characters"),

  body("shippingAddress.state")
    .notEmpty()
    .withMessage("State is required")
    .isLength({ max: 100 })
    .withMessage("State cannot exceed 100 characters"),

  body("shippingAddress.zipCode")
    .notEmpty()
    .withMessage("Zip code is required")
    .isPostalCode("any")
    .withMessage("Please provide a valid zip code"),

  body("shippingAddress.country")
    .notEmpty()
    .withMessage("Country is required")
    .isLength({ max: 100 })
    .withMessage("Country cannot exceed 100 characters"),

  body("billingAddress.street")
    .optional()
    .isLength({ max: 255 })
    .withMessage("Street address cannot exceed 255 characters"),

  body("billingAddress.city")
    .optional()
    .isLength({ max: 100 })
    .withMessage("City cannot exceed 100 characters"),

  body("billingAddress.state")
    .optional()
    .isLength({ max: 100 })
    .withMessage("State cannot exceed 100 characters"),

  body("billingAddress.zipCode")
    .optional()
    .isPostalCode("any")
    .withMessage("Please provide a valid zip code"),

  body("billingAddress.country")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Country cannot exceed 100 characters"),

  body("shippingMethod")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Shipping method cannot exceed 50 characters"),

  body("notes")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Order notes cannot exceed 500 characters"),
];

const validateOrderId = [
  param("orderId").isMongoId().withMessage("Valid order ID is required"),
];

const validateCancelOrder = [
  body("reason")
    .optional()
    .isLength({ max: 255 })
    .withMessage("Cancellation reason cannot exceed 255 characters"),
];

const validateReturnRequest = [
  body("reason")
    .notEmpty()
    .withMessage("Return reason is required")
    .isLength({ max: 500 })
    .withMessage("Return reason cannot exceed 500 characters"),

  body("items")
    .isArray({ min: 1 })
    .withMessage("At least one item must be selected for return"),

  body("items.*.itemId").isMongoId().withMessage("Valid item ID is required"),

  body("items.*.quantity")
    .isInt({ min: 1 })
    .withMessage("Return quantity must be at least 1"),

  body("items.*.reason")
    .optional()
    .isLength({ max: 255 })
    .withMessage("Item return reason cannot exceed 255 characters"),
];

const validateOrderQuery = [
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
    .isIn(["pending", "confirmed", "shipped", "delivered", "cancelled"])
    .withMessage("Invalid order status"),

  query("sortBy")
    .optional()
    .isIn(["createdAt", "updatedAt", "totals.total"])
    .withMessage("Invalid sort field"),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be 'asc' or 'desc'"),
];

module.exports = {
  validateCreateOrder,
  validateOrderId,
  validateCancelOrder,
  validateReturnRequest,
  validateOrderQuery,
};
