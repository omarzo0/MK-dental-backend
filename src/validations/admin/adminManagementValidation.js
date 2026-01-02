// validations/admin/adminManagementValidation.js
const { body, param } = require("express-validator");

const validateAdminId = [
  param("adminId")
    .notEmpty()
    .withMessage("Admin ID is required")
    .isMongoId()
    .withMessage("Invalid admin ID format"),
];

const validateCreateAdmin = [
  body("username")
    .notEmpty()
    .withMessage("Username is required")
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores"),

  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),

  body("firstName")
    .notEmpty()
    .withMessage("First name is required")
    .trim()
    .isLength({ max: 50 })
    .withMessage("First name cannot exceed 50 characters"),

  body("lastName")
    .notEmpty()
    .withMessage("Last name is required")
    .trim()
    .isLength({ max: 50 })
    .withMessage("Last name cannot exceed 50 characters"),

  body("phone")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Phone cannot exceed 20 characters"),
];

const validateUpdateAdmin = [
  body("username")
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores"),

  body("email")
    .optional()
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail(),

  body("password")
    .optional()
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),

  body("firstName")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("First name cannot exceed 50 characters"),

  body("lastName")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Last name cannot exceed 50 characters"),

  body("phone")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Phone cannot exceed 20 characters"),
];

module.exports = {
  validateAdminId,
  validateCreateAdmin,
  validateUpdateAdmin,
};
