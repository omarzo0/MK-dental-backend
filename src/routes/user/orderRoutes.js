const express = require("express");
const router = express.Router();
const { userAuth } = require("../../middleware/userAuth");

const {
  getUserOrders,
  getOrderById,
  createOrder,
  cancelOrder,
  trackOrder,
  requestReturn,
  reorder,
  createGuestOrder,
  trackGuestOrder,
  getOrderTimeline,
  downloadInvoice,
} = require("../../controllers/user/orderController");

const {
  validateCreateOrder,
  validateOrderId,
  validateCancelOrder,
  validateReturnRequest,
  validateOrderQuery,
  validateGuestOrder,
  validateGuestTracking,
} = require("../../validations/user/orderValidation");

// Public routes (no authentication required)
router.post("/", validateGuestOrder, createOrder);
router.get("/track/:orderNumber", validateGuestTracking, trackGuestOrder);

// Protected routes (require user authentication)
router.use(userAuth);

router.get("/", validateOrderQuery, getUserOrders);
router.get("/:orderId", validateOrderId, getOrderById);
router.put(
  "/:orderId/cancel",
  validateOrderId,
  validateCancelOrder,
  cancelOrder
);
router.get("/:orderId/track", validateOrderId, trackOrder);
router.get("/:orderId/timeline", validateOrderId, getOrderTimeline);
router.get("/:orderId/invoice", validateOrderId, downloadInvoice);
router.post(
  "/:orderId/return",
  validateOrderId,
  validateReturnRequest,
  requestReturn
);
router.post("/:orderId/reorder", validateOrderId, reorder);

module.exports = router;
