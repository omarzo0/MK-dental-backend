const express = require("express");
const router = express.Router();

const {
    getAllProducts,
    getProductById,
} = require("../../controllers/shared/productController");

// @route   GET /api/user/packages
// @desc    Get all packages
// @access  Public
router.get("/", (req, res, next) => {
    req.query.productType = "package";
    next();
}, getAllProducts);

// @route   GET /api/user/packages/:productId
// @desc    Get package by ID
// @access  Public
router.get("/:productId", getProductById);

module.exports = router;
