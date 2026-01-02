const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Banner title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    subtitle: {
      type: String,
      trim: true,
      maxlength: [200, "Subtitle cannot exceed 200 characters"],
    },
    image: {
      type: String,
      required: [true, "Banner image is required"],
    },
    mobileImage: {
      type: String,
      default: null,
    },
    link: {
      type: String,
      trim: true,
    },
    linkType: {
      type: String,
      enum: ["product", "category", "external", "none"],
      default: "none",
    },
    linkTarget: {
      type: String,
      default: null, // Product ID, Category ID, or external URL based on linkType
    },
    buttonText: {
      type: String,
      trim: true,
      maxlength: [50, "Button text cannot exceed 50 characters"],
    },
    position: {
      type: String,
      enum: ["hero", "secondary", "promotional"],
      default: "hero",
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    backgroundColor: {
      type: String,
      default: null,
    },
    textColor: {
      type: String,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
bannerSchema.index({ isActive: 1, position: 1, order: 1 });
bannerSchema.index({ startDate: 1, endDate: 1 });

// Virtual to check if banner is currently valid (within date range)
bannerSchema.virtual("isCurrentlyActive").get(function () {
  if (!this.isActive) return false;

  const now = new Date();

  if (this.startDate && now < this.startDate) return false;
  if (this.endDate && now > this.endDate) return false;

  return true;
});

// Ensure virtuals are included in JSON output
bannerSchema.set("toJSON", { virtuals: true });
bannerSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Banner", bannerSchema);
