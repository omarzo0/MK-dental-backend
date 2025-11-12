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
} = require("../../controllers/user/orderController");

const {
  validateCreateOrder,
  validateOrderId,
  validateCancelOrder,
  validateReturnRequest,
  validateOrderQuery,
} = require("../../validations/user/orderValidation");

// All routes require user authentication
router.use(userAuth);

router.get("/", validateOrderQuery, getUserOrders);
router.get("/:orderId", validateOrderId, getOrderById);
router.post("/", validateCreateOrder, createOrder);
router.put(
  "/:orderId/cancel",
  validateOrderId,
  validateCancelOrder,
  cancelOrder
);
router.get("/:orderId/track", validateOrderId, trackOrder);
router.post(
  "/:orderId/return",
  validateOrderId,
  validateReturnRequest,
  requestReturn
);
router.post("/:orderId/reorder", validateOrderId, reorder);

module.exports = router;
