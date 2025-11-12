// controllers/admin/userManagementController.js
const User = require("../../models/User");
const Order = require("../../models/Order");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

// @desc    Get all users with pagination and filtering
// @route   GET /api/admin/users
// @access  Private (Admin - canManageUsers)
const getAllUsers = async (req, res) => {
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
      page = 1,
      limit = 10,
      search,
      isActive,
      role,
      sortBy = "createdAt",
      sortOrder = "desc",
      dateFrom,
      dateTo,
    } = req.query;

    // Build filter
    const filter = { role: "user" }; // Only regular users, not admins

    // Search filter
    if (search) {
      filter.$or = [
        { "profile.firstName": { $regex: search, $options: "i" } },
        { "profile.lastName": { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
      ];
    }

    // Status filter
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    // Role filter (if needed for future)
    if (role) {
      filter.role = role;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Get users with pagination
    const users = await User.find(filter)
      .select("-password -__v")
      .sort(sortConfig)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get total count for pagination
    const totalUsers = await User.countDocuments(filter);

    // Get user statistics (orders count for each user)
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const ordersCount = await Order.countDocuments({ userId: user._id });
        const totalSpent = await Order.aggregate([
          {
            $match: {
              userId: user._id,
              paymentStatus: "paid",
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: "$totals.total" },
            },
          },
        ]);

        return {
          ...user.toObject(),
          statistics: {
            ordersCount,
            totalSpent: totalSpent[0]?.total || 0,
            lastOrder: await Order.findOne({ userId: user._id })
              .sort({ createdAt: -1 })
              .select("createdAt"),
          },
        };
      })
    );

    // Get overall user statistics
    const userStats = await User.aggregate([
      { $match: { role: "user" } },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: {
            $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
          },
          newUsersThisMonth: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$isActive", true] },
                    {
                      $gte: [
                        "$createdAt",
                        new Date(
                          new Date().getFullYear(),
                          new Date().getMonth(),
                          1
                        ),
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        users: usersWithStats,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalUsers / limit),
          totalUsers,
          hasNext: page * limit < totalUsers,
          hasPrev: page > 1,
        },
        statistics: userStats[0] || {
          totalUsers: 0,
          activeUsers: 0,
          newUsersThisMonth: 0,
        },
        filters: {
          search,
          isActive,
          dateFrom,
          dateTo,
        },
      },
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching users",
      error: error.message,
    });
  }
};

// @desc    Get user by ID with detailed information
// @route   GET /api/admin/users/:userId
// @access  Private (Admin - canManageUsers)
const getUserById = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { userId } = req.params;

    const user = await User.findById(userId).select("-password -__v");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get user's orders with details
    const userOrders = await Order.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("orderNumber status totals.total paymentStatus createdAt");

    // Get user statistics
    const userStats = await Order.aggregate([
      {
        $match: { userId: new mongoose.Types.ObjectId(userId) },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totals.total" },
        },
      },
    ]);

    const totalStats = await Order.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: "$totals.total" },
          averageOrderValue: { $avg: "$totals.total" },
        },
      },
    ]);

    const lastOrder = await Order.findOne({ userId })
      .sort({ createdAt: -1 })
      .select("createdAt orderNumber status");

    res.json({
      success: true,
      data: {
        user,
        orders: userOrders,
        statistics: {
          ...totalStats[0],
          byStatus: userStats,
          lastOrder: lastOrder?.createdAt || null,
          daysSinceLastOrder: lastOrder
            ? Math.floor(
                (new Date() - lastOrder.createdAt) / (1000 * 60 * 60 * 24)
              )
            : null,
        },
      },
    });
  } catch (error) {
    console.error("Get user by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user",
      error: error.message,
    });
  }
};

// @desc    Create new user (admin creation)
// @route   POST /api/admin/users
// @access  Private (Admin - canManageUsers)
const createUser = async (req, res) => {
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
      dateOfBirth,
      gender,
      address,
      isActive = true,
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email or username",
      });
    }

    // Create user (password will be hashed by the model pre-save hook)
    const user = new User({
      username,
      email,
      password, // Raw password - will be hashed automatically
      profile: {
        firstName,
        lastName,
        phone,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        gender,
      },
      address,
      isActive,
      createdBy: req.admin.adminId, // Track which admin created this user
      emailVerified: true, // Admin-created users are automatically verified
    });

    await user.save();

    // Remove password from response
    const userResponse = {
      _id: user._id,
      username: user.username,
      email: user.email,
      profile: user.profile,
      address: user.address,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      createdBy: user.createdBy,
    };

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: {
        user: userResponse,
      },
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating user",
      error: error.message,
    });
  }
};

// @desc    Update user
// @route   PUT /api/admin/users/:userId
// @access  Private (Admin - canManageUsers)
const updateUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { userId } = req.params;
    const { profile, address, preferences, isActive, emailVerified } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update profile fields
    if (profile) {
      if (profile.firstName) user.profile.firstName = profile.firstName;
      if (profile.lastName) user.profile.lastName = profile.lastName;
      if (profile.phone) user.profile.phone = profile.phone;
      if (profile.dateOfBirth)
        user.profile.dateOfBirth = new Date(profile.dateOfBirth);
      if (profile.gender) user.profile.gender = profile.gender;
      if (profile.avatar) user.profile.avatar = profile.avatar;
    }

    // Update address
    if (address) {
      user.address = {
        ...user.address,
        ...address,
      };
    }

    // Update preferences
    if (preferences) {
      user.preferences = {
        ...user.preferences,
        ...preferences,
      };
    }

    // Update status fields
    if (isActive !== undefined) user.isActive = isActive;
    if (emailVerified !== undefined) user.emailVerified = emailVerified;

    user.updatedAt = new Date();
    user.updatedBy = req.admin.adminId; // Track which admin updated this user
    await user.save();

    // Remove sensitive data from response
    const userResponse = {
      _id: user._id,
      username: user.username,
      email: user.email,
      profile: user.profile,
      address: user.address,
      preferences: user.preferences,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      updatedBy: user.updatedBy,
    };

    res.json({
      success: true,
      message: "User updated successfully",
      data: {
        user: userResponse,
      },
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating user",
      error: error.message,
    });
  }
};

// @desc    Delete user (soft delete)
// @route   DELETE /api/admin/users/:userId
// @access  Private (Admin - canManageUsers)
const deleteUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { userId } = req.params;
    const { reason = "Admin deletion" } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user has active orders
    const activeOrders = await Order.findOne({
      userId,
      status: { $in: ["pending", "confirmed", "shipped"] },
    });

    if (activeOrders) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete user with active orders. Please cancel orders first.",
      });
    }

    // Soft delete - mark as inactive and add deletion info
    user.isActive = false;
    user.deletedAt = new Date();
    user.deletedBy = req.admin.adminId;
    user.deletionReason = reason;
    await user.save();

    // TODO: In production, you might want to:
    // 1. Anonymize personal data
    // 2. Send notification to user
    // 3. Log the deletion for audit purposes

    res.json({
      success: true,
      message: "User deleted successfully",
      data: {
        deletedAt: user.deletedAt,
        deletionReason: user.deletionReason,
      },
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting user",
      error: error.message,
    });
  }
};

// @desc    Bulk user operations
// @route   POST /api/admin/users/bulk
// @access  Private (Admin - canManageUsers)
const bulkUserOperations = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { userIds, action, data } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "User IDs array is required",
      });
    }

    let result;
    let message;

    switch (action) {
      case "activate":
        result = await User.updateMany(
          { _id: { $in: userIds } },
          {
            $set: {
              isActive: true,
              updatedAt: new Date(),
              updatedBy: req.admin.adminId,
            },
          }
        );
        message = `${result.modifiedCount} users activated successfully`;
        break;

      case "deactivate":
        result = await User.updateMany(
          { _id: { $in: userIds } },
          {
            $set: {
              isActive: false,
              updatedAt: new Date(),
              updatedBy: req.admin.adminId,
            },
          }
        );
        message = `${result.modifiedCount} users deactivated successfully`;
        break;

      case "delete":
        // Soft delete multiple users
        result = await User.updateMany(
          { _id: { $in: userIds } },
          {
            $set: {
              isActive: false,
              deletedAt: new Date(),
              deletedBy: req.admin.adminId,
              deletionReason: data?.reason || "Bulk deletion",
            },
          }
        );
        message = `${result.modifiedCount} users deleted successfully`;
        break;

      case "export":
        // Get users for export
        const users = await User.find({ _id: { $in: userIds } })
          .select("-password -__v")
          .populate("createdBy", "username profile")
          .populate("updatedBy", "username profile");

        result = {
          action: "export",
          count: users.length,
          data: users,
        };
        message = `${users.length} users exported successfully`;
        break;

      default:
        return res.status(400).json({
          success: false,
          message:
            "Invalid action. Supported actions: activate, deactivate, delete, export",
        });
    }

    res.json({
      success: true,
      message,
      data: result,
    });
  } catch (error) {
    console.error("Bulk user operations error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while performing bulk operations",
      error: error.message,
    });
  }
};

// @desc    Get user activity log
// @route   GET /api/admin/users/:userId/activity
// @access  Private (Admin - canManageUsers)
const getUserActivity = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { userId } = req.params;
    const { page = 1, limit = 20, type } = req.query;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get user's orders as activity
    const orders = await Order.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select("orderNumber status totals.total paymentStatus createdAt");

    // Format activity log
    const activityLog = orders.map((order) => ({
      type: "order",
      description: `Order #${order.orderNumber} - ${order.status}`,
      amount: order.totals.total,
      date: order.createdAt,
      orderId: order._id,
      status: order.status,
    }));

    // Add profile updates if tracked
    if (user.updatedAt && user.updatedBy) {
      activityLog.push({
        type: "profile_update",
        description: "Profile updated by admin",
        date: user.updatedAt,
        updatedBy: user.updatedBy,
      });
    }

    // Sort by date
    activityLog.sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalActivities = await Order.countDocuments({ userId });

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
        },
        activities: activityLog,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalActivities / limit),
          totalActivities,
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

// @desc    Search users with advanced filters
// @route   GET /api/admin/users/search
// @access  Private (Admin - canManageUsers)
const searchUsers = async (req, res) => {
  try {
    const { q, field = "all", limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    let filter = { role: "user" };

    switch (field) {
      case "email":
        filter.email = { $regex: q, $options: "i" };
        break;
      case "name":
        filter.$or = [
          { "profile.firstName": { $regex: q, $options: "i" } },
          { "profile.lastName": { $regex: q, $options: "i" } },
        ];
        break;
      case "username":
        filter.username = { $regex: q, $options: "i" };
        break;
      case "phone":
        filter["profile.phone"] = { $regex: q, $options: "i" };
        break;
      case "all":
      default:
        filter.$or = [
          { email: { $regex: q, $options: "i" } },
          { username: { $regex: q, $options: "i" } },
          { "profile.firstName": { $regex: q, $options: "i" } },
          { "profile.lastName": { $regex: q, $options: "i" } },
          { "profile.phone": { $regex: q, $options: "i" } },
        ];
        break;
    }

    const users = await User.find(filter)
      .select("username email profile isActive createdAt")
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        users,
        searchQuery: q,
        searchField: field,
        resultsCount: users.length,
      },
    });
  } catch (error) {
    console.error("Search users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while searching users",
      error: error.message,
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  bulkUserOperations,
  getUserActivity,
  searchUsers,
};
