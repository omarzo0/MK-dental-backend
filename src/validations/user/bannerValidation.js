const { param, query } = require("express-validator");
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

// Validate banner query parameters
const validateBannerQuery = [
  query("position")
    .optional()
    .isIn(["hero", "secondary", "promotional"])
    .withMessage("Position must be hero, secondary, or promotional"),
  handleValidationErrors,
];

module.exports = {
  validateBannerId,
  validateBannerQuery,
};
