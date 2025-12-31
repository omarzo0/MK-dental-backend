const mongoose = require("mongoose");

// Schema for items included in a package
const packageItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1,
  },
  // Snapshot of product info at time of package creation
  name: { type: String },
  price: { type: Number },
  image: { type: String },
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },

  // Product Type: single product or package bundle
  productType: {
    type: String,
    enum: ["single", "package"],
    default: "single",
  },

  // Package-specific fields (only used when productType is "package")
  packageItems: [packageItemSchema],
  packageDetails: {
    totalItemsCount: { type: Number, default: 0 },
    originalTotalPrice: { type: Number, default: 0 }, // Sum of all items at regular price
    savings: { type: Number, default: 0 }, // How much customer saves
    savingsPercentage: { type: Number, default: 0 },
  },

  price: { type: Number, required: true },
  cost: { type: Number },
  inventory: {
    quantity: { type: Number, required: true, default: 0 },
    lowStockAlert: { type: Number, default: 10 },
    trackQuantity: { type: Boolean, default: true },
  },
  images: [{ type: String }],
  specifications: {
    model: { type: String },
    color: { type: String },
    storage: { type: String },
  },
  seo: {
    metaTitle: { type: String },
    metaDescription: { type: String },
  },
  tags: [{ type: String }],
  status: {
    type: String,
    enum: ["active", "inactive", "draft"],
    default: "active",
  },
  featured: { type: Boolean, default: false },
  ratings: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 },
    distribution: {
      5: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      1: { type: Number, default: 0 },
    },
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Method to calculate package details
productSchema.methods.calculatePackageDetails = async function () {
  if (this.productType !== "package" || !this.packageItems.length) {
    return this;
  }

  const Product = mongoose.model("Product");
  let originalTotalPrice = 0;
  let totalItemsCount = 0;

  for (const item of this.packageItems) {
    const product = await Product.findById(item.productId);
    if (product) {
      originalTotalPrice += product.price * item.quantity;
      totalItemsCount += item.quantity;
      // Update snapshot
      item.name = product.name;
      item.price = product.price;
      item.image = product.images?.[0] || "";
    }
  }

  this.packageDetails = {
    totalItemsCount,
    originalTotalPrice,
    savings: originalTotalPrice - this.price,
    savingsPercentage:
      originalTotalPrice > 0
        ? Math.round(((originalTotalPrice - this.price) / originalTotalPrice) * 100)
        : 0,
  };

  return this;
};

// Static method to get package with populated items
productSchema.statics.getPackageWithItems = async function (packageId) {
  const pkg = await this.findById(packageId).populate({
    path: "packageItems.productId",
    select: "name price images inventory status",
  });
  return pkg;
};

// Index for product type queries
productSchema.index({ productType: 1 });
productSchema.index({ "packageItems.productId": 1 });

module.exports = mongoose.model("Product", productSchema);
