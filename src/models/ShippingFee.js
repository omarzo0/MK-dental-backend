const mongoose = require("mongoose");

const shippingFeeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Location name is required"],
      unique: true,
      trim: true,
    },
    fee: {
      type: Number,
      default: 0,
      min: [0, "Shipping fee cannot be negative"],
      // Fee is required only when isFreeShipping is false
      validate: {
        validator: function(value) {
          // If free shipping, fee can be 0 or any value
          if (this.isFreeShipping) return true;
          // Otherwise, fee must be a valid number >= 0
          return value !== undefined && value !== null && value >= 0;
        },
        message: "Shipping fee is required when free shipping is disabled"
      }
    },
    isFreeShipping: {
      type: Boolean,
      default: false,
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
