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

// ==================== ADDRESS BOOK MANAGEMENT ====================

// @desc    Get all addresses
// @route   GET /api/user/profile/addresses
// @access  Private (User)
const getAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("addresses");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: {
        addresses: user.addresses || [],
        defaultShipping: user.addresses?.find(a => a.isDefaultShipping)?._id,
        defaultBilling: user.addresses?.find(a => a.isDefaultBilling)?._id,
      },
    });
  } catch (error) {
    console.error("Get addresses error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching addresses",
      error: error.message,
    });
  }
};

// @desc    Add new address
// @route   POST /api/user/profile/addresses
// @access  Private (User)
const addAddress = async (req, res) => {
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
      label,
      fullName,
      phone,
      street,
      apartment,
      city,
      state,
      zipCode,
      country,
      isDefaultShipping,
      isDefaultBilling,
    } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // If setting as default, unset other defaults
    if (isDefaultShipping) {
      user.addresses.forEach(addr => addr.isDefaultShipping = false);
    }
    if (isDefaultBilling) {
      user.addresses.forEach(addr => addr.isDefaultBilling = false);
    }

    // If this is the first address, make it default
    const isFirst = user.addresses.length === 0;

    const newAddress = {
      label: label || "Home",
      fullName,
      phone,
      street,
      apartment,
      city,
      state,
      zipCode,
      country: country || "USA",
      isDefaultShipping: isFirst || isDefaultShipping || false,
      isDefaultBilling: isFirst || isDefaultBilling || false,
    };

    user.addresses.push(newAddress);
    await user.save();

    const addedAddress = user.addresses[user.addresses.length - 1];

    res.status(201).json({
      success: true,
      message: "Address added successfully",
      data: {
        address: addedAddress,
      },
    });
  } catch (error) {
    console.error("Add address error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while adding address",
      error: error.message,
    });
  }
};

// @desc    Update address
// @route   PUT /api/user/profile/addresses/:addressId
// @access  Private (User)
const updateAddress = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { addressId } = req.params;
    const updates = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // If setting as default, unset other defaults
    if (updates.isDefaultShipping) {
      user.addresses.forEach(addr => addr.isDefaultShipping = false);
    }
    if (updates.isDefaultBilling) {
      user.addresses.forEach(addr => addr.isDefaultBilling = false);
    }

    // Update fields
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        address[key] = updates[key];
      }
    });

    await user.save();

    res.json({
      success: true,
      message: "Address updated successfully",
      data: {
        address,
      },
    });
  } catch (error) {
    console.error("Update address error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating address",
      error: error.message,
    });
  }
};

// @desc    Delete address
// @route   DELETE /api/user/profile/addresses/:addressId
// @access  Private (User)
const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    const wasDefaultShipping = address.isDefaultShipping;
    const wasDefaultBilling = address.isDefaultBilling;

    address.deleteOne();

    // If deleted address was default, set first remaining as default
    if (user.addresses.length > 0) {
      if (wasDefaultShipping && !user.addresses.some(a => a.isDefaultShipping)) {
        user.addresses[0].isDefaultShipping = true;
      }
      if (wasDefaultBilling && !user.addresses.some(a => a.isDefaultBilling)) {
        user.addresses[0].isDefaultBilling = true;
      }
    }

    await user.save();

    res.json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (error) {
    console.error("Delete address error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting address",
      error: error.message,
    });
  }
};

// @desc    Set default address
// @route   PUT /api/user/profile/addresses/:addressId/default
// @access  Private (User)
const setDefaultAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const { type } = req.body; // 'shipping', 'billing', or 'both'

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // Unset previous defaults and set new one
    if (type === "shipping" || type === "both") {
      user.addresses.forEach(addr => addr.isDefaultShipping = false);
      address.isDefaultShipping = true;
    }
    if (type === "billing" || type === "both") {
      user.addresses.forEach(addr => addr.isDefaultBilling = false);
      address.isDefaultBilling = true;
    }

    await user.save();

    res.json({
      success: true,
      message: `Address set as default ${type} address`,
      data: {
        address,
      },
    });
  } catch (error) {
    console.error("Set default address error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while setting default address",
      error: error.message,
    });
  }
};

// ==================== RECENTLY VIEWED PRODUCTS ====================

// @desc    Get recently viewed products
// @route   GET /api/user/profile/recently-viewed
// @access  Private (User)
const getRecentlyViewed = async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const Product = require("../../models/Product");

    const user = await User.findById(req.user.userId)
      .select("recentlyViewed")
      .populate({
        path: "recentlyViewed.productId",
        select: "name price images category status inventory",
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Filter out deleted/inactive products and limit
    const recentlyViewed = user.recentlyViewed
      .filter(item => item.productId && item.productId.status === "active")
      .slice(0, parseInt(limit))
      .map(item => ({
        product: item.productId,
        viewedAt: item.viewedAt,
      }));

    res.json({
      success: true,
      data: {
        recentlyViewed,
        count: recentlyViewed.length,
      },
    });
  } catch (error) {
    console.error("Get recently viewed error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching recently viewed",
      error: error.message,
    });
  }
};

// @desc    Clear recently viewed history
// @route   DELETE /api/user/profile/recently-viewed
// @access  Private (User)
const clearRecentlyViewed = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.recentlyViewed = [];
    await user.save();

    res.json({
      success: true,
      message: "Recently viewed history cleared",
    });
  } catch (error) {
    console.error("Clear recently viewed error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while clearing recently viewed",
      error: error.message,
    });
  }
};

// ==================== COMPARE PRODUCTS ====================

// @desc    Get compare list
// @route   GET /api/user/profile/compare
// @access  Private (User)
const getCompareList = async (req, res) => {
  try {
    const Product = require("../../models/Product");

    const user = await User.findById(req.user.userId)
      .select("compareList")
      .populate({
        path: "compareList",
        select: "name price images category specifications attributes inventory ratings productType",
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Filter out deleted products
    const compareList = user.compareList.filter(product => product);

    // Get common attributes for comparison
    const comparisonData = {
      products: compareList,
      count: compareList.length,
      maxProducts: 4,
      canAddMore: compareList.length < 4,
    };

    // Extract all unique specification keys for comparison table
    if (compareList.length > 0) {
      const allSpecKeys = new Set();
      compareList.forEach(product => {
        if (product.specifications) {
          Object.keys(product.specifications).forEach(key => allSpecKeys.add(key));
        }
      });
      comparisonData.specificationKeys = Array.from(allSpecKeys);
    }

    res.json({
      success: true,
      data: comparisonData,
    });
  } catch (error) {
    console.error("Get compare list error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching compare list",
      error: error.message,
    });
  }
};

// @desc    Add/Remove product from compare list
// @route   POST /api/user/profile/compare/:productId
// @access  Private (User)
const toggleCompareProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const Product = require("../../models/Product");

    // Verify product exists
    const product = await Product.findById(productId).select("name");
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const result = await user.toggleCompare(productId);

    res.json({
      success: true,
      message: result.added
        ? `${product.name} added to compare list`
        : `${product.name} removed from compare list`,
      data: {
        added: result.added,
        compareCount: user.compareList.length,
        canAddMore: user.compareList.length < 4,
      },
    });
  } catch (error) {
    console.error("Toggle compare product error:", error);

    if (error.message === "Compare list is full (max 4 products)") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while updating compare list",
      error: error.message,
    });
  }
};

// @desc    Clear compare list
// @route   DELETE /api/user/profile/compare
// @access  Private (User)
const clearCompareList = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.compareList = [];
    await user.save();

    res.json({
      success: true,
      message: "Compare list cleared",
    });
  } catch (error) {
    console.error("Clear compare list error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while clearing compare list",
      error: error.message,
    });
  }
};

// ==================== ACCOUNT DELETION REQUEST ====================

// @desc    Request account deletion (with grace period)
// @route   POST /api/user/profile/request-deletion
// @access  Private (User)
const requestAccountDeletion = async (req, res) => {
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

    // Set deletion request with 30-day grace period
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + 30);

    user.deletionRequest = {
      requested: true,
      requestedAt: new Date(),
      scheduledDeletion: scheduledDate,
      reason: reason || "No reason provided",
    };

    await user.save();

    // TODO: Send email notification about deletion request

    res.json({
      success: true,
      message: "Account deletion requested. Your account will be deleted in 30 days.",
      data: {
        scheduledDeletion: scheduledDate,
        canCancel: true,
      },
    });
  } catch (error) {
    console.error("Request account deletion error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while requesting deletion",
      error: error.message,
    });
  }
};

// @desc    Cancel account deletion request
// @route   DELETE /api/user/profile/request-deletion
// @access  Private (User)
const cancelDeletionRequest = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.deletionRequest?.requested) {
      return res.status(400).json({
        success: false,
        message: "No pending deletion request found",
      });
    }

    user.deletionRequest = {
      requested: false,
      requestedAt: null,
      scheduledDeletion: null,
      reason: null,
    };

    await user.save();

    res.json({
      success: true,
      message: "Account deletion request cancelled",
    });
  } catch (error) {
    console.error("Cancel deletion request error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while cancelling deletion",
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
  // Address book
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  // Recently viewed
  getRecentlyViewed,
  clearRecentlyViewed,
  // Compare products
  getCompareList,
  toggleCompareProduct,
  clearCompareList,
  // Account deletion
  requestAccountDeletion,
  cancelDeletionRequest,
};
