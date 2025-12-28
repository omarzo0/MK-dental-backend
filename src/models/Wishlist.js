const mongoose = require("mongoose");

const wishlistItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
  priceAtAdd: {
    type: Number,
  },
  notes: {
    type: String,
    maxlength: 500,
  },
});

const wishlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: [wishlistItemSchema],
    itemsCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Update items count before saving
wishlistSchema.pre("save", function (next) {
  this.itemsCount = this.items.length;
  next();
});

// Index for faster queries (userId already indexed via unique: true)
wishlistSchema.index({ "items.productId": 1 });

module.exports = mongoose.model("Wishlist", wishlistSchema);
