// controllers/user/reviewController.js
const Review = require("../../models/Review");
const Product = require("../../models/Product");
const Order = require("../../models/Order");
const { validationResult } = require("express-validator");

// @desc    Get reviews for a product
// @route   GET /api/products/:productId/reviews
// @access  Public
const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      rating,
      verified,
    } = req.query;

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Build filter
    const filter = {
      productId,
      status: "approved",
    };

    if (rating) {
      filter.rating = parseInt(rating);
    }

    if (verified === "true") {
      filter.isVerifiedPurchase = true;
    }

    // Sort config
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "asc" ? 1 : -1;

    const reviews = await Review.find(filter)
      .populate("userId", "username profile.firstName profile.lastName profile.avatar")
      .sort(sortConfig)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments(filter);

    // Get rating summary
    const ratingSummary = {
      average: product.ratings?.average || 0,
      count: product.ratings?.count || 0,
      distribution: product.ratings?.distribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    };

    res.json({
      success: true,
      data: {
        reviews,
        ratingSummary,
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
    console.error("Get product reviews error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching reviews",
      error: error.message,
    });
  }
};

// @desc    Create a review
// @route   POST /api/user/reviews
// @access  Private (User)
const createReview = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { productId, orderId, rating, title, comment, images, detailedRatings } = req.body;
    const userId = req.user.userId;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({ userId, productId });
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this product",
      });
    }

    // Check if user purchased this product (verified purchase)
    let isVerifiedPurchase = false;
    if (orderId) {
      const order = await Order.findOne({
        _id: orderId,
        userId,
        "items.productId": productId,
        status: "delivered",
      });
      isVerifiedPurchase = !!order;
    } else {
      // Check any delivered order with this product
      const order = await Order.findOne({
        userId,
        "items.productId": productId,
        status: "delivered",
      });
      isVerifiedPurchase = !!order;
    }

    const review = new Review({
      userId,
      productId,
      orderId,
      rating,
      title,
      comment,
      images: images || [],
      detailedRatings,
      isVerifiedPurchase,
      status: "pending", // Requires approval
    });

    await review.save();

    res.status(201).json({
      success: true,
      message: "Review submitted successfully. It will be visible after approval.",
      data: { review },
    });
  } catch (error) {
    console.error("Create review error:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this product",
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error while creating review",
      error: error.message,
    });
  }
};

// @desc    Update user's review
// @route   PUT /api/user/reviews/:reviewId
// @access  Private (User)
const updateReview = async (req, res) => {
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
    const { rating, title, comment, images, detailedRatings } = req.body;
    const userId = req.user.userId;

    const review = await Review.findOne({ _id: reviewId, userId });
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Update fields
    if (rating) review.rating = rating;
    if (title !== undefined) review.title = title;
    if (comment !== undefined) review.comment = comment;
    if (images) review.images = images;
    if (detailedRatings) review.detailedRatings = detailedRatings;

    review.isEdited = true;
    review.editedAt = new Date();
    review.status = "pending"; // Re-review after edit

    await review.save();

    // Recalculate product rating
    await Review.calculateProductRating(review.productId);

    res.json({
      success: true,
      message: "Review updated successfully. It will be visible after re-approval.",
      data: { review },
    });
  } catch (error) {
    console.error("Update review error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating review",
      error: error.message,
    });
  }
};

// @desc    Delete user's review
// @route   DELETE /api/user/reviews/:reviewId
// @access  Private (User)
const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.userId;

    const review = await Review.findOne({ _id: reviewId, userId });
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    const productId = review.productId;
    await Review.findByIdAndDelete(reviewId);

    // Recalculate product rating
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

// @desc    Get user's reviews
// @route   GET /api/user/reviews
// @access  Private (User)
const getUserReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const userId = req.user.userId;

    const filter = { userId };
    if (status) {
      filter.status = status;
    }

    const reviews = await Review.find(filter)
      .populate("productId", "name images price")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments(filter);

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          total,
        },
      },
    });
  } catch (error) {
    console.error("Get user reviews error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching reviews",
      error: error.message,
    });
  }
};

// @desc    Mark review as helpful
// @route   POST /api/user/reviews/:reviewId/helpful
// @access  Private (User)
const markReviewHelpful = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.userId;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    // Check if user already marked as helpful
    const alreadyMarked = review.helpful.users.includes(userId);

    if (alreadyMarked) {
      // Remove helpful vote
      review.helpful.users = review.helpful.users.filter(
        (id) => id.toString() !== userId.toString()
      );
      review.helpful.count = Math.max(0, review.helpful.count - 1);
    } else {
      // Add helpful vote
      review.helpful.users.push(userId);
      review.helpful.count += 1;
    }

    await review.save();

    res.json({
      success: true,
      message: alreadyMarked ? "Helpful vote removed" : "Marked as helpful",
      data: {
        helpfulCount: review.helpful.count,
        isHelpful: !alreadyMarked,
      },
    });
  } catch (error) {
    console.error("Mark helpful error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while marking review",
      error: error.message,
    });
  }
};

// @desc    Check if user can review a product
// @route   GET /api/user/reviews/can-review/:productId
// @access  Private (User)
const canReviewProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.userId;

    // Check if already reviewed
    const existingReview = await Review.findOne({ userId, productId });
    if (existingReview) {
      return res.json({
        success: true,
        data: {
          canReview: false,
          reason: "already_reviewed",
          existingReview: {
            _id: existingReview._id,
            rating: existingReview.rating,
            status: existingReview.status,
          },
        },
      });
    }

    // Check if user purchased the product
    const order = await Order.findOne({
      userId,
      "items.productId": productId,
      status: "delivered",
    });

    res.json({
      success: true,
      data: {
        canReview: true,
        isVerifiedPurchase: !!order,
        orderId: order?._id,
      },
    });
  } catch (error) {
    console.error("Can review check error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while checking review eligibility",
      error: error.message,
    });
  }
};

module.exports = {
  getProductReviews,
  createReview,
  updateReview,
  deleteReview,
  getUserReviews,
  markReviewHelpful,
  canReviewProduct,
};
