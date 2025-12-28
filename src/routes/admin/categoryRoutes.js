// routes/admin/categoryRoutes.js
const express = require("express");
const router = express.Router();
const { adminAuth, checkPermission } = require("../../middleware/adminAuth");
const {
  validateCreateCategory,
  validateUpdateCategory,
  validateCategoryId,
  validateReorderCategories,
} = require("../../validations/admin/categoryValidation");
const {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
  reorderCategories,
  getCategoryStatistics,
  updateAllStatistics,
} = require("../../controllers/admin/categoryController");

// All routes require admin authentication
router.use(adminAuth);

// Bulk operations
router.patch(
  "/reorder",
  checkPermission("canManageProducts"),
  validateReorderCategories,
  reorderCategories
);

// Update all statistics
router.post(
  "/update-statistics",
  checkPermission("canManageProducts"),
  updateAllStatistics
);

// CRUD operations
router.get("/", checkPermission("canViewAnalytics"), getAllCategories);
router.post(
  "/",
  checkPermission("canManageProducts"),
  validateCreateCategory,
  createCategory
);

// Single category operations
router.get(
  "/:categoryId",
  checkPermission("canViewAnalytics"),
  validateCategoryId,
  getCategoryById
);
router.put(
  "/:categoryId",
  checkPermission("canManageProducts"),
  validateCategoryId,
  validateUpdateCategory,
  updateCategory
);
router.delete(
  "/:categoryId",
  checkPermission("canManageProducts"),
  validateCategoryId,
  deleteCategory
);
router.patch(
  "/:categoryId/toggle-status",
  checkPermission("canManageProducts"),
  validateCategoryId,
  toggleCategoryStatus
);
router.get(
  "/:categoryId/statistics",
  checkPermission("canViewAnalytics"),
  validateCategoryId,
  getCategoryStatistics
);

module.exports = router;
