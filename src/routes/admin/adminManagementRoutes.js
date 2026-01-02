// routes/admin/adminManagementRoutes.js
const express = require("express");
const router = express.Router();
const { adminAuth, isSuperAdmin } = require("../../middleware/adminAuth");
const {
  validateAdminId,
  validateCreateAdmin,
  validateUpdateAdmin,
} = require("../../validations/admin/adminManagementValidation");
const {
  getAllAdmins,
  getAdminById,
  createAdmin,
  updateAdmin,
  toggleAdminStatus,
  deleteAdmin,
} = require("../../controllers/admin/adminManagementController");

// All routes require admin authentication
router.use(adminAuth);

// Admin users management (Super Admin only)
router.get("/", isSuperAdmin, getAllAdmins);
router.post("/", isSuperAdmin, validateCreateAdmin, createAdmin);
router.get("/:adminId", isSuperAdmin, validateAdminId, getAdminById);
router.put("/:adminId", isSuperAdmin, validateAdminId, validateUpdateAdmin, updateAdmin);
router.patch(
  "/:adminId/toggle-status",
  isSuperAdmin,
  validateAdminId,
  toggleAdminStatus
);
router.delete("/:adminId", isSuperAdmin, validateAdminId, deleteAdmin);

module.exports = router;
