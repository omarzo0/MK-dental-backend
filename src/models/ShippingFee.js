const mongoose = require("mongoose");

const shippingFeeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Location name is required"],
      unique: true,
      trim: true,
    },
    shippingFee: {
      type: Number,
      required: [true, "Shipping fee is required"],
      min: [0, "Shipping fee cannot be negative"],
    },
    freeShippingThreshold: {
      type: Number,
      default: null,
      min: [0, "Threshold cannot be negative"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
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

// Index for faster queries
shippingFeeSchema.index({ name: 1 });
shippingFeeSchema.index({ isActive: 1 });

const ShippingFee = mongoose.model("ShippingFee", shippingFeeSchema);

module.exports = ShippingFee;
