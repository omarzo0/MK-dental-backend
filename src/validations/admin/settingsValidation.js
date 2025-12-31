// validations/admin/settingsValidation.js
const { body, param } = require("express-validator");

const validateStoreSettings = [
  body("name")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Store name cannot exceed 100 characters"),

  body("tagline")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Tagline cannot exceed 200 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("contact.email")
    .optional()
    .isEmail()
    .withMessage("Contact email must be a valid email"),

  body("contact.phone")
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage("Phone cannot exceed 20 characters"),

  body("address.country")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Country cannot exceed 100 characters"),

  body("currency.code")
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage("Currency code must be 3 characters"),

  body("timezone")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Timezone cannot exceed 50 characters"),
];

const validatePaymentSettings = [
  body("methods")
    .optional()
    .isArray()
    .withMessage("Methods must be an array"),

  body("methods.*.name")
    .optional()
    .isIn(["stripe", "paypal", "cash_on_delivery", "bank_transfer", "credit_card"])
    .withMessage("Invalid payment method"),

  body("methods.*.enabled")
    .optional()
    .isBoolean()
    .withMessage("Enabled must be a boolean"),

  body("methods.*.testMode")
    .optional()
    .isBoolean()
    .withMessage("Test mode must be a boolean"),

  body("minimumOrderAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Minimum order amount must be a positive number"),

  body("taxSettings.enabled")
    .optional()
    .isBoolean()
    .withMessage("Tax enabled must be a boolean"),

  body("taxSettings.taxRate")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Tax rate must be between 0 and 100"),
];




const validateSocialSettings = [
  body("links.facebook")
    .optional()
    .isURL()
    .withMessage("Facebook link must be a valid URL"),

  body("links.instagram")
    .optional()
    .isURL()
    .withMessage("Instagram link must be a valid URL"),

  body("links.twitter")
    .optional()
    .isURL()
    .withMessage("Twitter link must be a valid URL"),

  body("links.linkedin")
    .optional()
    .isURL()
    .withMessage("LinkedIn link must be a valid URL"),

  body("links.youtube")
    .optional()
    .isURL()
    .withMessage("YouTube link must be a valid URL"),

  body("sharing.enabled")
    .optional()
    .isBoolean()
    .withMessage("Sharing enabled must be a boolean"),

  body("sharing.platforms")
    .optional()
    .isArray()
    .withMessage("Sharing platforms must be an array"),
];

const validateAppearanceSettings = [
  body("theme.primaryColor")
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage("Primary color must be a valid hex color"),

  body("theme.secondaryColor")
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage("Secondary color must be a valid hex color"),

  body("theme.accentColor")
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage("Accent color must be a valid hex color"),

  body("homepage.heroEnabled")
    .optional()
    .isBoolean()
    .withMessage("Hero enabled must be a boolean"),

  body("homepage.featuredProductsCount")
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage("Featured products count must be between 0 and 50"),

  body("catalog.defaultView")
    .optional()
    .isIn(["grid", "list"])
    .withMessage("Default view must be grid or list"),

  body("catalog.productsPerPage")
    .optional()
    .isInt({ min: 5, max: 100 })
    .withMessage("Products per page must be between 5 and 100"),
];


const validateSecuritySettings = [
  body("passwordMinLength")
    .optional()
    .isInt({ min: 6, max: 30 })
    .withMessage("Password minimum length must be between 6 and 30"),

  body("requireStrongPassword")
    .optional()
    .isBoolean()
    .withMessage("Require strong password must be a boolean"),

  body("sessionTimeout")
    .optional()
    .isInt({ min: 5, max: 1440 })
    .withMessage("Session timeout must be between 5 and 1440 minutes"),

  body("maxLoginAttempts")
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage("Max login attempts must be between 1 and 20"),

  body("lockoutDuration")
    .optional()
    .isInt({ min: 1, max: 1440 })
    .withMessage("Lockout duration must be between 1 and 1440 minutes"),

  body("twoFactorAuth")
    .optional()
    .isBoolean()
    .withMessage("Two-factor auth must be a boolean"),

  body("recaptcha.enabled")
    .optional()
    .isBoolean()
    .withMessage("Recaptcha enabled must be a boolean"),
];

const validateAdminId = [
  param("adminId")
    .notEmpty()
    .withMessage("Admin ID is required")
    .isMongoId()
    .withMessage("Invalid admin ID format"),
];

const validateAdminPermissions = [
  body("permissions")
    .notEmpty()
    .withMessage("Permissions are required")
    .isObject()
    .withMessage("Permissions must be an object"),

  body("permissions.canManageUsers")
    .optional()
    .isBoolean()
    .withMessage("canManageUsers must be a boolean"),

  body("permissions.canManageProducts")
    .optional()
    .isBoolean()
    .withMessage("canManageProducts must be a boolean"),

  body("permissions.canManageOrders")
    .optional()
    .isBoolean()
    .withMessage("canManageOrders must be a boolean"),

  body("permissions.canManageInventory")
    .optional()
    .isBoolean()
    .withMessage("canManageInventory must be a boolean"),

  body("permissions.canViewAnalytics")
    .optional()
    .isBoolean()
    .withMessage("canViewAnalytics must be a boolean"),

  body("permissions.canManagePayments")
    .optional()
    .isBoolean()
    .withMessage("canManagePayments must be a boolean"),
];

module.exports = {
  validateStoreSettings,
  validatePaymentSettings,
  validateSocialSettings,
  validateAppearanceSettings,
  validateSecuritySettings,
  validateAdminId,
  validateAdminPermissions,
};
