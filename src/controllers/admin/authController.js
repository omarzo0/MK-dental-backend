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
      { adminId: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "12h" } // Shorter expiry for admin
    );

    // Remove password from response
    const adminResponse = {
      _id: admin._id,
      username: admin.username,
      email: admin.email,
      profile: admin.profile,
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
      { adminId: admin._id, role: admin.role },
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

// @desc    Forgot password - send OTP email
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
        message: "If an account with that email exists, an OTP has been sent",
      });
    }

    // Check if admin is active
    if (!admin.isActive) {
      return res.json({
        success: true,
        message: "If an account with that email exists, an OTP has been sent",
      });
    }

    // Rate limiting: Check if reset was requested recently (2 min cooldown)
    if (admin.passwordReset?.lastRequestedAt) {
      const timeSinceLastRequest = Date.now() - new Date(admin.passwordReset.lastRequestedAt).getTime();
      const cooldownPeriod = 2 * 60 * 1000; // 2 minutes

      if (timeSinceLastRequest < cooldownPeriod) {
        const remainingTime = Math.ceil((cooldownPeriod - timeSinceLastRequest) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${remainingTime} seconds before requesting another OTP`,
        });
      }
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    // Save hashed OTP to admin with 10 minute expiry
    admin.passwordReset = {
      otp: hashedOtp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      lastRequestedAt: new Date(),
      attempts: 0,
    };
    await admin.save();

    // Send email with OTP
    const { sendAdminOtpEmail } = require("../../services/emailService");
    const adminName = admin.profile?.firstName || admin.username;
    const emailResult = await sendAdminOtpEmail(email, otp, adminName);

    if (!emailResult) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP email. Please try again later.",
      });
    }

    res.json({
      success: true,
      message: "If an account with that email exists, an OTP has been sent",
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

// @desc    Reset password with OTP
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

    const { email, otp, newPassword } = req.body;

    // Hash the provided OTP to compare with stored hash
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    // Find admin with email
    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or OTP",
      });
    }

    // Check if OTP matches and is not expired
    if (!admin.passwordReset?.otp || admin.passwordReset.otp !== hashedOtp) {
      // Increment attempts
      if (admin.passwordReset) {
        admin.passwordReset.attempts = (admin.passwordReset.attempts || 0) + 1;

        // Lock out after 5 failed attempts
        if (admin.passwordReset.attempts >= 5) {
          admin.passwordReset = {
            otp: undefined,
            expiresAt: undefined,
            lastRequestedAt: admin.passwordReset.lastRequestedAt,
            attempts: 0,
          };
          await admin.save();
          return res.status(400).json({
            success: false,
            message: "Too many failed attempts. Please request a new OTP.",
          });
        }
        await admin.save();
      }

      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // Check if OTP is expired
    if (new Date() > new Date(admin.passwordReset.expiresAt)) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    admin.password = await bcrypt.hash(newPassword, salt);

    // Clear reset OTP (single use)
    admin.passwordReset = {
      otp: undefined,
      expiresAt: undefined,
      lastRequestedAt: admin.passwordReset.lastRequestedAt,
      attempts: 0,
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
