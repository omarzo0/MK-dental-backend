const express = require("express");
const router = express.Router();
const { userAuth } = require("../../middleware/userAuth");

const {
  getUserProfile,
  updateUserProfile,
  changePassword,
  updatePreferences,
  uploadAvatar,
  deleteAccount,
  getUserActivity,
  reactivateAccount,
} = require("../../controllers/user/profileController");

const {
  validateUpdateProfile,
  validateChangePassword,
  validatePreferences,
  validateDeleteAccount,
  validateReactivateAccount,
} = require("../../validations/user/profileValidation");

// Protected routes (require user authentication)
router.use(userAuth);

router.get("/", getUserProfile);
router.put("/", validateUpdateProfile, updateUserProfile);
router.put("/password", validateChangePassword, changePassword);
router.put("/preferences", validatePreferences, updatePreferences);
router.post("/avatar", uploadAvatar);
router.delete("/", validateDeleteAccount, deleteAccount);
router.get("/activity", getUserActivity);

// Public route (for account reactivation)
router.post("/reactivate", validateReactivateAccount, reactivateAccount);

module.exports = router;
