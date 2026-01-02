const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  paymentMethod: {
    type: String,
    required: true,
    // No enum - payment methods are managed dynamically in Settings
  },
  paymentDetails: {
    // Card payment details
    cardLast4: { type: String },
    cardBrand: { type: String },
    cardHolderName: { type: String },
    expiryMonth: { type: String },
    expiryYear: { type: String },
    // Gateway details
    paymentGateway: { type: String },
    transactionId: { type: String },
    authorizationCode: { type: String },
    // COD specific
    codVerificationCode: { type: String },
    codCollectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    codCollectedAt: { type: Date },
  },
  amount: { type: Number, required: true },
  currency: { type: String, default: "EGP" },
  status: {
    type: String,
    enum: ["pending", "processing", "completed", "failed", "refunded", "partially_refunded", "cancelled"],
    default: "pending",
  },
  // For COD payments
  codStatus: {
    type: String,
    enum: ["awaiting_delivery", "collected", "failed_collection", null],
    default: null,
  },
  paymentDate: { type: Date },
  refundAmount: { type: Number, default: 0 },
  refundDate: { type: Date },
  refundReason: { type: String },
  failureReason: { type: String },
  gatewayTransactionId: { type: String },
  gatewayResponse: { type: mongoose.Schema.Types.Mixed },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Index for faster queries
paymentSchema.index({ orderId: 1 });
paymentSchema.index({ userId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ paymentMethod: 1 });
paymentSchema.index({ createdAt: -1 });

// Pre-save middleware to update timestamp
paymentSchema.pre("save", function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("Payment", paymentSchema);
