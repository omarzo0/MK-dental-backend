// validations/admin/categoryValidation.js
const { body, param } = require("express-validator");

const validateCreateCategory = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Category name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Category name must be between 2 and 100 characters"),

  body("slug")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Slug cannot exceed 100 characters")
    .matches(/^[a-z0-9-]+$/)
    .withMessage("Slug can only contain lowercase letters, numbers, and hyphens"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("parent")
    .optional()
    .isMongoId()
    .withMessage("Invalid parent category ID"),

  body("image.url")
    .optional()
    .isURL()
    .withMessage("Image URL must be a valid URL"),

  body("icon")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Icon cannot exceed 100 characters"),

  body("displayOrder")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Display order must be a non-negative integer"),

  body("showInMenu")
    .optional()
    .isBoolean()
    .withMessage("showInMenu must be a boolean"),

  body("showInHomepage")
    .optional()
    .isBoolean()
    .withMessage("showInHomepage must be a boolean"),

  body("seo.metaTitle")
    .optional()
    .trim()
    .isLength({ max: 70 })
    .withMessage("Meta title cannot exceed 70 characters"),

  body("seo.metaDescription")
    .optional()
    .trim()
    .isLength({ max: 160 })
    .withMessage("Meta description cannot exceed 160 characters"),

  body("seo.metaKeywords")
    .optional()
    .isArray()
    .withMessage("Meta keywords must be an array"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),

  body("attributes")
    .optional()
    .isArray()
    .withMessage("Attributes must be an array"),

  body("attributes.*.name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Attribute name is required"),

  body("attributes.*.type")
    .optional()
    .isIn(["text", "number", "select", "multiselect", "boolean"])
    .withMessage("Invalid attribute type"),

  body("attributes.*.options")
    .optional()
    .isArray()
    .withMessage("Attribute options must be an array"),

  body("attributes.*.required")
    .optional()
    .isBoolean()
    .withMessage("Attribute required must be a boolean"),

  body("attributes.*.filterable")
    .optional()
    .isBoolean()
    .withMessage("Attribute filterable must be a boolean"),
];

const validateUpdateCategory = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Category name must be between 2 and 100 characters"),

  body("slug")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Slug cannot exceed 100 characters")
    .matches(/^[a-z0-9-]+$/)
    .withMessage("Slug can only contain lowercase letters, numbers, and hyphens"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("parent")
    .optional()
    .custom((value) => {
      if (value === null || value === "null") return true;
      return /^[0-9a-fA-F]{24}$/.test(value);
    })
    .withMessage("Invalid parent category ID"),

  body("image.url")
    .optional()
    .isURL()
    .withMessage("Image URL must be a valid URL"),

  body("icon")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Icon cannot exceed 100 characters"),

  body("displayOrder")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Display order must be a non-negative integer"),

  body("showInMenu")
    .optional()
    .isBoolean()
    .withMessage("showInMenu must be a boolean"),

  body("showInHomepage")
    .optional()
    .isBoolean()
    .withMessage("showInHomepage must be a boolean"),

  body("seo.metaTitle")
    .optional()
    .trim()
    .isLength({ max: 70 })
    .withMessage("Meta title cannot exceed 70 characters"),

  body("seo.metaDescription")
    .optional()
    .trim()
    .isLength({ max: 160 })
    .withMessage("Meta description cannot exceed 160 characters"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

const validateCategoryId = [
  param("categoryId")
    .notEmpty()
    .withMessage("Category ID is required")
    .isMongoId()
    .withMessage("Invalid category ID format"),
];

const validateReorderCategories = [
  body("categories")
    .isArray({ min: 1 })
    .withMessage("Categories must be a non-empty array"),

  body("categories.*.categoryId")
    .isMongoId()
    .withMessage("Invalid category ID format"),

  body("categories.*.displayOrder")
    .isInt({ min: 0 })
    .withMessage("Display order must be a non-negative integer"),
];

module.exports = {
  validateCreateCategory,
  validateUpdateCategory,
  validateCategoryId,
  validateReorderCategories,
};
