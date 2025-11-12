const User = require("../../models/User");
const Order = require("../../models/Order");
const { validationResult } = require("express-validator");

// @desc    Get user profile
// @route   GET /api/user/profile
// @access  Private (User)
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password -__v");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get user statistics
    const orderStats = await Order.aggregate([
      {
        $match: { userId: req.user.userId },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: "$totals.total" },
          completedOrders: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
          },
        },
      },
    ]);

    const stats = orderStats[0] || {
      totalOrders: 0,
      totalSpent: 0,
      completedOrders: 0,
    };

    res.json({
      success: true,
      data: {
        user: {
          ...user.toObject(),
          statistics: stats,
        },
      },
    });
  } catch (error) {
    console.error("Get user profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching profile",
      error: error.message,
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/user/profile
// @access  Private (User)
const updateUserProfile = async (req, res) => {
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
      firstName,
      lastName,
      phone,
      dateOfBirth,
      gender,
      street,
      city,
      state,
      zipCode,
      country,
      newsletter,
      notifications,
    } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update profile fields
    if (firstName) user.profile.firstName = firstName;
    if (lastName) user.profile.lastName = lastName;
    if (phone) user.profile.phone = phone;
    if (dateOfBirth) user.profile.dateOfBirth = new Date(dateOfBirth);
    if (gender) user.profile.gender = gender;

    // Update address
    if (street || city || state || zipCode || country) {
      user.address = {
        street: street || user.address?.street || "",
        city: city || user.address?.city || "",
        state: state || user.address?.state || "",
        zipCode: zipCode || user.address?.zipCode || "",
        country: country || user.address?.country || "USA",
      };
    }

    // Update preferences
    if (newsletter !== undefined) user.preferences.newsletter = newsletter;
    if (notifications !== undefined)
      user.preferences.notifications = notifications;

    user.updatedAt = new Date();
    await user.save();

    // Remove sensitive data from response
    const userResponse = {
      _id: user._id,
      username: user.username,
      email: user.email,
      profile: user.profile,
      address: user.address,
      preferences: user.preferences,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: userResponse,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating profile",
      error: error.message,
    });
  }
};

// @desc    Change user password
// @route   PUT /api/user/profile/password
// @access  Private (User)
const changePassword = async (req, res) => {
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

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Update password
    user.password = newPassword;
    user.updatedAt = new Date();

    await user.save();

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while changing password",
      error: error.message,
    });
  }
};

// @desc    Update user preferences
// @route   PUT /api/user/profile/preferences
// @access  Private (User)
const updatePreferences = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { newsletter, notifications, emailFrequency, theme } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update preferences
    if (newsletter !== undefined) user.preferences.newsletter = newsletter;
    if (notifications !== undefined)
      user.preferences.notifications = notifications;
    if (emailFrequency) user.preferences.emailFrequency = emailFrequency;
    if (theme) user.preferences.theme = theme;

    user.updatedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: "Preferences updated successfully",
      data: {
        preferences: user.preferences,
      },
    });
  } catch (error) {
    console.error("Update preferences error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating preferences",
      error: error.message,
    });
  }
};

// @desc    Upload profile picture
// @route   POST /api/user/profile/avatar
// @access  Private (User)
const uploadAvatar = async (req, res) => {
  try {
    // This would typically handle file upload via multer or cloud storage
    // For now, we'll accept a URL or base64 string
    const { avatarUrl } = req.body;

    if (!avatarUrl) {
      return res.status(400).json({
        success: false,
        message: "Avatar URL is required",
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update avatar
    user.profile.avatar = avatarUrl;
    user.updatedAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: "Profile picture updated successfully",
      data: {
        avatar: user.profile.avatar,
      },
    });
  } catch (error) {
    console.error("Upload avatar error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while uploading profile picture",
      error: error.message,
    });
  }
};

// @desc    Delete user account
// @route   DELETE /api/user/profile
// @access  Private (User)
const deleteAccount = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { password, reason } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Password is incorrect",
      });
    }

    // Soft delete - mark as inactive instead of actually deleting
    user.isActive = false;
    user.deactivatedAt = new Date();
    user.deactivationReason = reason || "User requested account deletion";
    await user.save();

    // TODO: In a real application, you might want to:
    // 1. Cancel any pending orders
    // 2. Anonymize personal data
    // 3. Send confirmation email
    // 4. Log out all active sessions

    res.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting account",
      error: error.message,
    });
  }
};

// @desc    Get user activity
// @route   GET /api/user/profile/activity
// @access  Private (User)
const getUserActivity = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    // Get recent orders
    const orders = await Order.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select("orderNumber status totals.total createdAt");

    // Get order statistics for activity summary
    const recentActivity = orders.map((order) => ({
      type: "order",
      description: `Order #${order.orderNumber} ${order.status}`,
      amount: order.totals.total,
      date: order.createdAt,
      orderId: order._id,
    }));

    // In a real app, you might also include:
    // - Reviews written
    // - Wishlist updates
    // - Password changes
    // - Profile updates

    res.json({
      success: true,
      data: {
        activities: recentActivity,
        pagination: {
          currentPage: parseInt(page),
          hasMore: orders.length === parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("Get user activity error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user activity",
      error: error.message,
    });
  }
};

// @desc    Reactivate user account
// @route   POST /api/user/profile/reactivate
// @access  Public
const reactivateAccount = async (req, res) => {
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

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal whether account exists
      return res.json({
        success: true,
        message:
          "If an account exists with this email, it has been reactivated",
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Don't reveal whether password is correct
      return res.json({
        success: true,
        message:
          "If an account exists with this email, it has been reactivated",
      });
    }

    // Reactivate account
    user.isActive = true;
    user.reactivatedAt = new Date();
    await user.save();

    // Generate new token
    const token = user.generateAuthToken();

    res.json({
      success: true,
      message: "Account reactivated successfully",
      data: {
        token,
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          profile: user.profile,
        },
      },
    });
  } catch (error) {
    console.error("Reactivate account error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while reactivating account",
      error: error.message,
    });
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  changePassword,
  updatePreferences,
  uploadAvatar,
  deleteAccount,
  getUserActivity,
  reactivateAccount,
};
