// routes/user/paymentRoutes.js
const express = require("express");
const router = express.Router();
const { userAuth } = require("../../middleware/userAuth");

const {
  validateCreatePayment,
  validateProcessPayment,
  validatePaymentId,
  validatePaymentQuery,
  validatePaymentMethodCheck,
  validateOrderId,
} = require("../../validations/user/paymentValidation");

const {
  createPayment,
  processPayment,
  getPaymentById,
  getUserPayments,
  getAvailablePaymentMethods,
  validatePaymentMethod,
  getPaymentByOrder,
  retryPayment,
} = require("../../controllers/user/paymentController");

// Public route - get available payment methods
router.get("/methods", getAvailablePaymentMethods);

// User payment routes (require authentication)
router.post("/", userAuth, validateCreatePayment, createPayment);

// Validate payment method before order
router.post("/validate-method", userAuth, validatePaymentMethodCheck, validatePaymentMethod);

router.post(
  "/:paymentId/process",
  userAuth,
  validatePaymentId,
  validateProcessPayment,
  processPayment
);

// Retry failed payment
router.post("/:paymentId/retry", userAuth, validatePaymentId, retryPayment);

router.get("/", userAuth, validatePaymentQuery, getUserPayments);

// Get payment by order ID
router.get("/order/:orderId", userAuth, validateOrderId, getPaymentByOrder);

router.get("/:paymentId", userAuth, validatePaymentId, getPaymentById);

module.exports = router;
