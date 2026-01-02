const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  isGuestOrder: { type: Boolean, default: false },
  customer: {
    email: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String },
  },
  items: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      name: { type: String, required: true },
      price: { type: Number, required: true },
      quantity: { type: Number, required: true },
      subtotal: { type: Number, required: true },
      image: { type: String },
      sku: { type: String },
      // Product type: single or package
      productType: {
        type: String,
        enum: ["single", "package"],
        default: "single",
      },
      // Package details (only for package products)
      packageInfo: {
        totalItemsCount: { type: Number },
        originalTotalPrice: { type: Number },
        savings: { type: Number },
        savingsPercentage: { type: Number },
        items: [{
          productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
          name: { type: String },
          quantity: { type: Number },
          price: { type: Number },
          image: { type: String },
        }],
      },
    },
  ],
  totals: {
    subtotal: { type: Number, required: true },
    tax: { type: Number, required: true, default: 0 },
    shipping: { type: Number, required: true, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
  },
  shippingAddress: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true },
  },
  billingAddress: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true },
  },
  status: {
    type: String,
    enum: ["pending", "confirmed", "shipped", "delivered", "cancelled", "returned"],
    default: "pending",
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "failed", "refunded"],
    default: "pending",
  },
  shippingMethod: { type: String },
  trackingNumber: { type: String },
  handledBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  
  // Coupon applied to order
  coupon: {
    code: { type: String },
    discount: { type: Number, default: 0 },
    discountType: { type: String, enum: ["percentage", "fixed", "free_shipping"] },
  },
  
  // Order notes
  notes: [{
    _id: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
    content: { type: String, required: true },
    isPrivate: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    createdAt: { type: Date, default: Date.now },
  }],
  
  // Refund information
  refund: {
    amount: { type: Number },
    reason: { type: String },
    type: { type: String, enum: ["full", "partial"] },
    processedAt: { type: Date },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  
  // Cancellation information
  cancellation: {
    reason: { type: String },
    cancelledAt: { type: Date },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  },
  
  // Payment method
  paymentMethod: { type: String },
  
  // Timestamps for tracking
  confirmedAt: { type: Date },
  shippedAt: { type: Date },
  deliveredAt: { type: Date },
  returnedAt: { type: Date },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Index for guest order tracking
orderSchema.index({ orderNumber: 1, "customer.email": 1 });

module.exports = mongoose.model("Order", orderSchema);
