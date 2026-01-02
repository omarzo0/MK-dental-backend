const Admin = require("../../models/Admin");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { validationResult } = require("express-validator");
const { sendAdminPasswordResetEmail } = require("../../services/emailService");

// @desc    Login admin
// @route   POST /api/admin/auth/login
// @access  Public
const loginAdmin = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    // Find admin by email
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if admin is active
    if (!admin.isActive) {
      return res.status(401).json({
        success: false,
        message: "Admin account is deactivated. Please contact super admin.",
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Generate JWT token
    const token = jwt.sign(
      { adminId: admin._id, role: "admin", permissions: admin.permissions },
      process.env.JWT_SECRET,
      { expiresIn: "12h" } // Shorter expiry for admin
    );

    // Remove password from response
    const adminResponse = {
      _id: admin._id,
      username: admin.username,
      email: admin.email,
      profile: admin.profile,
      permissions: admin.permissions,
      role: admin.role,
      lastLogin: admin.lastLogin,
    };

    res.json({
      success: true,
      message: "Admin login successful",
      data: {
        admin: adminResponse,
        token,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during admin login",
      error: error.message,
    });
  }
};

// @desc    Get admin profile
// @route   GET /api/admin/auth/profile
// @access  Private (Admin)
const getAdminProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.adminId).select("-password");

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    res.json({
      success: true,
      data: {
        admin,
      },
    });
  } catch (error) {
    console.error("Get admin profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching admin profile",
      error: error.message,
    });
  }
};

// @desc    Update admin profile
// @route   PUT /api/admin/auth/profile
// @access  Private (Admin)
const updateAdminProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { firstName, lastName, phone } = req.body;

    const admin = await Admin.findById(req.admin.adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Update profile fields
    if (firstName) admin.profile.firstName = firstName;
    if (lastName) admin.profile.lastName = lastName;
    if (phone) admin.profile.phone = phone;

    admin.updatedAt = new Date();
    await admin.save();

    // Remove password from response
    const adminResponse = {
      _id: admin._id,
      username: admin.username,
      email: admin.email,
      profile: admin.profile,
      permissions: admin.permissions,
      role: admin.role,
      updatedAt: admin.updatedAt,
    };

    res.json({
      success: true,
      message: "Admin profile updated successfully",
      data: {
        admin: adminResponse,
      },
    });
  } catch (error) {
    console.error("Update admin profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating admin profile",
      error: error.message,
    });
  }
};

// @desc    Change admin password
// @route   PUT /api/admin/auth/change-password
// @access  Private (Admin)
const changeAdminPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { currentPassword, newPassword } = req.body;

    const admin = await Admin.findById(req.admin.adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      admin.password
    );
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    admin.password = await bcrypt.hash(newPassword, salt);
    admin.updatedAt = new Date();

    await admin.save();

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change admin password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while changing password",
      error: error.message,
    });
  }
};

// @desc    Logout admin
// @route   POST /api/admin/auth/logout
// @access  Private (Admin)
const logoutAdmin = async (req, res) => {
  try {
    // In production, you might want to blacklist the token
    res.json({
      success: true,
      message: "Admin logged out successfully",
    });
  } catch (error) {
    console.error("Admin logout error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during logout",
      error: error.message,
    });
  }
};

// @desc    Refresh admin token
// @route   POST /api/admin/auth/refresh
// @access  Private (Admin)
const refreshToken = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Generate new token
    const token = jwt.sign(
      { adminId: admin._id, role: "admin", permissions: admin.permissions },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        token,
      },
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while refreshing token",
      error: error.message,
    });
  }
};

// @desc    Forgot password - send reset email
// @route   POST /api/admin/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { email } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin) {
      // Don't reveal if admin exists or not (security)
      return res.json({
        success: true,
        message: "If an account with that email exists, a reset link has been sent",
      });
    }

    // Check if admin is active
    if (!admin.isActive) {
      return res.json({
        success: true,
        message: "If an account with that email exists, a reset link has been sent",
      });
    }

    // Rate limiting: Check if reset was requested recently (5 min cooldown)
    if (admin.passwordReset?.lastRequestedAt) {
      const timeSinceLastRequest = Date.now() - new Date(admin.passwordReset.lastRequestedAt).getTime();
      const cooldownPeriod = 5 * 60 * 1000; // 5 minutes

      if (timeSinceLastRequest < cooldownPeriod) {
        const remainingTime = Math.ceil((cooldownPeriod - timeSinceLastRequest) / 1000 / 60);
        return res.status(429).json({
          success: false,
          message: `Please wait ${remainingTime} minute(s) before requesting another reset`,
        });
      }
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    // Save hashed token to admin
    admin.passwordReset = {
      token: hashedToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      lastRequestedAt: new Date(),
    };
    await admin.save();

    // Send email with reset link
    const adminName = admin.profile?.firstName || admin.username;
    const emailResult = await sendAdminPasswordResetEmail(email, resetToken, adminName);

    if (!emailResult) {
      return res.status(500).json({
        success: false,
        message: "Failed to send reset email. Please try again later.",
      });
    }

    res.json({
      success: true,
      message: "If an account with that email exists, a reset link has been sent",
    });
  } catch (error) {
    console.error("Admin forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during password reset request",
      error: error.message,
    });
  }
};

// @desc    Reset password with token
// @route   POST /api/admin/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { token, newPassword } = req.body;

    // Hash the provided token to compare with stored hash
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find admin with valid reset token
    const admin = await Admin.findOne({
      "passwordReset.token": hashedToken,
      "passwordReset.expiresAt": { $gt: new Date() },
    });

    if (!admin) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    admin.password = await bcrypt.hash(newPassword, salt);

    // Clear reset token (single use)
    admin.passwordReset = {
      token: undefined,
      expiresAt: undefined,
      lastRequestedAt: admin.passwordReset.lastRequestedAt,
    };
    admin.updatedAt = new Date();

    await admin.save();

    res.json({
      success: true,
      message: "Password reset successfully. You can now login with your new password.",
    });
  } catch (error) {
    console.error("Admin reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during password reset",
      error: error.message,
    });
  }
};

module.exports = {
  loginAdmin,
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
  logoutAdmin,
  refreshToken,
  forgotPassword,
  resetPassword,
};
