const Payment = require("../../models/Payment");
const Order = require("../../models/Order");
const Transaction = require("../../models/Transaction");
const User = require("../../models/User");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

// @desc    Create payment for order
// @route   POST /api/payments
// @access  Private
const createPayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const {
      orderId,
      paymentMethod,
      amount,
      paymentDetails = {},
      currency = "USD",
    } = req.body;

    const userId = req.user.userId;

    // Get order details
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Verify order belongs to user
    if (order.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this order",
      });
    }

    // Check if order is already paid
    if (order.paymentStatus === "paid") {
      return res.status(400).json({
        success: false,
        message: "Order is already paid",
      });
    }

    // Create payment record
    const payment = new Payment({
      orderId,
      userId,
      paymentMethod,
      amount,
      currency,
      paymentDetails: sanitizePaymentDetails(paymentDetails, paymentMethod),
      status: "pending",
    });

    await payment.save();

    // Populate payment with order details
    await payment.populate("orderId", "orderNumber totals status");

    res.status(201).json({
      success: true,
      message: "Payment created successfully",
      data: {
        payment,
        nextStep: "process_payment", // Indicate that payment should be processed next
      },
    });
  } catch (error) {
    console.error("Create payment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating payment",
      error: error.message,
    });
  }
};

// @desc    Process payment
// @route   POST /api/payments/:paymentId/process
// @access  Private
const processPayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { paymentId } = req.params;
    const { paymentToken, savePaymentMethod = false } = req.body;

    const payment = await Payment.findById(paymentId).populate("orderId");
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Verify payment belongs to user
    if (payment.userId.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this payment",
      });
    }

    // Check if payment is already processed
    if (payment.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Payment is already ${payment.status}`,
      });
    }

    // Process payment with payment gateway (simulated)
    const paymentResult = await processWithPaymentGateway(
      payment,
      paymentToken
    );

    if (paymentResult.success) {
      // Update payment status
      payment.status = "completed";
      payment.paymentDate = new Date();
      payment.gatewayTransactionId = paymentResult.transactionId;
      payment.gatewayResponse = paymentResult.response;

      // Save payment method if requested
      if (savePaymentMethod) {
        await saveUserPaymentMethod(req.user.userId, payment.paymentDetails);
      }

      await payment.save();

      // Update order payment status
      await Order.findByIdAndUpdate(payment.orderId, {
        paymentStatus: "paid",
      });

      // Create transaction record
      const transaction = new Transaction({
        paymentId: payment._id,
        userId: payment.userId,
        type: "sale",
        amount: payment.amount,
        currency: payment.currency,
        gatewayTransactionId: paymentResult.transactionId,
        gatewayResponse: paymentResult.response,
        status: "success",
        processedAt: new Date(),
      });
      await transaction.save();

      res.json({
        success: true,
        message: "Payment processed successfully",
        data: {
          payment,
          transaction: {
            id: transaction._id,
            gatewayTransactionId: transaction.gatewayTransactionId,
          },
        },
      });
    } else {
      // Payment failed
      payment.status = "failed";
      payment.gatewayResponse = paymentResult.response;
      payment.failureReason = paymentResult.error;
      await payment.save();

      // Create failed transaction record
      const transaction = new Transaction({
        paymentId: payment._id,
        userId: payment.userId,
        type: "sale",
        amount: payment.amount,
        currency: payment.currency,
        gatewayTransactionId:
          paymentResult.transactionId || `FAILED_${Date.now()}`,
        gatewayResponse: paymentResult.response,
        status: "failed",
        processedAt: new Date(),
      });
      await transaction.save();

      res.status(400).json({
        success: false,
        message: "Payment processing failed",
        error: paymentResult.error,
        data: {
          payment,
          retryPossible: true,
        },
      });
    }
  } catch (error) {
    console.error("Process payment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while processing payment",
      error: error.message,
    });
  }
};

// @desc    Get payment by ID
// @route   GET /api/payments/:paymentId
// @access  Private
const getPaymentById = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId)
      .populate("orderId", "orderNumber totals status shippingAddress")
      .populate("userId", "username email profile");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Get related transactions
    const transactions = await Transaction.find({ paymentId })
      .sort({ createdAt: -1 })
      .select("type amount status gatewayTransactionId processedAt");

    res.json({
      success: true,
      data: {
        payment,
        transactions,
      },
    });
  } catch (error) {
    console.error("Get payment by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching payment",
      error: error.message,
    });
  }
};

// @desc    Get user's payments
// @route   GET /api/payments
// @access  Private
const getUserPayments = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const {
      page = 1,
      limit = 10,
      status,
      paymentMethod,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const userId = req.user.userId;

    // Build filter
    const filter = { userId };
    if (status) filter.status = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "asc" ? 1 : -1;

    const payments = await Payment.find(filter)
      .sort(sortConfig)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("orderId", "orderNumber totals status");

    const totalPayments = await Payment.countDocuments(filter);

    // Get payment statistics for user
    const paymentStats = await Payment.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalPayments / limit),
          totalPayments,
          hasNext: page * limit < totalPayments,
          hasPrev: page > 1,
        },
        statistics: paymentStats,
      },
    });
  } catch (error) {
    console.error("Get user payments error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching payments",
      error: error.message,
    });
  }
};

// @desc    Get all payments (Admin)
// @route   GET /api/admin/payments
// @access  Private (Admin)
const getAllPayments = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const {
      page = 1,
      limit = 20,
      status,
      paymentMethod,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Amount range filter
    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) filter.amount.$gte = parseFloat(minAmount);
      if (maxAmount) filter.amount.$lte = parseFloat(maxAmount);
    }

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "asc" ? 1 : -1;

    const payments = await Payment.find(filter)
      .sort(sortConfig)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("orderId", "orderNumber totals")
      .populate("userId", "username email profile");

    const totalPayments = await Payment.countDocuments(filter);

    // Get payment statistics
    const paymentStats = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalPayments: { $sum: 1 },
          completedPayments: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          failedPayments: {
            $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
          },
          averageAmount: { $avg: "$amount" },
        },
      },
    ]);

    // Get payment method distribution
    const methodDistribution = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalPayments / limit),
          totalPayments,
          hasNext: page * limit < totalPayments,
          hasPrev: page > 1,
        },
        statistics: paymentStats[0] || {
          totalAmount: 0,
          totalPayments: 0,
          completedPayments: 0,
          failedPayments: 0,
          averageAmount: 0,
        },
        methodDistribution,
      },
    });
  } catch (error) {
    console.error("Get all payments error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching payments",
      error: error.message,
    });
  }
};

// @desc    Refund payment
// @route   POST /api/payments/:paymentId/refund
// @access  Private (Admin)
const refundPayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { paymentId } = req.params;
    const { refundAmount, reason } = req.body;

    const payment = await Payment.findById(paymentId).populate("orderId");
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Validate payment can be refunded
    if (payment.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Only completed payments can be refunded",
      });
    }

    // Calculate available refund amount
    const existingRefunds = await Transaction.find({
      paymentId,
      type: "refund",
      status: "success",
    });

    const totalRefunded = existingRefunds.reduce((sum, t) => sum + t.amount, 0);
    const availableForRefund = payment.amount - totalRefunded;
    const actualRefundAmount = refundAmount || availableForRefund;

    if (actualRefundAmount > availableForRefund) {
      return res.status(400).json({
        success: false,
        message: `Refund amount exceeds available balance. Maximum refundable: $${availableForRefund.toFixed(
          2
        )}`,
      });
    }

    // Process refund with payment gateway (simulated)
    const refundResult = await processRefundWithGateway(
      payment,
      actualRefundAmount
    );

    if (refundResult.success) {
      // Update payment status
      if (actualRefundAmount === availableForRefund) {
        payment.status = "refunded";
      } else {
        payment.status = "partially_refunded";
      }
      payment.refundAmount = (payment.refundAmount || 0) + actualRefundAmount;
      payment.refundDate = new Date();
      payment.refundReason = reason;
      await payment.save();

      // Update order payment status
      await Order.findByIdAndUpdate(payment.orderId, {
        paymentStatus:
          actualRefundAmount === availableForRefund
            ? "refunded"
            : "partially_refunded",
      });

      // Create refund transaction
      const refundTransaction = new Transaction({
        paymentId: payment._id,
        userId: payment.userId,
        type: "refund",
        amount: actualRefundAmount,
        currency: payment.currency,
        gatewayTransactionId: refundResult.transactionId,
        gatewayResponse: refundResult.response,
        status: "success",
        processedAt: new Date(),
        refundReason: reason,
      });
      await refundTransaction.save();

      res.json({
        success: true,
        message: "Refund processed successfully",
        data: {
          payment,
          refundTransaction,
          refundSummary: {
            refundedAmount: actualRefundAmount,
            totalRefunded: totalRefunded + actualRefundAmount,
            availableForRefund: availableForRefund - actualRefundAmount,
          },
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Refund processing failed",
        error: refundResult.error,
      });
    }
  } catch (error) {
    console.error("Refund payment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while processing refund",
      error: error.message,
    });
  }
};

// @desc    Update payment status (Admin)
// @route   PUT /api/admin/payments/:paymentId/status
// @access  Private (Admin)
const updatePaymentStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { paymentId } = req.params;
    const { status, refundAmount } = req.body;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Update payment status
    payment.status = status;

    if (status === "refunded" || status === "partially_refunded") {
      payment.refundAmount = refundAmount || payment.amount;
      payment.refundDate = new Date();
    }

    if (status === "completed" && !payment.paymentDate) {
      payment.paymentDate = new Date();
    }

    payment.updatedAt = new Date();
    await payment.save();

    // Update order payment status
    if (payment.orderId) {
      await Order.findByIdAndUpdate(payment.orderId, {
        paymentStatus: status,
      });
    }

    res.json({
      success: true,
      message: "Payment status updated successfully",
      data: {
        payment,
      },
    });
  } catch (error) {
    console.error("Update payment status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating payment status",
      error: error.message,
    });
  }
};

// @desc    Process payment webhook
// @route   POST /api/payments/webhook/:gateway
// @access  Public (Called by payment gateway)
const processWebhook = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error("Webhook validation failed:", errors.array());
      return res
        .status(400)
        .json({ success: false, message: "Invalid webhook data" });
    }

    const { gateway } = req.params;
    const { type, data, signature } = req.body;

    // Verify webhook signature (in real implementation)
    const isValidSignature = verifyWebhookSignature(
      gateway,
      req.rawBody,
      signature
    );
    if (!isValidSignature) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid signature" });
    }

    // Process webhook based on type
    switch (type) {
      case "payment.completed":
        await handlePaymentCompletedWebhook(gateway, data);
        break;

      case "payment.failed":
        await handlePaymentFailedWebhook(gateway, data);
        break;

      case "refund.completed":
        await handleRefundCompletedWebhook(gateway, data);
        break;

      default:
        console.log(`Unhandled webhook type: ${type}`);
    }

    // Always return 200 to acknowledge receipt
    res.json({ success: true, message: "Webhook processed" });
  } catch (error) {
    console.error("Process webhook error:", error);
    // Still return 200 to prevent retries from payment gateway
    res.json({ success: false, message: "Webhook processing failed" });
  }
};

// @desc    Bulk payment operations (Admin)
// @route   POST /api/admin/payments/bulk
// @access  Private (Admin)
const bulkPaymentOperation = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { paymentIds, action, data } = req.body;

    let result;
    switch (action) {
      case "export":
        const payments = await Payment.find({ _id: { $in: paymentIds } })
          .populate("orderId", "orderNumber totals")
          .populate("userId", "username email");

        result = {
          action: "export",
          recordCount: payments.length,
          data: payments,
        };
        break;

      case "refund":
        // Process refunds for multiple payments
        const refundResults = [];
        for (const paymentId of paymentIds) {
          try {
            const payment = await Payment.findById(paymentId);
            if (payment && payment.status === "completed") {
              // Process refund (simplified)
              payment.status = "refunded";
              payment.refundAmount = payment.amount;
              payment.refundDate = new Date();
              await payment.save();

              refundResults.push({
                paymentId,
                status: "success",
                message: "Refund processed",
              });
            } else {
              refundResults.push({
                paymentId,
                status: "failed",
                message: "Payment not eligible for refund",
              });
            }
          } catch (error) {
            refundResults.push({
              paymentId,
              status: "error",
              message: error.message,
            });
          }
        }
        result = {
          action: "refund",
          results: refundResults,
        };
        break;

      case "update_status":
        if (!data || !data.status) {
          return res.status(400).json({
            success: false,
            message: "Status is required for update_status action",
          });
        }

        const updateResult = await Payment.updateMany(
          { _id: { $in: paymentIds } },
          {
            $set: {
              status: data.status,
              updatedAt: new Date(),
            },
          }
        );

        result = {
          action: "update_status",
          modifiedCount: updateResult.modifiedCount,
        };
        break;

      case "analyze":
        const analysis = await Payment.aggregate([
          {
            $match: {
              _id: {
                $in: paymentIds.map((id) => new mongoose.Types.ObjectId(id)),
              },
            },
          },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: "$amount" },
              averageAmount: { $avg: "$amount" },
              statusBreakdown: {
                $push: {
                  status: "$status",
                  amount: "$amount",
                  paymentMethod: "$paymentMethod",
                },
              },
            },
          },
        ]);

        result = {
          action: "analyze",
          analysis: analysis[0] || {},
        };
        break;

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid action",
        });
    }

    res.json({
      success: true,
      message: `Bulk operation completed: ${action}`,
      data: result,
    });
  } catch (error) {
    console.error("Bulk payment operation error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while performing bulk operation",
      error: error.message,
    });
  }
};

// Helper functions
const sanitizePaymentDetails = (paymentDetails, paymentMethod) => {
  // Remove sensitive data and keep only what's needed
  const sanitized = { ...paymentDetails };

  if (paymentMethod.includes("card")) {
    // Keep only last 4 digits of card number
    if (sanitized.cardNumber) {
      sanitized.last4 = sanitized.cardNumber.slice(-4);
      delete sanitized.cardNumber;
    }
    // Never store CVV
    delete sanitized.cvv;
  }

  return sanitized;
};

const processWithPaymentGateway = async (payment, paymentToken) => {
  // Simulate payment gateway processing
  // In real implementation, integrate with Stripe, PayPal, etc.

  try {
    // Simulate API call to payment gateway
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Simulate success 95% of the time
    const isSuccess = Math.random() < 0.95;

    if (isSuccess) {
      return {
        success: true,
        transactionId: `TXN_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        response: {
          gateway: "simulated_gateway",
          status: "succeeded",
          authorizationCode: `AUTH_${Math.random().toString(36).substr(2, 8)}`,
        },
      };
    } else {
      return {
        success: false,
        error: "Insufficient funds",
        response: {
          gateway: "simulated_gateway",
          status: "failed",
          decline_code: "insufficient_funds",
        },
      };
    }
  } catch (error) {
    return {
      success: false,
      error: "Payment gateway error",
      response: {
        gateway: "simulated_gateway",
        status: "error",
        error: error.message,
      },
    };
  }
};

const processRefundWithGateway = async (payment, refundAmount) => {
  // Simulate refund processing with payment gateway
  try {
    await new Promise((resolve) => setTimeout(resolve, 800));

    return {
      success: true,
      transactionId: `REF_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`,
      response: {
        gateway: "simulated_gateway",
        status: "succeeded",
        refund_amount: refundAmount,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: "Refund processing failed",
      response: {
        gateway: "simulated_gateway",
        status: "failed",
      },
    };
  }
};

const saveUserPaymentMethod = async (userId, paymentDetails) => {
  // In real implementation, save to user's payment methods
  // For now, just log it
  console.log(`Saving payment method for user ${userId}`);
};

const verifyWebhookSignature = (gateway, rawBody, signature) => {
  // In real implementation, verify webhook signature from payment gateway
  // For demo purposes, always return true
  return true;
};

const handlePaymentCompletedWebhook = async (gateway, data) => {
  // Update payment and order status based on webhook data
  const { payment_id, amount, currency } = data;

  // Find payment by gateway transaction ID
  const payment = await Payment.findOne({ gatewayTransactionId: payment_id });
  if (payment && payment.status === "pending") {
    payment.status = "completed";
    payment.paymentDate = new Date();
    await payment.save();

    // Update order
    await Order.findByIdAndUpdate(payment.orderId, {
      paymentStatus: "paid",
    });

    // Create transaction record
    await Transaction.create({
      paymentId: payment._id,
      userId: payment.userId,
      type: "sale",
      amount: amount || payment.amount,
      currency: currency || payment.currency,
      gatewayTransactionId: payment_id,
      gatewayResponse: data,
      status: "success",
      processedAt: new Date(),
    });
  }
};

const handlePaymentFailedWebhook = async (gateway, data) => {
  const { payment_id, error } = data;

  const payment = await Payment.findOne({ gatewayTransactionId: payment_id });
  if (payment && payment.status === "pending") {
    payment.status = "failed";
    payment.failureReason = error?.message || "Payment failed";
    await payment.save();

    await Transaction.create({
      paymentId: payment._id,
      userId: payment.userId,
      type: "sale",
      amount: payment.amount,
      currency: payment.currency,
      gatewayTransactionId: payment_id,
      gatewayResponse: data,
      status: "failed",
      processedAt: new Date(),
    });
  }
};

const handleRefundCompletedWebhook = async (gateway, data) => {
  const { refund_id, payment_id, amount } = data;

  const payment = await Payment.findOne({ gatewayTransactionId: payment_id });
  if (payment) {
    const refundAmount = parseFloat(amount);
    const totalRefunded = (payment.refundAmount || 0) + refundAmount;

    if (totalRefunded >= payment.amount) {
      payment.status = "refunded";
    } else {
      payment.status = "partially_refunded";
    }

    payment.refundAmount = totalRefunded;
    payment.refundDate = new Date();
    await payment.save();

    // Update order
    await Order.findByIdAndUpdate(payment.orderId, {
      paymentStatus: payment.status,
    });

    // Create refund transaction
    await Transaction.create({
      paymentId: payment._id,
      userId: payment.userId,
      type: "refund",
      amount: refundAmount,
      currency: payment.currency,
      gatewayTransactionId: refund_id,
      gatewayResponse: data,
      status: "success",
      processedAt: new Date(),
    });
  }
};

module.exports = {
  createPayment,
  processPayment,
  getPaymentById,
  getUserPayments,
  getAllPayments,
  refundPayment,
  updatePaymentStatus,
  processWebhook,
  bulkPaymentOperation,
};
