const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    // Basic Coupon Info
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [3, "Coupon code must be at least 3 characters"],
      maxlength: [20, "Coupon code cannot exceed 20 characters"],
    },
    name: {
      type: String,
      required: [true, "Coupon name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },

    // Discount Type and Value
    discountType: {
      type: String,
      enum: ["percentage", "fixed", "free_shipping"],
      required: [true, "Discount type is required"],
    },
    discountValue: {
      type: Number,
      required: function() {
        return this.discountType !== "free_shipping";
      },
      min: [0, "Discount value cannot be negative"],
    },
    maxDiscountAmount: {
      type: Number,
      default: null, // Maximum discount for percentage-based coupons
    },

    // Usage Limits
    usageLimit: {
      total: {
        type: Number,
        default: null, // null = unlimited
      },
      perCustomer: {
        type: Number,
        default: 1,
      },
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    usedBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        usageCount: {
          type: Number,
          default: 1,
        },
        lastUsedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Minimum Requirements
    minimumPurchase: {
      type: Number,
      default: 0,
    },
    minimumItems: {
      type: Number,
      default: 0,
    },

    // Restrictions
    restrictions: {
      // Apply to specific categories only
      categories: [
        {
          type: String,
        },
      ],
      // Apply to specific products only
      products: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
      ],
      // Exclude specific categories
      excludeCategories: [
        {
          type: String,
        },
      ],
      // Exclude specific products
      excludeProducts: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
      ],
      // Apply to specific product types
      productTypes: [
        {
          type: String,
          enum: ["single", "package"],
        },
      ],
      // New customers only
      newCustomersOnly: {
        type: Boolean,
        default: false,
      },
      // First order only
      firstOrderOnly: {
        type: Boolean,
        default: false,
      },
    },

    // Validity Period
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },

    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "expired", "depleted"],
      default: "active",
    },

    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ isActive: 1, status: 1 });
couponSchema.index({ startDate: 1, endDate: 1 });
couponSchema.index({ discountType: 1 });
couponSchema.index({ "restrictions.categories": 1 });
couponSchema.index({ "restrictions.products": 1 });

// Virtual for checking if coupon is valid
couponSchema.virtual("isValid").get(function () {
  const now = new Date();
  return (
    this.isActive &&
    this.status === "active" &&
    now >= this.startDate &&
    now <= this.endDate &&
    (this.usageLimit.total === null || this.usageCount < this.usageLimit.total)
  );
});

// Virtual for remaining uses
couponSchema.virtual("remainingUses").get(function () {
  if (this.usageLimit.total === null) return "unlimited";
  return Math.max(0, this.usageLimit.total - this.usageCount);
});

// Pre-save middleware to update status
couponSchema.pre("save", function (next) {
  const now = new Date();

  // Check if expired
  if (now > this.endDate) {
    this.status = "expired";
    this.isActive = false;
  }
  // Check if depleted
  else if (
    this.usageLimit.total !== null &&
    this.usageCount >= this.usageLimit.total
  ) {
    this.status = "depleted";
    this.isActive = false;
  }
  // Set to active if within date range
  else if (now >= this.startDate && now <= this.endDate && this.isActive) {
    this.status = "active";
  }
  // Set to inactive if not active
  else if (!this.isActive) {
    this.status = "inactive";
  }

  next();
});

// Static method to generate unique coupon code
couponSchema.statics.generateCode = async function (prefix = "MK") {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code;
  let isUnique = false;

  while (!isUnique) {
    code = prefix;
    for (let i = 0; i < 8; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    const existing = await this.findOne({ code });
    if (!existing) isUnique = true;
  }

  return code;
};

// Method to check if coupon can be used by a user
couponSchema.methods.canBeUsedBy = async function (userId, cartTotal, cartItems) {
  // Check if coupon is valid
  if (!this.isValid) {
    return { valid: false, message: "Coupon is not valid or has expired" };
  }

  // Check minimum purchase
  if (cartTotal < this.minimumPurchase) {
    return {
      valid: false,
      message: `Minimum purchase of $${this.minimumPurchase} required`,
    };
  }

  // Check minimum items
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  if (totalItems < this.minimumItems) {
    return {
      valid: false,
      message: `Minimum ${this.minimumItems} items required`,
    };
  }

  // Check per-customer usage limit
  const userUsage = this.usedBy.find(
    (u) => u.userId.toString() === userId.toString()
  );
  if (userUsage && userUsage.usageCount >= this.usageLimit.perCustomer) {
    return {
      valid: false,
      message: "You have already used this coupon the maximum number of times",
    };
  }

  // Check new customer restriction
  if (this.restrictions.newCustomersOnly) {
    const Order = mongoose.model("Order");
    const previousOrders = await Order.countDocuments({ userId });
    if (previousOrders > 0) {
      return {
        valid: false,
        message: "This coupon is only for new customers",
      };
    }
  }

  // Check first order restriction
  if (this.restrictions.firstOrderOnly) {
    const Order = mongoose.model("Order");
    const previousOrders = await Order.countDocuments({
      userId,
      paymentStatus: "paid",
    });
    if (previousOrders > 0) {
      return {
        valid: false,
        message: "This coupon is only valid for your first order",
      };
    }
  }

  return { valid: true, message: "Coupon is valid" };
};

// Method to calculate discount
couponSchema.methods.calculateDiscount = function (cartTotal, cartItems) {
  let discount = 0;

  // Calculate applicable items total based on restrictions
  let applicableTotal = cartTotal;

  if (this.restrictions.categories.length > 0) {
    applicableTotal = cartItems
      .filter((item) => this.restrictions.categories.includes(item.category))
      .reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  if (this.restrictions.products.length > 0) {
    applicableTotal = cartItems
      .filter((item) =>
        this.restrictions.products.some(
          (p) => p.toString() === item.productId.toString()
        )
      )
      .reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  // Calculate discount based on type
  switch (this.discountType) {
    case "percentage":
      discount = (applicableTotal * this.discountValue) / 100;
      // Apply max discount cap if set
      if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
        discount = this.maxDiscountAmount;
      }
      break;

    case "fixed":
      discount = Math.min(this.discountValue, applicableTotal);
      break;

    case "free_shipping":
      // This will be handled separately
      discount = 0;
      break;
  }

  return {
    discount: Math.round(discount * 100) / 100,
    discountType: this.discountType,
    freeShipping: this.discountType === "free_shipping",
  };
};

// Method to record usage
couponSchema.methods.recordUsage = async function (userId) {
  this.usageCount += 1;

  const userUsageIndex = this.usedBy.findIndex(
    (u) => u.userId.toString() === userId.toString()
  );

  if (userUsageIndex > -1) {
    this.usedBy[userUsageIndex].usageCount += 1;
    this.usedBy[userUsageIndex].lastUsedAt = new Date();
  } else {
    this.usedBy.push({
      userId,
      usageCount: 1,
      lastUsedAt: new Date(),
    });
  }

  await this.save();
};

// Static method to find valid coupon by code
couponSchema.statics.findValidByCode = async function (code) {
  const now = new Date();
  return this.findOne({
    code: code.toUpperCase(),
    isActive: true,
    status: "active",
    startDate: { $lte: now },
    endDate: { $gte: now },
    $or: [
      { "usageLimit.total": null },
      { $expr: { $lt: ["$usageCount", "$usageLimit.total"] } },
    ],
  });
};

const Coupon = mongoose.model("Coupon", couponSchema);

module.exports = Coupon;
