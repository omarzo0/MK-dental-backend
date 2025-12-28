// validations/admin/couponValidation.js
const { body, param, query } = require("express-validator");

const validateCreateCoupon = [
  body("code")
    .trim()
    .notEmpty()
    .withMessage("Coupon code is required")
    .isLength({ min: 3, max: 20 })
    .withMessage("Coupon code must be between 3 and 20 characters")
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage("Coupon code can only contain letters, numbers, hyphens, and underscores"),

  body("name")
    .trim()
    .notEmpty()
    .withMessage("Coupon name is required")
    .isLength({ max: 100 })
    .withMessage("Coupon name cannot exceed 100 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("discountType")
    .notEmpty()
    .withMessage("Discount type is required")
    .isIn(["percentage", "fixed", "free_shipping"])
    .withMessage("Invalid discount type"),

  body("discountValue")
    .if(body("discountType").not().equals("free_shipping"))
    .notEmpty()
    .withMessage("Discount value is required")
    .isFloat({ min: 0 })
    .withMessage("Discount value must be a positive number"),

  body("maxDiscountAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Max discount amount must be a positive number"),

  body("usageLimit.total")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Total usage limit must be at least 1"),

  body("usageLimit.perCustomer")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Per customer limit must be at least 1"),

  body("minimumPurchase")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Minimum purchase must be a positive number"),

  body("minimumItems")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Minimum items must be a non-negative integer"),

  body("restrictions.categories")
    .optional()
    .isArray()
    .withMessage("Categories must be an array"),

  body("restrictions.products")
    .optional()
    .isArray()
    .withMessage("Products must be an array"),

  body("restrictions.excludeCategories")
    .optional()
    .isArray()
    .withMessage("Exclude categories must be an array"),

  body("restrictions.excludeProducts")
    .optional()
    .isArray()
    .withMessage("Exclude products must be an array"),

  body("restrictions.productTypes")
    .optional()
    .isArray()
    .withMessage("Product types must be an array"),

  body("restrictions.newCustomersOnly")
    .optional()
    .isBoolean()
    .withMessage("New customers only must be a boolean"),

  body("restrictions.firstOrderOnly")
    .optional()
    .isBoolean()
    .withMessage("First order only must be a boolean"),

  body("startDate")
    .notEmpty()
    .withMessage("Start date is required")
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  body("endDate")
    .notEmpty()
    .withMessage("End date is required")
    .isISO8601()
    .withMessage("End date must be a valid date"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
];

const validateUpdateCoupon = [
  body("code")
    .optional()
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage("Coupon code must be between 3 and 20 characters")
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage("Coupon code can only contain letters, numbers, hyphens, and underscores"),

  body("name")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Coupon name cannot exceed 100 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("discountType")
    .optional()
    .isIn(["percentage", "fixed", "free_shipping"])
    .withMessage("Invalid discount type"),

  body("discountValue")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Discount value must be a positive number"),

  body("maxDiscountAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Max discount amount must be a positive number"),

  body("usageLimit.total")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Total usage limit must be at least 1"),

  body("usageLimit.perCustomer")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Per customer limit must be at least 1"),

  body("minimumPurchase")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Minimum purchase must be a positive number"),

  body("minimumItems")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Minimum items must be a non-negative integer"),

  body("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  body("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid date"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
];

const validateCouponId = [
  param("couponId")
    .notEmpty()
    .withMessage("Coupon ID is required")
    .isMongoId()
    .withMessage("Invalid coupon ID format"),
];

const validateBulkStatus = [
  body("couponIds")
    .isArray({ min: 1 })
    .withMessage("Coupon IDs must be a non-empty array"),

  body("couponIds.*")
    .isMongoId()
    .withMessage("Invalid coupon ID format"),

  body("isActive")
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

const validateValidateCoupon = [
  body("code")
    .trim()
    .notEmpty()
    .withMessage("Coupon code is required"),

  body("userId")
    .optional()
    .isMongoId()
    .withMessage("Invalid user ID format"),

  body("cartTotal")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Cart total must be a positive number"),

  body("cartItems")
    .optional()
    .isArray()
    .withMessage("Cart items must be an array"),
];

module.exports = {
  validateCreateCoupon,
  validateUpdateCoupon,
  validateCouponId,
  validateBulkStatus,
  validateValidateCoupon,
};
