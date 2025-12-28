// routes/admin/couponRoutes.js
const express = require("express");
const router = express.Router();
const { adminAuth, checkPermission } = require("../../middleware/adminAuth");
const {
  validateCreateCoupon,
  validateUpdateCoupon,
  validateCouponId,
  validateBulkStatus,
  validateValidateCoupon,
} = require("../../validations/admin/couponValidation");
const {
  getAllCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus,
  generateCouponCode,
  getCouponAnalytics,
  bulkUpdateStatus,
  validateCoupon,
} = require("../../controllers/admin/couponController");

// All routes require admin authentication
router.use(adminAuth);

// Generate coupon code (no permission required)
router.get("/generate-code", generateCouponCode);

// Validate coupon
router.post("/validate", validateValidateCoupon, validateCoupon);

// Bulk operations
router.patch(
  "/bulk-status",
  checkPermission("canManageProducts"),
  validateBulkStatus,
  bulkUpdateStatus
);

// CRUD operations
router.get("/", checkPermission("canViewAnalytics"), getAllCoupons);
router.post(
  "/",
  checkPermission("canManageProducts"),
  validateCreateCoupon,
  createCoupon
);

// Single coupon operations
router.get(
  "/:couponId",
  checkPermission("canViewAnalytics"),
  validateCouponId,
  getCouponById
);
router.put(
  "/:couponId",
  checkPermission("canManageProducts"),
  validateCouponId,
  validateUpdateCoupon,
  updateCoupon
);
router.delete(
  "/:couponId",
  checkPermission("canManageProducts"),
  validateCouponId,
  deleteCoupon
);
router.patch(
  "/:couponId/toggle-status",
  checkPermission("canManageProducts"),
  validateCouponId,
  toggleCouponStatus
);
router.get(
  "/:couponId/analytics",
  checkPermission("canViewAnalytics"),
  validateCouponId,
  getCouponAnalytics
);

module.exports = router;
