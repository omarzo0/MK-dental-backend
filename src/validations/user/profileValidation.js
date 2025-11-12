const { body, param } = require("express-validator");

const validateUpdateProfile = [
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
    .withMessage("Street address cannot exceed 255 characters")
    .trim(),

  body("address.city")
    .optional()
    .isLength({ max: 100 })
    .withMessage("City cannot exceed 100 characters")
    .trim(),

  body("address.state")
    .optional()
    .isLength({ max: 100 })
    .withMessage("State cannot exceed 100 characters")
    .trim(),

  body("address.zipCode")
    .optional()
    .isPostalCode("any")
    .withMessage("Please provide a valid zip code"),

  body("address.country")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Country cannot exceed 100 characters")
    .trim(),

  body("preferences.newsletter")
    .optional()
    .isBoolean()
    .withMessage("Newsletter preference must be a boolean"),

  body("preferences.notifications")
    .optional()
    .isBoolean()
    .withMessage("Notifications preference must be a boolean"),
];

const validateChangePassword = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),

  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one lowercase letter, one uppercase letter, and one number"
    ),

  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error("Passwords do not match");
    }
    return true;
  }),
];

const validatePreferences = [
  body("newsletter")
    .optional()
    .isBoolean()
    .withMessage("Newsletter preference must be a boolean"),

  body("notifications")
    .optional()
    .isBoolean()
    .withMessage("Notifications preference must be a boolean"),
];

const validateDeleteAccount = [
  body("confirm")
    .equals("DELETE MY ACCOUNT")
    .withMessage("Please type 'DELETE MY ACCOUNT' to confirm account deletion"),

  body("password")
    .notEmpty()
    .withMessage("Password is required to confirm account deletion"),
];

const validateReactivateAccount = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),

  body("token").notEmpty().withMessage("Reactivation token is required"),
];

module.exports = {
  validateUpdateProfile,
  validateChangePassword,
  validatePreferences,
  validateDeleteAccount,
  validateReactivateAccount,
};
