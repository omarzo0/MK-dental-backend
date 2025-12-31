const { body, param, query } = require("express-validator");

const validateGetShippingFees = [
    query("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Page must be a positive integer"),

    query("limit")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("Limit must be between 1 and 100"),

    query("isActive")
        .optional()
        .isBoolean()
        .withMessage("isActive must be a boolean"),

    query("search")
        .optional()
        .isLength({ max: 100 })
        .withMessage("Search query cannot exceed 100 characters"),
];

const validateShippingFeeId = [
    param("id").isMongoId().withMessage("Valid shipping fee ID is required"),
];

const validateCreateShippingFee = [
    body("name")
        .notEmpty()
        .withMessage("Name is required")
        .isLength({ min: 2, max: 100 })
        .withMessage("Name must be between 2 and 100 characters"),

    body("shippingFee")
        .notEmpty()
        .withMessage("Shipping fee is required")
        .isFloat({ min: 0 })
        .withMessage("Shipping fee must be a non-negative number"),

    body("freeShippingThreshold")
        .optional({ nullable: true })
        .isFloat({ min: 0 })
        .withMessage("Free shipping threshold must be a non-negative number"),

    body("isActive")
        .optional()
        .isBoolean()
        .withMessage("isActive must be a boolean"),
];

const validateUpdateShippingFee = [
    param("id").isMongoId().withMessage("Valid shipping fee ID is required"),

    body("name")
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage("Name must be between 2 and 100 characters"),

    body("shippingFee")
        .optional()
        .isFloat({ min: 0 })
        .withMessage("Shipping fee must be a non-negative number"),

    body("freeShippingThreshold")
        .optional({ nullable: true })
        .isFloat({ min: 0 })
        .withMessage("Free shipping threshold must be a non-negative number"),

    body("isActive")
        .optional()
        .isBoolean()
        .withMessage("isActive must be a boolean"),
];

module.exports = {
    validateGetShippingFees,
    validateShippingFeeId,
    validateCreateShippingFee,
    validateUpdateShippingFee,
};
