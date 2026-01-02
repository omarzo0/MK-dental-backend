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

    body("fee")
        .notEmpty()
        .withMessage("Shipping fee is required")
        .isFloat({ min: 0 })
        .withMessage("Shipping fee must be a non-negative number"),

    body("isFreeShipping")
        .optional()
        .isBoolean()
        .withMessage("isFreeShipping must be a boolean"),

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

    body("fee")
        .optional()
        .isFloat({ min: 0 })
        .withMessage("Shipping fee must be a non-negative number"),

    body("isFreeShipping")
        .optional()
        .isBoolean()
        .withMessage("isFreeShipping must be a boolean"),

    body("isActive")
        .optional()
        .isBoolean()
        .withMessage("isActive must be a boolean"),
];

const validateShippingSettings = [
    body("defaultMethod")
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage("Default method cannot exceed 50 characters"),

    body("freeShippingThreshold")
        .optional()
        .isFloat({ min: 0 })
        .withMessage("Free shipping threshold must be a positive number"),

    body("weightUnit")
        .optional()
        .isIn(["kg", "lb"])
        .withMessage("Weight unit must be kg or lb"),

    body("dimensionUnit")
        .optional()
        .isIn(["cm", "in"])
        .withMessage("Dimension unit must be cm or in"),

    body("enableShippingCalculator")
        .optional()
        .isBoolean()
        .withMessage("Enable shipping calculator must be a boolean"),

    body("handlingTime.min")
        .optional()
        .isInt({ min: 0 })
        .withMessage("Minimum handling time must be a non-negative integer"),

    body("handlingTime.max")
        .optional()
        .isInt({ min: 0 })
        .withMessage("Maximum handling time must be a non-negative integer"),

    body("handlingTime.unit")
        .optional()
        .isIn(["days", "hours"])
        .withMessage("Handling time unit must be days or hours"),
];

module.exports = {
    validateGetShippingFees,
    validateShippingFeeId,
    validateCreateShippingFee,
    validateUpdateShippingFee,
    validateShippingSettings,
};
