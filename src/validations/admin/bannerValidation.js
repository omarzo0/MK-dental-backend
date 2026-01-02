const { body, param, query } = require("express-validator");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

// Validation error handler middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }
  next();
};

// Validate banner ID parameter
const validateBannerId = [
  param("bannerId")
    .notEmpty()
    .withMessage("Banner ID is required")
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid banner ID format");
      }
      return true;
    }),
  handleValidationErrors,
];

// Validate create banner
const validateCreateBanner = [
  body("title")
    .notEmpty()
    .withMessage("Banner title is required")
    .isLength({ max: 100 })
    .withMessage("Title cannot exceed 100 characters")
    .trim(),
  body("subtitle")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Subtitle cannot exceed 200 characters")
    .trim(),
  body("image")
    .notEmpty()
    .withMessage("Banner image is required")
    .isString()
    .withMessage("Image must be a string URL"),
  body("mobileImage")
    .optional()
    .isString()
    .withMessage("Mobile image must be a string URL"),
  body("link")
    .optional()
    .isString()
    .withMessage("Link must be a string")
    .trim(),
  body("linkType")
    .optional()
    .isIn(["product", "category", "external", "none"])
    .withMessage("Link type must be product, category, external, or none"),
  body("linkTarget")
    .optional()
    .isString()
    .withMessage("Link target must be a string"),
  body("buttonText")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Button text cannot exceed 50 characters")
    .trim(),
  body("position")
    .optional()
    .isIn(["hero", "secondary", "promotional"])
    .withMessage("Position must be hero, secondary, or promotional"),
  body("order")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Order must be a non-negative integer"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
  body("startDate")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("Start date must be a valid date"),
  body("endDate")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("End date must be a valid date")
    .custom((value, { req }) => {
      if (value && req.body.startDate && new Date(value) < new Date(req.body.startDate)) {
        throw new Error("End date must be after start date");
      }
      return true;
    }),
  body("backgroundColor")
    .optional()
    .isString()
    .withMessage("Background color must be a string"),
  body("textColor")
    .optional()
    .isString()
    .withMessage("Text color must be a string"),
  handleValidationErrors,
];

// Validate update banner
const validateUpdateBanner = [
  param("bannerId")
    .notEmpty()
    .withMessage("Banner ID is required")
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid banner ID format");
      }
      return true;
    }),
  body("title")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Title cannot exceed 100 characters")
    .trim(),
  body("subtitle")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Subtitle cannot exceed 200 characters")
    .trim(),
  body("image")
    .optional()
    .isString()
    .withMessage("Image must be a string URL"),
  body("mobileImage")
    .optional()
    .isString()
    .withMessage("Mobile image must be a string URL"),
  body("link")
    .optional()
    .isString()
    .withMessage("Link must be a string")
    .trim(),
  body("linkType")
    .optional()
    .isIn(["product", "category", "external", "none"])
    .withMessage("Link type must be product, category, external, or none"),
  body("linkTarget")
    .optional()
    .isString()
    .withMessage("Link target must be a string"),
  body("buttonText")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Button text cannot exceed 50 characters")
    .trim(),
  body("position")
    .optional()
    .isIn(["hero", "secondary", "promotional"])
    .withMessage("Position must be hero, secondary, or promotional"),
  body("order")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Order must be a non-negative integer"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
  body("startDate")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("Start date must be a valid date"),
  body("endDate")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("End date must be a valid date"),
  body("backgroundColor")
    .optional()
    .isString()
    .withMessage("Background color must be a string"),
  body("textColor")
    .optional()
    .isString()
    .withMessage("Text color must be a string"),
  handleValidationErrors,
];

// Validate banner query parameters
const validateBannerQuery = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("position")
    .optional()
    .isIn(["hero", "secondary", "promotional"])
    .withMessage("Position must be hero, secondary, or promotional"),
  query("isActive")
    .optional()
    .isIn(["true", "false"])
    .withMessage("isActive must be true or false"),
  query("sortBy")
    .optional()
    .isIn(["order", "createdAt", "title", "position"])
    .withMessage("sortBy must be order, createdAt, title, or position"),
  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("sortOrder must be asc or desc"),
  handleValidationErrors,
];

// Validate reorder banners
const validateReorderBanners = [
  body("banners")
    .isArray({ min: 1 })
    .withMessage("Banners must be a non-empty array"),
  body("banners.*.bannerId")
    .notEmpty()
    .withMessage("Each banner must have a bannerId")
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid banner ID format");
      }
      return true;
    }),
  body("banners.*.order")
    .isInt({ min: 0 })
    .withMessage("Each banner must have a valid order number"),
  handleValidationErrors,
];

// Validate bulk delete
const validateBulkDelete = [
  body("bannerIds")
    .isArray({ min: 1 })
    .withMessage("Banner IDs must be a non-empty array"),
  body("bannerIds.*")
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid banner ID format");
      }
      return true;
    }),
  handleValidationErrors,
];

// Validate bulk update status
const validateBulkUpdateStatus = [
  body("bannerIds")
    .isArray({ min: 1 })
    .withMessage("Banner IDs must be a non-empty array"),
  body("bannerIds.*")
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid banner ID format");
      }
      return true;
    }),
  body("isActive")
    .isBoolean()
    .withMessage("isActive must be a boolean"),
  handleValidationErrors,
];

module.exports = {
  validateBannerId,
  validateCreateBanner,
  validateUpdateBanner,
  validateBannerQuery,
  validateReorderBanners,
  validateBulkDelete,
  validateBulkUpdateStatus,
};
