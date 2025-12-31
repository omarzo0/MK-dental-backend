// controllers/admin/reviewController.js
const Review = require("../../models/Review");
const Product = require("../../models/Product");
const { validationResult } = require("express-validator");

// @desc    Get all reviews (admin)
// @route   GET /api/admin/reviews
// @access  Private (Admin)
const getAllReviews = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      rating,
      productId,
      userId,
      verified,
      sortBy = "createdAt",
      sortOrder = "desc",
      search,
    } = req.query;

    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (rating) {
      filter.rating = parseInt(rating);
    }

    if (productId) {
      filter.productId = productId;
    }

    if (userId) {
      filter.userId = userId;
    }

    if (verified === "true") {
      filter.isVerifiedPurchase = true;
    } else if (verified === "false") {
      filter.isVerifiedPurchase = false;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { comment: { $regex: search, $options: "i" } },
      ];
    }

    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "asc" ? 1 : -1;

    const reviews = await Review.find(filter)
      .populate("userId", "username email profile.firstName profile.lastName")
      .populate("productId", "name images")
      .populate("moderatedBy", "username")
      .sort(sortConfig)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments(filter);

    // Get stats
    const stats = await Review.aggregate([
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          pendingReviews: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          approvedReviews: {
            $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] },
          },
          rejectedReviews: {
            $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] },
          },
          averageRating: { $avg: "$rating" },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        reviews,
        stats: stats[0] || {
          totalReviews: 0,
          pendingReviews: 0,
          approvedReviews: 0,
          rejectedReviews: 0,
          averageRating: 0,
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          total,
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get all reviews error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching reviews",
      error: error.message,
    });
  }
};

// @desc    Get review by ID
// @route   GET /api/admin/reviews/:reviewId
// @access  Private (Admin)
const getReviewById = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId)
      .populate("userId", "username email profile")
      .populate("productId", "name images price")
      .populate("orderId", "orderNumber createdAt")
      .populate("moderatedBy", "username")
      .populate("sellerResponse.respondedBy", "username");

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    res.json({
      success: true,
      data: { review },
    });
  } catch (error) {
    console.error("Get review error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching review",
      error: error.message,
    });
  }
};

// @desc    Approve review
// @route   PATCH /api/admin/reviews/:reviewId/approve
// @access  Private (Admin)
const approveReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    review.status = "approved";
    review.moderatedBy = req.admin.adminId;
    review.moderatedAt = new Date();

    await review.save();

    // Update product rating
    await Review.calculateProductRating(review.productId);

    res.json({
      success: true,
      message: "Review approved successfully",
      data: { review },
    });
  } catch (error) {
    console.error("Approve review error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while approving review",
      error: error.message,
    });
  }
};

// @desc    Reject review
// @route   PATCH /api/admin/reviews/:reviewId/reject
// @access  Private (Admin)
const rejectReview = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { reviewId } = req.params;
    const { reason } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    review.status = "rejected";
    review.moderatedBy = req.admin.adminId;
    review.moderatedAt = new Date();
    review.moderationNote = reason;

    await review.save();

    // Update product rating
    await Review.calculateProductRating(review.productId);

    res.json({
      success: true,
      message: "Review rejected",
      data: { review },
    });
  } catch (error) {
    console.error("Reject review error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while rejecting review",
      error: error.message,
    });
  }
};

// @desc    Delete review
// @route   DELETE /api/admin/reviews/:reviewId
// @access  Private (Admin)
const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    const productId = review.productId;
    await Review.findByIdAndDelete(reviewId);

    // Update product rating
    await Review.calculateProductRating(productId);

    res.json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting review",
      error: error.message,
    });
  }
};

// @desc    Bulk approve reviews
// @route   POST /api/admin/reviews/bulk-approve
// @access  Private (Admin)
const bulkApproveReviews = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { reviewIds } = req.body;

    // Get affected products for rating update
    const reviews = await Review.find({ _id: { $in: reviewIds } });
    const productIds = [...new Set(reviews.map((r) => r.productId.toString()))];

    await Review.updateMany(
      { _id: { $in: reviewIds } },
      {
        status: "approved",
        moderatedBy: req.admin.adminId,
        moderatedAt: new Date(),
      }
    );

    // Update product ratings
    for (const productId of productIds) {
      await Review.calculateProductRating(productId);
    }

    res.json({
      success: true,
      message: `${reviewIds.length} reviews approved successfully`,
    });
  } catch (error) {
    console.error("Bulk approve error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while approving reviews",
      error: error.message,
    });
  }
};

// @desc    Bulk reject reviews
// @route   POST /api/admin/reviews/bulk-reject
// @access  Private (Admin)
const bulkRejectReviews = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { reviewIds, reason } = req.body;

    // Get affected products
    const reviews = await Review.find({ _id: { $in: reviewIds } });
    const productIds = [...new Set(reviews.map((r) => r.productId.toString()))];

    await Review.updateMany(
      { _id: { $in: reviewIds } },
      {
        status: "rejected",
        moderatedBy: req.admin.adminId,
        moderatedAt: new Date(),
        moderationNote: reason,
      }
    );

    // Update product ratings
    for (const productId of productIds) {
      await Review.calculateProductRating(productId);
    }

    res.json({
      success: true,
      message: `${reviewIds.length} reviews rejected`,
    });
  } catch (error) {
    console.error("Bulk reject error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while rejecting reviews",
      error: error.message,
    });
  }
};

// @desc    Add seller response to review
// @route   POST /api/admin/reviews/:reviewId/respond
// @access  Private (Admin)
const addSellerResponse = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { reviewId } = req.params;
    const { comment } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    review.sellerResponse = {
      comment,
      respondedAt: new Date(),
      respondedBy: req.admin.adminId,
    };

    await review.save();

    res.json({
      success: true,
      message: "Response added successfully",
      data: { review },
    });
  } catch (error) {
    console.error("Add seller response error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while adding response",
      error: error.message,
    });
  }
};

// @desc    Get review statistics
// @route   GET /api/admin/reviews/stats
// @access  Private (Admin)
const getReviewStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) {
      dateFilter.createdAt = { $gte: new Date(startDate) };
    }
    if (endDate) {
      dateFilter.createdAt = { ...dateFilter.createdAt, $lte: new Date(endDate) };
    }

    const stats = await Review.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: "$rating" },
          pendingCount: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          approvedCount: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
          rejectedCount: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
          verifiedCount: { $sum: { $cond: ["$isVerifiedPurchase", 1, 0] } },
          withImagesCount: { $sum: { $cond: [{ $gt: [{ $size: "$images" }, 0] }, 1, 0] } },
        },
      },
    ]);

    // Rating distribution
    const ratingDistribution = await Review.aggregate([
      { $match: { status: "approved", ...dateFilter } },
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    // Top reviewed products
    const topReviewedProducts = await Review.aggregate([
      { $match: { status: "approved" } },
      {
        $group: {
          _id: "$productId",
          reviewCount: { $sum: 1 },
          averageRating: { $avg: "$rating" },
        },
      },
      { $sort: { reviewCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          productId: "$_id",
          productName: "$product.name",
          productImage: { $arrayElemAt: ["$product.images", 0] },
          reviewCount: 1,
          averageRating: { $round: ["$averageRating", 1] },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || {
          totalReviews: 0,
          averageRating: 0,
          pendingCount: 0,
          approvedCount: 0,
          rejectedCount: 0,
          verifiedCount: 0,
          withImagesCount: 0,
        },
        ratingDistribution,
        topReviewedProducts,
      },
    });
  } catch (error) {
    console.error("Get review stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching stats",
      error: error.message,
    });
  }
};

module.exports = {
  getAllReviews,
  getReviewById,
  approveReview,
  rejectReview,
  deleteReview,
  bulkApproveReviews,
  bulkRejectReviews,
  addSellerResponse,
  getReviewStats,
};
