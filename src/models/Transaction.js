const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Payment",
    required: true,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  type: {
    type: String,
    enum: ["sale", "refund", "authorization", "capture"],
    required: true,
  },
  amount: { type: Number, required: true },
  currency: { type: String, default: "USD" },
  gatewayTransactionId: { type: String, required: true },
  gatewayResponse: { type: mongoose.Schema.Types.Mixed },
  status: {
    type: String,
    enum: ["success", "failed", "pending"],
    required: true,
  },
  processedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Transaction", transactionSchema);
