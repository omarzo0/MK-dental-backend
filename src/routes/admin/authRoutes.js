const express = require("express");
const router = express.Router();
const {
  adminAuth,
  requirePermission,
} = require("../../middleware/adminAuth");

const {
  loginAdmin,
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
  logoutAdmin,
  refreshToken,
  forgotPassword,
  resetPassword,
} = require("../../controllers/admin/authController");

const {
  validateAdminLogin,
  validateAdminUpdateProfile,
  validateAdminChangePassword,
  validateAdminForgotPassword,
  validateAdminResetPassword,
} = require("../../validations/admin/authValidation");

// Public routes
router.post("/login", validateAdminLogin, loginAdmin);
router.post("/forgot-password", validateAdminForgotPassword, forgotPassword);
router.post("/reset-password", validateAdminResetPassword, resetPassword);

// Protected routes
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
