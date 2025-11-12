const express = require("express");
const router = express.Router();
const { userAuth } = require("../../middleware/userAuth");

const {
  validateAddToCart,
  validateUpdateCartItem,
  validateRemoveCartItem,
  validateApplyCoupon,
  validateShippingAddress,
  validateCartNotes,
} = require("../../validations/user/cartValidation");

const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  applyCoupon,
  removeCoupon,
  updateShippingAddress,
  updateCartNotes,
} = require("../../controllers/user/cartController");

// All routes require user authentication
router.use(userAuth);

// Cart management routes
router.get("/", getCart);
router.post("/items", validateAddToCart, addToCart);
router.put("/items/:itemId", validateUpdateCartItem, updateCartItem);
router.delete("/items/:itemId", validateRemoveCartItem, removeFromCart);
router.delete("/clear", clearCart);

// Coupon routes
router.post("/coupon", validateApplyCoupon, applyCoupon);
router.delete("/coupon", removeCoupon);

// Shipping and notes routes
router.put("/shipping", validateShippingAddress, updateShippingAddress);
router.put("/notes", validateCartNotes, updateCartNotes);

module.exports = router;
