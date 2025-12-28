// controllers/admin/settingsController.js
const Settings = require("../../models/Settings");
const Admin = require("../../models/Admin");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

// @desc    Get all settings
// @route   GET /api/admin/settings
// @access  Private (Admin)
const getAllSettings = async (req, res) => {
  try {
    const allSettings = await Settings.getAllSettings();

    res.json({
      success: true,
      data: { settings: allSettings },
    });
  } catch (error) {
    console.error("Get all settings error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching settings",
      error: error.message,
    });
  }
};

// @desc    Get settings by key
// @route   GET /api/admin/settings/:key
// @access  Private (Admin)
const getSettingsByKey = async (req, res) => {
  try {
    const { key } = req.params;
    const validKeys = [
      "store",
      "payment",
      "shipping",
      "email",
      "seo",
      "social",
      "appearance",
      "notification",
      "security",
    ];

    if (!validKeys.includes(key)) {
      return res.status(400).json({
        success: false,
        message: `Invalid settings key. Valid keys are: ${validKeys.join(", ")}`,
      });
    }

    const settings = await Settings.getByKey(key);

    res.json({
      success: true,
      data: {
        key,
        settings: settings[key] || {},
        updatedAt: settings.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get settings by key error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching settings",
      error: error.message,
    });
  }
};

// @desc    Update store settings
// @route   PUT /api/admin/settings/store
// @access  Private (Admin)
const updateStoreSettings = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const updateData = req.body;
    const settings = await Settings.updateByKey("store", updateData, req.admin.adminId);

    res.json({
      success: true,
      message: "Store settings updated successfully",
      data: { settings: settings.store },
    });
  } catch (error) {
    console.error("Update store settings error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating store settings",
      error: error.message,
    });
  }
};

// @desc    Update payment settings
// @route   PUT /api/admin/settings/payment
// @access  Private (Admin)
const updatePaymentSettings = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const updateData = req.body;
    const settings = await Settings.updateByKey("payment", updateData, req.admin.adminId);

    res.json({
      success: true,
      message: "Payment settings updated successfully",
      data: { settings: settings.payment },
    });
  } catch (error) {
    console.error("Update payment settings error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating payment settings",
      error: error.message,
    });
  }
};

// @desc    Update shipping settings
// @route   PUT /api/admin/settings/shipping
// @access  Private (Admin)
const updateShippingSettings = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const updateData = req.body;
    const settings = await Settings.updateByKey("shipping", updateData, req.admin.adminId);

    res.json({
      success: true,
      message: "Shipping settings updated successfully",
      data: { settings: settings.shipping },
    });
  } catch (error) {
    console.error("Update shipping settings error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating shipping settings",
      error: error.message,
    });
  }
};

// @desc    Update email settings
// @route   PUT /api/admin/settings/email
// @access  Private (Admin)
const updateEmailSettings = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const updateData = req.body;
    const settings = await Settings.updateByKey("email", updateData, req.admin.adminId);

    res.json({
      success: true,
      message: "Email settings updated successfully",
      data: { settings: settings.email },
    });
  } catch (error) {
    console.error("Update email settings error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating email settings",
      error: error.message,
    });
  }
};

// @desc    Update SEO settings
// @route   PUT /api/admin/settings/seo
// @access  Private (Admin)
const updateSeoSettings = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const updateData = req.body;
    const settings = await Settings.updateByKey("seo", updateData, req.admin.adminId);

    res.json({
      success: true,
      message: "SEO settings updated successfully",
      data: { settings: settings.seo },
    });
  } catch (error) {
    console.error("Update SEO settings error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating SEO settings",
      error: error.message,
    });
  }
};

// @desc    Update social settings
// @route   PUT /api/admin/settings/social
// @access  Private (Admin)
const updateSocialSettings = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const updateData = req.body;
    const settings = await Settings.updateByKey("social", updateData, req.admin.adminId);

    res.json({
      success: true,
      message: "Social settings updated successfully",
      data: { settings: settings.social },
    });
  } catch (error) {
    console.error("Update social settings error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating social settings",
      error: error.message,
    });
  }
};

// @desc    Update appearance settings
// @route   PUT /api/admin/settings/appearance
// @access  Private (Admin)
const updateAppearanceSettings = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const updateData = req.body;
    const settings = await Settings.updateByKey("appearance", updateData, req.admin.adminId);

    res.json({
      success: true,
      message: "Appearance settings updated successfully",
      data: { settings: settings.appearance },
    });
  } catch (error) {
    console.error("Update appearance settings error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating appearance settings",
      error: error.message,
    });
  }
};

// @desc    Update notification settings
// @route   PUT /api/admin/settings/notification
// @access  Private (Admin)
const updateNotificationSettings = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const updateData = req.body;
    const settings = await Settings.updateByKey("notification", updateData, req.admin.adminId);

    res.json({
      success: true,
      message: "Notification settings updated successfully",
      data: { settings: settings.notification },
    });
  } catch (error) {
    console.error("Update notification settings error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating notification settings",
      error: error.message,
    });
  }
};

// @desc    Update security settings
// @route   PUT /api/admin/settings/security
// @access  Private (Admin)
const updateSecuritySettings = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const updateData = req.body;
    const settings = await Settings.updateByKey("security", updateData, req.admin.adminId);

    res.json({
      success: true,
      message: "Security settings updated successfully",
      data: { settings: settings.security },
    });
  } catch (error) {
    console.error("Update security settings error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating security settings",
      error: error.message,
    });
  }
};

// @desc    Get all admin users
// @route   GET /api/admin/settings/admins
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
// @route   GET /api/admin/settings/admins/:adminId
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

// @desc    Update admin permissions
// @route   PUT /api/admin/settings/admins/:adminId/permissions
// @access  Private (Super Admin)
const updateAdminPermissions = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { permissions } = req.body;

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

    // Cannot modify super admin
    if (admin.role === "superadmin") {
      return res.status(400).json({
        success: false,
        message: "Cannot modify super admin permissions",
      });
    }

    admin.permissions = {
      ...admin.permissions,
      ...permissions,
    };
    await admin.save();

    res.json({
      success: true,
      message: "Admin permissions updated successfully",
      data: { admin },
    });
  } catch (error) {
    console.error("Update admin permissions error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating admin permissions",
      error: error.message,
    });
  }
};

// @desc    Toggle admin status (activate/deactivate)
// @route   PATCH /api/admin/settings/admins/:adminId/toggle-status
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
// @route   DELETE /api/admin/settings/admins/:adminId
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
};
