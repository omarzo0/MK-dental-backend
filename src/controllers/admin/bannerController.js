const Banner = require("../../models/Banner");

// Get all banners (admin)
const getAllBanners = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      position,
      isActive,
      sortBy = "order",
      sortOrder = "asc",
    } = req.query;

    const query = {};

    if (position) {
      query.position = position;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const [banners, total] = await Promise.all([
      Banner.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .populate("createdBy", "name email")
        .populate("updatedBy", "name email"),
      Banner.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: banners,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get all banners error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch banners",
      error: error.message,
    });
  }
};

// Get single banner by ID
const getBannerById = async (req, res) => {
  try {
    const { bannerId } = req.params;

    const banner = await Banner.findById(bannerId)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    res.status(200).json({
      success: true,
      data: banner,
    });
  } catch (error) {
    console.error("Get banner by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch banner",
      error: error.message,
    });
  }
};

// Create banner
const createBanner = async (req, res) => {
  try {
    const {
      title,
      subtitle,
      image,
      mobileImage,
      link,
      linkType,
      linkTarget,
      buttonText,
      position,
      order,
      isActive,
      startDate,
      endDate,
      backgroundColor,
      textColor,
    } = req.body;

    // If no order specified, get the next order number for this position
    let bannerOrder = order;
    if (bannerOrder === undefined || bannerOrder === null) {
      const lastBanner = await Banner.findOne({ position: position || "hero" })
        .sort({ order: -1 })
        .select("order");
      bannerOrder = lastBanner ? lastBanner.order + 1 : 0;
    }

    const banner = new Banner({
      title,
      subtitle,
      image,
      mobileImage,
      link,
      linkType,
      linkTarget,
      buttonText,
      position,
      order: bannerOrder,
      isActive: isActive !== undefined ? isActive : true,
      startDate,
      endDate,
      backgroundColor,
      textColor,
      createdBy: req.admin.adminId,
    });

    await banner.save();

    const populatedBanner = await Banner.findById(banner._id)
      .populate("createdBy", "name email");

    res.status(201).json({
      success: true,
      message: "Banner created successfully",
      data: populatedBanner,
    });
  } catch (error) {
    console.error("Create banner error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create banner",
      error: error.message,
    });
  }
};

// Update banner
const updateBanner = async (req, res) => {
  try {
    const { bannerId } = req.params;
    const updateData = req.body;

    const banner = await Banner.findById(bannerId);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    // Add updatedBy field
    updateData.updatedBy = req.admin.adminId;

    const updatedBanner = await Banner.findByIdAndUpdate(
      bannerId,
      updateData,
      { new: true, runValidators: true }
    )
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    res.status(200).json({
      success: true,
      message: "Banner updated successfully",
      data: updatedBanner,
    });
  } catch (error) {
    console.error("Update banner error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update banner",
      error: error.message,
    });
  }
};

// Delete banner
const deleteBanner = async (req, res) => {
  try {
    const { bannerId } = req.params;

    const banner = await Banner.findById(bannerId);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    await Banner.findByIdAndDelete(bannerId);

    res.status(200).json({
      success: true,
      message: "Banner deleted successfully",
    });
  } catch (error) {
    console.error("Delete banner error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete banner",
      error: error.message,
    });
  }
};

// Toggle banner active status
const toggleBannerStatus = async (req, res) => {
  try {
    const { bannerId } = req.params;

    const banner = await Banner.findById(bannerId);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    banner.isActive = !banner.isActive;
    banner.updatedBy = req.admin.adminId;
    await banner.save();

    res.status(200).json({
      success: true,
      message: `Banner ${banner.isActive ? "activated" : "deactivated"} successfully`,
      data: banner,
    });
  } catch (error) {
    console.error("Toggle banner status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle banner status",
      error: error.message,
    });
  }
};

// Reorder banners
const reorderBanners = async (req, res) => {
  try {
    const { banners } = req.body; // Array of { bannerId, order }

    if (!Array.isArray(banners) || banners.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Banners array is required",
      });
    }

    const bulkOps = banners.map((item) => ({
      updateOne: {
        filter: { _id: item.bannerId },
        update: { $set: { order: item.order, updatedBy: req.admin.adminId } },
      },
    }));

    await Banner.bulkWrite(bulkOps);

    const updatedBanners = await Banner.find({
      _id: { $in: banners.map((b) => b.bannerId) },
    }).sort({ order: 1 });

    res.status(200).json({
      success: true,
      message: "Banners reordered successfully",
      data: updatedBanners,
    });
  } catch (error) {
    console.error("Reorder banners error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reorder banners",
      error: error.message,
    });
  }
};

// Bulk delete banners
const bulkDeleteBanners = async (req, res) => {
  try {
    const { bannerIds } = req.body;

    if (!Array.isArray(bannerIds) || bannerIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Banner IDs array is required",
      });
    }

    const result = await Banner.deleteMany({ _id: { $in: bannerIds } });

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} banner(s) deleted successfully`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Bulk delete banners error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete banners",
      error: error.message,
    });
  }
};

// Bulk update banner status
const bulkUpdateStatus = async (req, res) => {
  try {
    const { bannerIds, isActive } = req.body;

    if (!Array.isArray(bannerIds) || bannerIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Banner IDs array is required",
      });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean",
      });
    }

    const result = await Banner.updateMany(
      { _id: { $in: bannerIds } },
      { $set: { isActive, updatedBy: req.admin.adminId } }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} banner(s) updated successfully`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Bulk update status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update banners",
      error: error.message,
    });
  }
};

module.exports = {
  getAllBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleBannerStatus,
  reorderBanners,
  bulkDeleteBanners,
  bulkUpdateStatus,
};
