const { body } = require("express-validator");

const validateAdminRegister = [
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
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage(
      "Password must contain at least one lowercase, one uppercase, one number and one special character"
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

  body("permissions")
    .optional()
    .isObject()
    .withMessage("Permissions must be an object"),
];

const validateAdminLogin = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),

  body("password").notEmpty().withMessage("Password is required"),
];

const validateAdminUpdateProfile = [
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
];

const validateAdminChangePassword = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),

  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage(
      "Password must contain at least one lowercase, one uppercase, one number and one special character"
    ),

  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error("Passwords do not match");
    }
    return true;
  }),
];

const validateAdminForgotPassword = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
];

const validateAdminResetPassword = [
  body("token")
    .notEmpty()
    .withMessage("Reset token is required")
    .isLength({ min: 64, max: 64 })
    .withMessage("Invalid reset token format"),

  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage(
      "Password must contain at least one lowercase, one uppercase, one number and one special character"
    ),

  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error("Passwords do not match");
    }
    return true;
  }),
];

module.exports = {
  validateAdminRegister,
  validateAdminLogin,
  validateAdminUpdateProfile,
  validateAdminChangePassword,
  validateAdminForgotPassword,
  validateAdminResetPassword,
};
