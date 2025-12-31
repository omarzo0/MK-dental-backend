const { body, param } = require("express-validator");

const validateAddToCart = [
  body("productId").isMongoId().withMessage("Valid product ID is required"),

  body("quantity")
    .isInt({ min: 1, max: 10 })
    .withMessage("Quantity must be between 1 and 10"),

  body("notes")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Item notes cannot exceed 200 characters"),
];

const validateUpdateCartItem = [
  param("itemId").isMongoId().withMessage("Valid cart item ID is required"),

  body("quantity")
    .isInt({ min: 1, max: 10 })
    .withMessage("Quantity must be between 1 and 10"),

  body("notes")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Item notes cannot exceed 200 characters"),
];

const validateRemoveCartItem = [
  param("itemId").isMongoId().withMessage("Valid cart item ID is required"),
];

const validateApplyCoupon = [
  body("code")
    .notEmpty()
    .withMessage("Coupon code is required")
    .isLength({ min: 3, max: 20 })
    .withMessage("Coupon code must be between 3 and 20 characters")
    .matches(/^[A-Z0-9_-]+$/i)
    .withMessage(
      "Coupon code can only contain letters, numbers, hyphens, and underscores"
    ),
];

const validateShippingAddress = [
  body("street")
    .optional()
    .isLength({ max: 255 })
    .withMessage("Street address cannot exceed 255 characters"),

  body("city")
    .optional()
    .isLength({ max: 100 })
    .withMessage("City cannot exceed 100 characters"),

  body("state")
    .optional()
    .isLength({ max: 100 })
    .withMessage("State cannot exceed 100 characters"),

  body("zipCode")
    .optional()
    .isPostalCode("any")
    .withMessage("Please provide a valid zip code"),

  body("country")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Country cannot exceed 100 characters"),
];

const validateCartNotes = [
  body("notes")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Cart notes cannot exceed 500 characters"),
];

const validateUpdateShippingFee = [
  body("shippingFeeId")
    .notEmpty()
    .withMessage("Shipping fee ID is required")
    .isMongoId()
    .withMessage("Valid shipping fee ID is required"),
];

module.exports = {
  validateAddToCart,
  validateUpdateCartItem,
  validateRemoveCartItem,
  validateApplyCoupon,
  validateShippingAddress,
  validateCartNotes,
  validateUpdateShippingFee,
};
