// controllers/admin/adminManagementController.js
const Admin = require("../../models/Admin");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// @desc    Get all admin users
// @route   GET /api/admin/admin-management
// @access  Private (Super Admin)
const getAllAdmins = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      isActive,
      role,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build filter
    const filter = {};

    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { "profile.firstName": { $regex: search, $options: "i" } },
        { "profile.lastName": { $regex: search, $options: "i" } },
      ];
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    if (role) {
      filter.role = role;
    }

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "asc" ? 1 : -1;

    const admins = await Admin.find(filter)
      .select("-password")
      .sort(sortConfig)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const totalAdmins = await Admin.countDocuments(filter);

    res.json({
      success: true,
      data: {
        admins,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalAdmins / limit),
          totalAdmins,
          hasNext: page * limit < totalAdmins,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get all admins error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching admin users",
      error: error.message,
    });
  }
};

// @desc    Get admin user by ID
// @route   GET /api/admin/admin-management/:adminId
// @access  Private (Super Admin)
const getAdminById = async (req, res) => {
  try {
    const { adminId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(adminId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid admin ID",
      });
    }

    const admin = await Admin.findById(adminId).select("-password");

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    res.json({
      success: true,
      data: { admin },
    });
  } catch (error) {
    console.error("Get admin by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching admin",
      error: error.message,
    });
  }
};

// @desc    Create new admin
// @route   POST /api/admin/admin-management
// @access  Private (Super Admin)
const createAdmin = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { username, email, password, firstName, lastName, phone } = req.body;

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({
      $or: [{ email }, { username }],
    });

    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message:
          existingAdmin.email === email
            ? "Email already registered"
            : "Username already taken",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create admin
    const admin = new Admin({
      username,
      email,
      password: hashedPassword,
      role: "admin",
      profile: {
        firstName,
        lastName,
        phone,
      },
      isActive: true,
    });

    await admin.save();

    // Remove password from response
    const adminResponse = admin.toObject();
    delete adminResponse.password;

    res.status(201).json({
      success: true,
      message: "Admin created successfully",
      data: { admin: adminResponse },
    });
  } catch (error) {
    console.error("Create admin error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating admin",
      error: error.message,
    });
  }
};

// @desc    Update admin details
// @route   PUT /api/admin/admin-management/:adminId
// @access  Private (Super Admin)
const updateAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { username, email, firstName, lastName, phone, password } = req.body;

    if (!mongoose.Types.ObjectId.isValid(adminId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid admin ID",
      });
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Cannot modify super admin (except by themselves)
    if (admin.role === "superadmin" && admin._id.toString() !== req.admin.adminId.toString()) {
      return res.status(400).json({
        success: false,
        message: "Cannot modify super admin",
      });
    }

    // Check for duplicate email/username
    if (email && email !== admin.email) {
      const existingEmail = await Admin.findOne({ email, _id: { $ne: adminId } });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: "Email already registered",
        });
      }
      admin.email = email;
    }

    if (username && username !== admin.username) {
      const existingUsername = await Admin.findOne({ username, _id: { $ne: adminId } });
      if (existingUsername) {
        return res.status(400).json({
          success: false,
          message: "Username already taken",
        });
      }
      admin.username = username;
    }

    // Update profile
    if (firstName) admin.profile.firstName = firstName;
    if (lastName) admin.profile.lastName = lastName;
    if (phone !== undefined) admin.profile.phone = phone;

    // Update password if provided
    if (password) {
      const salt = await bcrypt.genSalt(10);
      admin.password = await bcrypt.hash(password, salt);
    }

    admin.updatedAt = new Date();
    await admin.save();

    // Remove password from response
    const adminResponse = admin.toObject();
    delete adminResponse.password;

    res.json({
      success: true,
      message: "Admin updated successfully",
      data: { admin: adminResponse },
    });
  } catch (error) {
    console.error("Update admin error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating admin",
      error: error.message,
    });
  }
};

// @desc    Toggle admin status (activate/deactivate)
// @route   PATCH /api/admin/admin-management/:adminId/toggle-status
// @access  Private (Super Admin)
const toggleAdminStatus = async (req, res) => {
  try {
    const { adminId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(adminId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid admin ID",
      });
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Cannot deactivate super admin
    if (admin.role === "superadmin") {
      return res.status(400).json({
        success: false,
        message: "Cannot deactivate super admin",
      });
    }

    // Cannot deactivate self
    if (admin._id.toString() === req.admin.adminId.toString()) {
      return res.status(400).json({
        success: false,
        message: "Cannot deactivate your own account",
      });
    }

    admin.isActive = !admin.isActive;
    await admin.save();

    res.json({
      success: true,
      message: `Admin ${admin.isActive ? "activated" : "deactivated"} successfully`,
      data: { admin },
    });
  } catch (error) {
    console.error("Toggle admin status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while toggling admin status",
      error: error.message,
    });
  }
};

// @desc    Delete admin user
// @route   DELETE /api/admin/admin-management/:adminId
// @access  Private (Super Admin)
const deleteAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(adminId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid admin ID",
      });
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Cannot delete super admin
    if (admin.role === "superadmin") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete super admin",
      });
    }

    // Cannot delete self
    if (admin._id.toString() === req.admin.adminId.toString()) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete your own account",
      });
    }

    await Admin.findByIdAndDelete(adminId);

    res.json({
      success: true,
      message: "Admin deleted successfully",
    });
  } catch (error) {
    console.error("Delete admin error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting admin",
      error: error.message,
    });
  }
};

module.exports = {
  getAllAdmins,
  getAdminById,
  createAdmin,
  updateAdmin,
  toggleAdminStatus,
  deleteAdmin,
};
