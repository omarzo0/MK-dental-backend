const express = require("express");
const router = express.Router();
const {
  registerUser,
  loginUser,
  logoutUser,
  refreshToken,
  forgotPassword,
  resetPassword,
} = require("../../controllers/user/authController");

const {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
} = require("../../validations/user/authValidation");

const { userAuth } = require("../../middleware/userAuth");

// Public routes
router.post("/register", validateRegister, registerUser);
router.post("/login", validateLogin, loginUser);
router.post("/forgot-password", validateForgotPassword, forgotPassword);
router.post("/reset-password", validateResetPassword, resetPassword);

// Protected routes
router.post("/logout", userAuth, logoutUser);
router.post("/refresh", userAuth, refreshToken);

module.exports = router;
