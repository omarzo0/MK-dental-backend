// controllers/admin/couponController.js
const Coupon = require("../../models/Coupon");
const Order = require("../../models/Order");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

// @desc    Get all coupons with filtering and pagination
// @route   GET /api/admin/coupons
// @access  Private (Admin)
const getAllCoupons = async (req, res) => {
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
      limit = 20,
      search,
      status,
      discountType,
      isActive,
      sortBy = "createdAt",
      sortOrder = "desc",
      startDateFrom,
      startDateTo,
      endDateFrom,
      endDateTo,
    } = req.query;

    // Build filter
    const filter = {};

    // Search filter
    if (search) {
      filter.$or = [
        { code: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Status filter
    if (status) {
      filter.status = status;
    }

    // Discount type filter
    if (discountType) {
      filter.discountType = discountType;
    }

    // Active filter
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    // Date range filters
    if (startDateFrom || startDateTo) {
      filter.startDate = {};
      if (startDateFrom) filter.startDate.$gte = new Date(startDateFrom);
      if (startDateTo) filter.startDate.$lte = new Date(startDateTo);
    }

    if (endDateFrom || endDateTo) {
      filter.endDate = {};
      if (endDateFrom) filter.endDate.$gte = new Date(endDateFrom);
      if (endDateTo) filter.endDate.$lte = new Date(endDateTo);
    }

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Get coupons with pagination
    const coupons = await Coupon.find(filter)
      .populate("createdBy", "username profile.firstName profile.lastName")
      .populate("restrictions.products", "name sku price")
      .sort(sortConfig)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get total count
    const totalCoupons = await Coupon.countDocuments(filter);

    // Get coupon statistics
    const couponStats = await Coupon.aggregate([
      {
        $group: {
          _id: null,
          totalCoupons: { $sum: 1 },
          activeCoupons: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
          },
          expiredCoupons: {
            $sum: { $cond: [{ $eq: ["$status", "expired"] }, 1, 0] },
          },
          depletedCoupons: {
            $sum: { $cond: [{ $eq: ["$status", "depleted"] }, 1, 0] },
          },
          totalUsage: { $sum: "$usageCount" },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        coupons,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCoupons / limit),
          totalCoupons,
          hasNext: page * limit < totalCoupons,
          hasPrev: page > 1,
        },
        statistics: couponStats[0] || {
          totalCoupons: 0,
          activeCoupons: 0,
          expiredCoupons: 0,
          depletedCoupons: 0,
          totalUsage: 0,
        },
      },
    });
  } catch (error) {
    console.error("Get all coupons error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching coupons",
      error: error.message,
    });
  }
};

// @desc    Get coupon by ID
// @route   GET /api/admin/coupons/:couponId
// @access  Private (Admin)
const getCouponById = async (req, res) => {
  try {
    const { couponId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coupon ID",
      });
    }

    const coupon = await Coupon.findById(couponId)
      .populate("createdBy", "username profile.firstName profile.lastName")
      .populate("updatedBy", "username profile.firstName profile.lastName")
      .populate("restrictions.products", "name sku price images")
      .populate("usedBy.userId", "username email profile.firstName profile.lastName");

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    // Get usage analytics
    const usageAnalytics = await Order.aggregate([
      {
        $match: {
          "coupon.code": coupon.code,
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalDiscount: { $sum: "$coupon.discount" },
          totalRevenue: { $sum: "$totals.total" },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        coupon,
        analytics: usageAnalytics[0] || {
          totalOrders: 0,
          totalDiscount: 0,
          totalRevenue: 0,
        },
      },
    });
  } catch (error) {
    console.error("Get coupon by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching coupon",
      error: error.message,
    });
  }
};

// @desc    Create new coupon
// @route   POST /api/admin/coupons
// @access  Private (Admin)
const createCoupon = async (req, res) => {
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
      code,
      name,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      usageLimit,
      minimumPurchase,
      minimumItems,
      restrictions,
      startDate,
      endDate,
      isActive,
      notes,
    } = req.body;

    // Check if code already exists
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(400).json({
        success: false,
        message: "Coupon code already exists",
      });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) {
      return res.status(400).json({
        success: false,
        message: "End date must be after start date",
      });
    }

    // Validate discount value for percentage
    if (discountType === "percentage" && discountValue > 100) {
      return res.status(400).json({
        success: false,
        message: "Percentage discount cannot exceed 100%",
      });
    }

    const coupon = new Coupon({
      code: code.toUpperCase(),
      name,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      usageLimit: usageLimit || { total: null, perCustomer: 1 },
      minimumPurchase: minimumPurchase || 0,
      minimumItems: minimumItems || 0,
      restrictions: restrictions || {},
      startDate: start,
      endDate: end,
      isActive: isActive !== undefined ? isActive : true,
      notes,
      createdBy: req.admin.adminId,
    });

    await coupon.save();

    res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      data: { coupon },
    });
  } catch (error) {
    console.error("Create coupon error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating coupon",
      error: error.message,
    });
  }
};

// @desc    Update coupon
// @route   PUT /api/admin/coupons/:couponId
// @access  Private (Admin)
const updateCoupon = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { couponId } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coupon ID",
      });
    }

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    // Check if code is being changed and if new code exists
    if (updateData.code && updateData.code.toUpperCase() !== coupon.code) {
      const existingCoupon = await Coupon.findOne({
        code: updateData.code.toUpperCase(),
        _id: { $ne: couponId },
      });
      if (existingCoupon) {
        return res.status(400).json({
          success: false,
          message: "Coupon code already exists",
        });
      }
      updateData.code = updateData.code.toUpperCase();
    }

    // Validate dates if provided
    if (updateData.startDate && updateData.endDate) {
      const start = new Date(updateData.startDate);
      const end = new Date(updateData.endDate);
      if (end <= start) {
        return res.status(400).json({
          success: false,
          message: "End date must be after start date",
        });
      }
    }

    // Update coupon
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] !== undefined) {
        coupon[key] = updateData[key];
      }
    });

    coupon.updatedBy = req.admin.adminId;
    await coupon.save();

    res.json({
      success: true,
      message: "Coupon updated successfully",
      data: { coupon },
    });
  } catch (error) {
    console.error("Update coupon error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating coupon",
      error: error.message,
    });
  }
};

// @desc    Delete coupon
// @route   DELETE /api/admin/coupons/:couponId
// @access  Private (Admin)
const deleteCoupon = async (req, res) => {
  try {
    const { couponId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coupon ID",
      });
    }

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    // Check if coupon has been used
    if (coupon.usageCount > 0) {
      // Soft delete - just deactivate
      coupon.isActive = false;
      coupon.status = "inactive";
      await coupon.save();

      return res.json({
        success: true,
        message: "Coupon has been used and cannot be deleted. It has been deactivated instead.",
        data: { coupon },
      });
    }

    await Coupon.findByIdAndDelete(couponId);

    res.json({
      success: true,
      message: "Coupon deleted successfully",
    });
  } catch (error) {
    console.error("Delete coupon error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting coupon",
      error: error.message,
    });
  }
};

// @desc    Toggle coupon status (activate/deactivate)
// @route   PATCH /api/admin/coupons/:couponId/toggle-status
// @access  Private (Admin)
const toggleCouponStatus = async (req, res) => {
  try {
    const { couponId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coupon ID",
      });
    }

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    // Check if coupon is expired or depleted
    if (coupon.status === "expired") {
      return res.status(400).json({
        success: false,
        message: "Cannot activate an expired coupon",
      });
    }

    if (coupon.status === "depleted") {
      return res.status(400).json({
        success: false,
        message: "Cannot activate a depleted coupon",
      });
    }

    coupon.isActive = !coupon.isActive;
    coupon.status = coupon.isActive ? "active" : "inactive";
    coupon.updatedBy = req.admin.adminId;
    await coupon.save();

    res.json({
      success: true,
      message: `Coupon ${coupon.isActive ? "activated" : "deactivated"} successfully`,
      data: { coupon },
    });
  } catch (error) {
    console.error("Toggle coupon status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while toggling coupon status",
      error: error.message,
    });
  }
};

// @desc    Generate unique coupon code
// @route   GET /api/admin/coupons/generate-code
// @access  Private (Admin)
const generateCouponCode = async (req, res) => {
  try {
    const { prefix = "MK" } = req.query;
    const code = await Coupon.generateCode(prefix);

    res.json({
      success: true,
      data: { code },
    });
  } catch (error) {
    console.error("Generate coupon code error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while generating coupon code",
      error: error.message,
    });
  }
};

// @desc    Get coupon usage analytics
// @route   GET /api/admin/coupons/:couponId/analytics
// @access  Private (Admin)
const getCouponAnalytics = async (req, res) => {
  try {
    const { couponId } = req.params;
    const { period = "month" } = req.query;

    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coupon ID",
      });
    }

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (period) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get usage over time
    const usageOverTime = await Order.aggregate([
      {
        $match: {
          "coupon.code": coupon.code,
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          orders: { $sum: 1 },
          discount: { $sum: "$coupon.discount" },
          revenue: { $sum: "$totals.total" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get top users
    const topUsers = await Order.aggregate([
      {
        $match: {
          "coupon.code": coupon.code,
        },
      },
      {
        $group: {
          _id: "$userId",
          usageCount: { $sum: 1 },
          totalSaved: { $sum: "$coupon.discount" },
          totalSpent: { $sum: "$totals.total" },
        },
      },
      { $sort: { usageCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 1,
          usageCount: 1,
          totalSaved: 1,
          totalSpent: 1,
          "user.username": 1,
          "user.email": 1,
          "user.profile.firstName": 1,
          "user.profile.lastName": 1,
        },
      },
    ]);

    // Get overall statistics
    const overallStats = await Order.aggregate([
      {
        $match: {
          "coupon.code": coupon.code,
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalDiscount: { $sum: "$coupon.discount" },
          totalRevenue: { $sum: "$totals.total" },
          avgOrderValue: { $avg: "$totals.total" },
          avgDiscount: { $avg: "$coupon.discount" },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        coupon: {
          code: coupon.code,
          name: coupon.name,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          usageCount: coupon.usageCount,
          remainingUses: coupon.remainingUses,
        },
        usageOverTime,
        topUsers,
        statistics: overallStats[0] || {
          totalOrders: 0,
          totalDiscount: 0,
          totalRevenue: 0,
          avgOrderValue: 0,
          avgDiscount: 0,
        },
        period,
      },
    });
  } catch (error) {
    console.error("Get coupon analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching coupon analytics",
      error: error.message,
    });
  }
};

// @desc    Bulk update coupon status
// @route   PATCH /api/admin/coupons/bulk-status
// @access  Private (Admin)
const bulkUpdateStatus = async (req, res) => {
  try {
    const { couponIds, isActive } = req.body;

    if (!Array.isArray(couponIds) || couponIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of coupon IDs",
      });
    }

    const result = await Coupon.updateMany(
      {
        _id: { $in: couponIds },
        status: { $nin: ["expired", "depleted"] },
      },
      {
        $set: {
          isActive,
          status: isActive ? "active" : "inactive",
          updatedBy: req.admin.adminId,
        },
      }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} coupons updated successfully`,
      data: {
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount,
      },
    });
  } catch (error) {
    console.error("Bulk update status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while bulk updating coupon status",
      error: error.message,
    });
  }
};

// @desc    Validate coupon (for testing)
// @route   POST /api/admin/coupons/validate
// @access  Private (Admin)
const validateCoupon = async (req, res) => {
  try {
    const { code, userId, cartTotal, cartItems } = req.body;

    const coupon = await Coupon.findValidByCode(code);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Invalid or expired coupon code",
      });
    }

    // Check if can be used by user
    const canUse = await coupon.canBeUsedBy(
      userId,
      cartTotal || 0,
      cartItems || []
    );

    if (!canUse.valid) {
      return res.status(400).json({
        success: false,
        message: canUse.message,
      });
    }

    // Calculate discount
    const discountInfo = coupon.calculateDiscount(
      cartTotal || 0,
      cartItems || []
    );

    res.json({
      success: true,
      data: {
        coupon: {
          code: coupon.code,
          name: coupon.name,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
        },
        discount: discountInfo,
        message: "Coupon is valid",
      },
    });
  } catch (error) {
    console.error("Validate coupon error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while validating coupon",
      error: error.message,
    });
  }
};

module.exports = {
  getAllCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCouponStatus,
  generateCouponCode,
  getCouponAnalytics,
  bulkUpdateStatus,
  validateCoupon,
};
