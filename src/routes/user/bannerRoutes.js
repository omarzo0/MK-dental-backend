const express = require("express");
const router = express.Router();

const {
  validateBannerId,
  validateBannerQuery,
} = require("../../validations/user/bannerValidation");

const {
  getBanners,
  getBannerById,
} = require("../../controllers/user/bannerController");

// Public routes - no authentication required

// Get all active banners (grouped by position)
router.get("/", validateBannerQuery, getBanners);

// Get single banner by ID
router.get("/:bannerId", validateBannerId, getBannerById);

module.exports = router;
