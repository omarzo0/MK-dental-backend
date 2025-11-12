const { body, query, param } = require("express-validator");

const validateGetUsers = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("search")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Search query cannot exceed 100 characters"),

  query("status")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Invalid user status"),

  query("sortBy")
    .optional()
    .isIn(["createdAt", "updatedAt", "lastLogin", "username", "email"])
    .withMessage("Invalid sort field"),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be 'asc' or 'desc'"),
];

const validateUserId = [
  param("userId").isMongoId().withMessage("Valid user ID is required"),
];

const validateCreateUser = [
  body("username")
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores"),

  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),

  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one lowercase letter, one uppercase letter, and one number"
    ),

  body("profile.firstName")
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters")
    .trim(),

  body("profile.lastName")
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters")
    .trim(),

  body("profile.phone")
    .optional()
    .isMobilePhone()
    .withMessage("Please provide a valid phone number"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

const validateUpdateUser = [
  body("profile.firstName")
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters")
    .trim(),

  body("profile.lastName")
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters")
    .trim(),

  body("profile.phone")
    .optional()
    .isMobilePhone()
    .withMessage("Please provide a valid phone number"),

  body("profile.avatar")
    .optional()
    .isURL()
    .withMessage("Avatar must be a valid URL"),

  body("address.street")
    .optional()
    .isLength({ max: 255 })
    .withMessage("Street address cannot exceed 255 characters"),

  body("address.city")
    .optional()
    .isLength({ max: 100 })
    .withMessage("City cannot exceed 100 characters"),

  body("address.state")
    .optional()
    .isLength({ max: 100 })
    .withMessage("State cannot exceed 100 characters"),

  body("address.zipCode")
    .optional()
    .isPostalCode("any")
    .withMessage("Please provide a valid zip code"),

  body("address.country")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Country cannot exceed 100 characters"),

  body("preferences.newsletter")
    .optional()
    .isBoolean()
    .withMessage("Newsletter preference must be a boolean"),

  body("preferences.notifications")
    .optional()
    .isBoolean()
    .withMessage("Notifications preference must be a boolean"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

const validateDeleteUser = [
  body("reason")
    .optional()
    .isLength({ max: 255 })
    .withMessage("Delete reason cannot exceed 255 characters"),

  body("deleteOrders")
    .optional()
    .isBoolean()
    .withMessage("deleteOrders must be a boolean"),
];

const validateBulkOperations = [
  body("userIds")
    .isArray({ min: 1 })
    .withMessage("At least one user ID is required"),

  body("userIds.*").isMongoId().withMessage("Each user ID must be valid"),

  body("action")
    .isIn(["activate", "deactivate", "delete", "sendEmail"])
    .withMessage("Invalid bulk action"),

  body("data").optional().isObject().withMessage("Data must be an object"),
];

const validateUserSearch = [
  query("q")
    .notEmpty()
    .withMessage("Search query is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Search query must be between 2 and 100 characters"),

  query("field")
    .optional()
    .isIn(["username", "email", "name", "phone"])
    .withMessage("Search field must be username, email, name, or phone"),
];

module.exports = {
  validateGetUsers,
  validateUserId,
  validateCreateUser,
  validateUpdateUser,
  validateDeleteUser,
  validateBulkOperations,
  validateUserSearch,
};
