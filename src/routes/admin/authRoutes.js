const express = require("express");
const router = express.Router();
const {
  adminAuth,
  requirePermission,
} = require("../../middleware/adminAuth");

const {
  registerAdmin,
  loginAdmin,
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
  logoutAdmin,
  refreshToken,
} = require("../../controllers/admin/authController");

const {
  validateAdminRegister,
  validateAdminLogin,
  validateAdminUpdateProfile,
  validateAdminChangePassword,
} = require("../../validations/admin/authValidation");

// Public routes
router.post("/login", validateAdminLogin, loginAdmin);

// Protected routes
router.post(
  "/register",
  adminAuth,
  requirePermission("canManageAdmins"),
  validateAdminRegister,
  registerAdmin
);
router.get("/profile", adminAuth, getAdminProfile);
router.put(
  "/profile",
  adminAuth,
  validateAdminUpdateProfile,
  updateAdminProfile
);
router.put(
  "/change-password",
  adminAuth,
  validateAdminChangePassword,
  changeAdminPassword
);
router.post("/logout", adminAuth, logoutAdmin);
router.post("/refresh", adminAuth, refreshToken);

module.exports = router;
