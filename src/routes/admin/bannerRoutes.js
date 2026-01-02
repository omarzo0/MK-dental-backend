const express = require("express");
const router = express.Router();
const { adminAuth, requirePermission } = require("../../middleware/adminAuth");

const {
  validateBannerId,
  validateCreateBanner,
  validateUpdateBanner,
  validateBannerQuery,
  validateReorderBanners,
  validateBulkDelete,
  validateBulkUpdateStatus,
} = require("../../validations/admin/bannerValidation");

const {
  getAllBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleBannerStatus,
  reorderBanners,
  bulkDeleteBanners,
  bulkUpdateStatus,
} = require("../../controllers/admin/bannerController");

// All routes require admin authentication
router.use(adminAuth);

// Get all banners
router.get(
  "/",
  requirePermission("canManageProducts"),
  validateBannerQuery,
  getAllBanners
);

// Create banner
router.post(
  "/",
  requirePermission("canManageProducts"),
  validateCreateBanner,
  createBanner
);

// Reorder banners
router.put(
  "/reorder",
  requirePermission("canManageProducts"),
  validateReorderBanners,
  reorderBanners
);

// Bulk delete banners
router.delete(
  "/bulk",
  requirePermission("canManageProducts"),
  validateBulkDelete,
  bulkDeleteBanners
);

// Bulk update banner status
router.patch(
  "/bulk/status",
  requirePermission("canManageProducts"),
  validateBulkUpdateStatus,
  bulkUpdateStatus
);

// Get single banner
router.get(
  "/:bannerId",
  requirePermission("canManageProducts"),
  validateBannerId,
  getBannerById
);

// Update banner
router.put(
  "/:bannerId",
  requirePermission("canManageProducts"),
  validateUpdateBanner,
  updateBanner
);

// Delete banner
router.delete(
  "/:bannerId",
  requirePermission("canManageProducts"),
  validateBannerId,
  deleteBanner
);

// Toggle banner status
router.patch(
  "/:bannerId/toggle",
  requirePermission("canManageProducts"),
  validateBannerId,
  toggleBannerStatus
);

module.exports = router;
