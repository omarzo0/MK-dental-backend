const Admin = require("../../models/Admin");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");

// @desc    Register a new admin (Super Admin only)
// @route   POST /api/admin/auth/register
// @access  Private (Super Admin)
const registerAdmin = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const {
      username,
      email,
      password,
      firstName,
      lastName,
      phone,
      permissions,
    } = req.body;

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({
      $or: [{ email }, { username }],
    });

    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: "Admin already exists with this email or username",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12); // Stronger salt for admin
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create admin
    const admin = new Admin({
      username,
      email,
      password: hashedPassword,
      profile: {
        firstName,
        lastName,
        phone,
      },
      permissions: permissions || {
        canManageUsers: false,
        canManageProducts: false,
        canManageOrders: false,
        canManageInventory: false,
        canViewAnalytics: false,
        canManagePayments: false,
      },
    });

    await admin.save();

    // Remove password from response
    const adminResponse = {
      _id: admin._id,
      username: admin.username,
      email: admin.email,
      profile: admin.profile,
      permissions: admin.permissions,
      role: admin.role,
      isActive: admin.isActive,
      createdAt: admin.createdAt,
    };

    res.status(201).json({
      success: true,
      message: "Admin registered successfully",
      data: {
        admin: adminResponse,
      },
    });
  } catch (error) {
    console.error("Admin register error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during admin registration",
      error: error.message,
    });
  }
};

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

module.exports = {
  registerAdmin,
  loginAdmin,
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
  logoutAdmin,
  refreshToken,
};
