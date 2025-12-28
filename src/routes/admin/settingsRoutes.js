// routes/admin/settingsRoutes.js
const express = require("express");
const router = express.Router();
const { adminAuth, checkPermission, isSuperAdmin } = require("../../middleware/adminAuth");
const {
  validateStoreSettings,
  validatePaymentSettings,
  validateShippingSettings,
  validateEmailSettings,
  validateSeoSettings,
  validateSocialSettings,
  validateAppearanceSettings,
  validateNotificationSettings,
  validateSecuritySettings,
  validateAdminId,
  validateAdminPermissions,
} = require("../../validations/admin/settingsValidation");
const {
  getAllSettings,
  getSettingsByKey,
  updateStoreSettings,
  updatePaymentSettings,
  updateShippingSettings,
  updateEmailSettings,
  updateSeoSettings,
  updateSocialSettings,
  updateAppearanceSettings,
  updateNotificationSettings,
  updateSecuritySettings,
  getAllAdmins,
  getAdminById,
  updateAdminPermissions,
  toggleAdminStatus,
  deleteAdmin,
} = require("../../controllers/admin/settingsController");

// All routes require admin authentication
router.use(adminAuth);

// Settings routes
router.get("/", getAllSettings);
router.get("/:key", getSettingsByKey);

// Update specific settings
router.put("/store", validateStoreSettings, updateStoreSettings);
router.put("/payment", validatePaymentSettings, updatePaymentSettings);
router.put("/shipping", validateShippingSettings, updateShippingSettings);
router.put("/email", validateEmailSettings, updateEmailSettings);
router.put("/seo", validateSeoSettings, updateSeoSettings);
router.put("/social", validateSocialSettings, updateSocialSettings);
router.put("/appearance", validateAppearanceSettings, updateAppearanceSettings);
router.put("/notification", validateNotificationSettings, updateNotificationSettings);
router.put("/security", isSuperAdmin, validateSecuritySettings, updateSecuritySettings);

// Admin users management (Super Admin only)
router.get("/admins", isSuperAdmin, getAllAdmins);
router.get("/admins/:adminId", isSuperAdmin, validateAdminId, getAdminById);
router.put(
  "/admins/:adminId/permissions",
  isSuperAdmin,
  validateAdminId,
  validateAdminPermissions,
  updateAdminPermissions
);
router.patch(
  "/admins/:adminId/toggle-status",
  isSuperAdmin,
  validateAdminId,
  toggleAdminStatus
);
router.delete("/admins/:adminId", isSuperAdmin, validateAdminId, deleteAdmin);

module.exports = router;
