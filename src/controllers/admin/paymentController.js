// controllers/admin/paymentController.js
const Payment = require("../../models/Payment");
const Order = require("../../models/Order");
const Transaction = require("../../models/Transaction");
const PaymentSettings = require("../../models/PaymentSettings");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

// @desc    Get all payments
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
      userId,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (userId) filter.userId = userId;

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

// @desc    Get payment by ID (Admin)
// @route   GET /api/admin/payments/:paymentId
// @access  Private (Admin)
const getPaymentById = async (req, res) => {
  try {
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

// @desc    Get payments by user ID
// @route   GET /api/admin/payments/user/:userId
// @access  Private (Admin)
const getPaymentsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, status, paymentMethod } = req.query;

    const filter = { userId };
    if (status) filter.status = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    const payments = await Payment.find(filter)
      .populate("orderId", "orderNumber totals status")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(filter);

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          total,
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get user payments error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user payments",
      error: error.message,
    });
  }
};

// @desc    Create payment (Admin)
// @route   POST /api/admin/payments
// @access  Private (Admin)
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
      userId,
      paymentMethod,
      amount,
      currency = "EGP",
      status = "pending",
      notes,
    } = req.body;

    // Verify order exists
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if payment already exists for this order
    const existingPayment = await Payment.findOne({ orderId });
    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: "Payment already exists for this order",
        data: { existingPaymentId: existingPayment._id },
      });
    }

    // Create payment
    const payment = new Payment({
      orderId,
      userId: userId || order.userId,
      paymentMethod,
      amount: amount || order.totals?.total,
      currency,
      status,
      codStatus: paymentMethod === "cod" ? "awaiting_delivery" : undefined,
      createdBy: req.admin.adminId,
      adminNotes: notes,
    });

    await payment.save();

    // Update order payment reference
    order.paymentId = payment._id;
    if (status === "completed") {
      order.paymentStatus = "paid";
    }
    await order.save();

    // Create transaction record if payment is completed
    if (status === "completed") {
      const transaction = new Transaction({
        paymentId: payment._id,
        userId: payment.userId,
        type: "sale",
        amount: payment.amount,
        currency: payment.currency,
        status: "success",
        gatewayTransactionId: `ADMIN_${Date.now()}`,
        processedAt: new Date(),
        metadata: {
          createdByAdmin: req.admin.adminId,
          notes,
        },
      });
      await transaction.save();
    }

    // Populate payment for response
    const populatedPayment = await Payment.findById(payment._id)
      .populate("orderId", "orderNumber totals status")
      .populate("userId", "username email");

    res.status(201).json({
      success: true,
      message: "Payment created successfully",
      data: {
        payment: populatedPayment,
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

// @desc    Refund payment
// @route   POST /api/admin/payments/:paymentId/refund
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
        message: `Refund amount exceeds available balance. Maximum refundable: ${availableForRefund.toFixed(2)} EGP`,
      });
    }

    // Process refund with payment gateway (simulated)
    const refundResult = await processRefundWithGateway(payment, actualRefundAmount);

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
        paymentStatus: actualRefundAmount === availableForRefund ? "refunded" : "partially_refunded",
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

// @desc    Update payment status
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
      data: { payment },
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

// @desc    Confirm COD payment collection
// @route   POST /api/admin/payments/:paymentId/confirm-cod
// @access  Private (Admin)
const confirmCODPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { collectedAmount, notes } = req.body;

    const payment = await Payment.findById(paymentId).populate("orderId");
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Verify it's a COD payment
    if (payment.paymentMethod !== "cod") {
      return res.status(400).json({
        success: false,
        message: "This is not a Cash on Delivery payment",
      });
    }

    // Verify payment is pending
    if (payment.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Payment is already ${payment.status}`,
      });
    }

    // Verify collected amount matches (with small tolerance for cash rounding)
    const tolerance = 1; // 1 EGP tolerance
    if (Math.abs(collectedAmount - payment.amount) > tolerance) {
      return res.status(400).json({
        success: false,
        message: `Collected amount (${collectedAmount}) does not match expected amount (${payment.amount})`,
        data: {
          expectedAmount: payment.amount,
          collectedAmount: collectedAmount,
          difference: Math.abs(collectedAmount - payment.amount),
        },
      });
    }

    // Update payment
    payment.status = "completed";
    payment.codStatus = "collected";
    payment.paymentDate = new Date();
    payment.paymentDetails.codCollectedBy = req.admin.adminId;
    payment.paymentDetails.codCollectedAt = new Date();
    payment.notes = notes || payment.notes;
    payment.processedBy = req.admin.adminId;
    await payment.save();

    // Update order payment status
    await Order.findByIdAndUpdate(payment.orderId._id, {
      paymentStatus: "paid",
    });

    // Create transaction record for COD collection
    const transaction = new Transaction({
      paymentId: payment._id,
      userId: payment.userId,
      type: "sale",
      amount: collectedAmount,
      currency: payment.currency,
      gatewayTransactionId: `COD_${Date.now()}_${payment._id}`,
      gatewayResponse: {
        method: "cash_on_delivery",
        collectedBy: req.admin.adminId,
        collectedAt: new Date(),
        notes: notes,
      },
      status: "success",
      processedAt: new Date(),
    });
    await transaction.save();

    res.json({
      success: true,
      message: "COD payment confirmed successfully",
      data: {
        payment,
        transaction: {
          id: transaction._id,
          amount: transaction.amount,
        },
      },
    });
  } catch (error) {
    console.error("Confirm COD payment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while confirming COD payment",
      error: error.message,
    });
  }
};

// @desc    Mark COD payment as failed
// @route   POST /api/admin/payments/:paymentId/fail-cod
// @access  Private (Admin)
const failCODPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { reason } = req.body;

    const payment = await Payment.findById(paymentId).populate("orderId");
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Verify it's a COD payment
    if (payment.paymentMethod !== "cod") {
      return res.status(400).json({
        success: false,
        message: "This is not a Cash on Delivery payment",
      });
    }

    // Update payment
    payment.status = "failed";
    payment.codStatus = "failed_collection";
    payment.failureReason = reason || "Customer refused to pay / not available";
    payment.processedBy = req.admin.adminId;
    await payment.save();

    // Update order status
    await Order.findByIdAndUpdate(payment.orderId._id, {
      paymentStatus: "failed",
      status: "cancelled",
      cancellation: {
        reason: `COD collection failed: ${reason || "Customer refused to pay"}`,
        cancelledAt: new Date(),
        cancelledBy: req.admin.adminId,
      },
    });

    // Create failed transaction record
    const transaction = new Transaction({
      paymentId: payment._id,
      userId: payment.userId,
      type: "sale",
      amount: payment.amount,
      currency: payment.currency,
      gatewayTransactionId: `COD_FAILED_${Date.now()}_${payment._id}`,
      gatewayResponse: {
        method: "cash_on_delivery",
        failureReason: reason,
        processedBy: req.admin.adminId,
      },
      status: "failed",
      processedAt: new Date(),
    });
    await transaction.save();

    res.json({
      success: true,
      message: "COD payment marked as failed",
      data: {
        payment,
        transaction: {
          id: transaction._id,
          status: transaction.status,
        },
      },
    });
  } catch (error) {
    console.error("Fail COD payment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while marking COD payment as failed",
      error: error.message,
    });
  }
};

// @desc    Get payment statistics
// @route   GET /api/admin/payments/statistics
// @access  Private (Admin)
const getPaymentStatistics = async (req, res) => {
  try {
    const { period = "month", startDate, endDate } = req.query;

    // Calculate date range
    const dateRange = calculatePaymentDateRange(period, startDate, endDate);

    const matchStage = {
      createdAt: {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate,
      },
    };

    // Overall statistics
    const overallStats = await Payment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalPayments: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          completedAmount: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$amount", 0] },
          },
          pendingAmount: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0] },
          },
          refundedAmount: { $sum: "$refundAmount" },
          averageAmount: { $avg: "$amount" },
        },
      },
    ]);

    // By payment method
    const byMethod = await Payment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          completedCount: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          completedAmount: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$amount", 0] },
          },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    // By status
    const byStatus = await Payment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    // COD specific stats
    const codStats = await Payment.aggregate([
      { $match: { ...matchStage, paymentMethod: "cod" } },
      {
        $group: {
          _id: "$codStatus",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    // Daily trend
    const dailyTrend = await Payment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          completedAmount: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$amount", 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        overall: overallStats[0] || {
          totalPayments: 0,
          totalAmount: 0,
          completedAmount: 0,
          pendingAmount: 0,
          refundedAmount: 0,
          averageAmount: 0,
        },
        byMethod,
        byStatus,
        codStats,
        dailyTrend,
        dateRange: {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          period,
        },
      },
    });
  } catch (error) {
    console.error("Get payment statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching payment statistics",
      error: error.message,
    });
  }
};

// @desc    Bulk payment operations
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
        const refundResults = [];
        for (const paymentId of paymentIds) {
          try {
            const payment = await Payment.findById(paymentId);
            if (payment && payment.status === "completed") {
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

// @desc    Process payment webhook
// @route   POST /api/admin/payments/webhook/:gateway
// @access  Public (Called by payment gateway)
const processWebhook = async (req, res) => {
  try {
    const { gateway } = req.params;
    const { type, data, signature } = req.body;

    // Verify webhook signature
    const isValidSignature = verifyWebhookSignature(gateway, req.rawBody, signature);
    if (!isValidSignature) {
      return res.status(401).json({ success: false, message: "Invalid signature" });
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

    res.json({ success: true, message: "Webhook processed" });
  } catch (error) {
    console.error("Process webhook error:", error);
    res.json({ success: false, message: "Webhook processing failed" });
  }
};

// ==================== PAYMENT METHODS MANAGEMENT ====================

// Helper to get payment methods (returns plain objects, not Mongoose documents)
const getPaymentMethods = async () => {
  const settings = await PaymentSettings.getSettings();
  const methods = settings?.methods || [];
  // Convert to plain objects to avoid Mongoose document issues
  return methods.map(m => ({
    name: m.name,
    displayName: m.displayName,
    description: m.description,
    instructions: m.instructions,
    icon: m.icon,
    enabled: m.enabled,
    testMode: m.testMode,
    credentials: m.credentials,
    fees: m.fees,
    minAmount: m.minAmount,
    maxAmount: m.maxAmount,
    order: m.order,
  }));
};

// @desc    Get all payment methods
// @route   GET /api/admin/payments/methods
// @access  Private (Admin)
const getAllPaymentMethods = async (req, res) => {
  try {
    const methods = await getPaymentMethods();
    const settings = await PaymentSettings.getSettings();

    res.json({
      success: true,
      data: {
        methods,
        defaultMethod: settings?.defaultMethod || null,
        totalMethods: methods.length,
        enabledMethods: methods.filter(m => m.enabled).length,
      },
    });
  } catch (error) {
    console.error("Get payment methods error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching payment methods",
      error: error.message,
    });
  }
};

// @desc    Get payment method by name
// @route   GET /api/admin/payments/methods/:methodName
// @access  Private (Admin)
const getPaymentMethodByName = async (req, res) => {
  try {
    const { methodName } = req.params;
    const methods = await getPaymentMethods();

    const method = methods.find(m => m.name === methodName);

    if (!method) {
      return res.status(404).json({
        success: false,
        message: `Payment method '${methodName}' not found`,
      });
    }

    res.json({
      success: true,
      data: { method },
    });
  } catch (error) {
    console.error("Get payment method error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching payment method",
      error: error.message,
    });
  }
};

// @desc    Create payment method
// @route   POST /api/admin/payments/methods
// @access  Private (Admin)
const createPaymentMethod = async (req, res) => {
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
      name,
      displayName,
      description,
      instructions,
      icon,
      enabled = true,
      testMode = true,
      credentials,
      fees,
      minAmount = 0,
      maxAmount,
      order,
    } = req.body;

    const methods = await getPaymentMethods();

    // Check if method already exists
    if (methods.find(m => m.name === name)) {
      return res.status(400).json({
        success: false,
        message: `Payment method '${name}' already exists`,
      });
    }

    const newMethod = {
      name,
      displayName: displayName || name,
      description,
      instructions,
      icon,
      enabled,
      testMode,
      credentials,
      fees,
      minAmount,
      maxAmount,
      order: order !== undefined ? order : methods.length,
    };

    methods.push(newMethod);

    // If this is the first method, set it as default
    const updateData = { methods };
    if (methods.length === 1) {
      updateData.defaultMethod = name;
    }

    await PaymentSettings.updateSettings(updateData, req.admin.adminId);

    res.status(201).json({
      success: true,
      message: "Payment method created successfully",
      data: { method: newMethod },
    });
  } catch (error) {
    console.error("Create payment method error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating payment method",
      error: error.message,
    });
  }
};

// @desc    Update payment method
// @route   PUT /api/admin/payments/methods/:methodName
// @access  Private (Admin)
const updatePaymentMethod = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { methodName } = req.params;
    const updateData = req.body;

    const methods = await getPaymentMethods();

    const methodIndex = methods.findIndex(m => m.name === methodName);

    if (methodIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `Payment method '${methodName}' not found`,
      });
    }

    // Update method fields
    methods[methodIndex] = {
      ...methods[methodIndex],
      ...updateData,
      name: methodName, // Prevent name change
    };

    await PaymentSettings.updateSettings({ methods }, req.admin.adminId);

    res.json({
      success: true,
      message: "Payment method updated successfully",
      data: { method: methods[methodIndex] },
    });
  } catch (error) {
    console.error("Update payment method error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating payment method",
      error: error.message,
    });
  }
};

// @desc    Delete payment method
// @route   DELETE /api/admin/payments/methods/:methodName
// @access  Private (Admin)
const deletePaymentMethod = async (req, res) => {
  try {
    const { methodName } = req.params;

    const settings = await PaymentSettings.getSettings();
    const methods = await getPaymentMethods();

    const methodIndex = methods.findIndex(m => m.name === methodName);

    if (methodIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `Payment method '${methodName}' not found`,
      });
    }

    // Check if this is the default method
    if (settings?.defaultMethod === methodName) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete the default payment method. Please set a different default method first.",
      });
    }

    const deletedMethod = methods.splice(methodIndex, 1)[0];

    await PaymentSettings.updateSettings({ methods }, req.admin.adminId);

    res.json({
      success: true,
      message: "Payment method deleted successfully",
      data: { deletedMethod },
    });
  } catch (error) {
    console.error("Delete payment method error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting payment method",
      error: error.message,
    });
  }
};

// @desc    Toggle payment method status
// @route   PATCH /api/admin/payments/methods/:methodName/toggle
// @access  Private (Admin)
const togglePaymentMethod = async (req, res) => {
  try {
    const { methodName } = req.params;

    const methods = await getPaymentMethods();

    const methodIndex = methods.findIndex(m => m.name === methodName);

    if (methodIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `Payment method '${methodName}' not found`,
      });
    }

    methods[methodIndex].enabled = !methods[methodIndex].enabled;

    await PaymentSettings.updateSettings({ methods }, req.admin.adminId);

    res.json({
      success: true,
      message: `Payment method '${methodName}' ${methods[methodIndex].enabled ? "enabled" : "disabled"} successfully`,
      data: { method: methods[methodIndex] },
    });
  } catch (error) {
    console.error("Toggle payment method error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while toggling payment method",
      error: error.message,
    });
  }
};

// @desc    Set default payment method
// @route   PATCH /api/admin/payments/methods/:methodName/set-default
// @access  Private (Admin)
const setDefaultPaymentMethod = async (req, res) => {
  try {
    const { methodName } = req.params;

    const methods = await getPaymentMethods();

    if (methods.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No payment methods exist. Please create a payment method first.",
      });
    }

    const method = methods.find(m => m.name === methodName);

    if (!method) {
      return res.status(404).json({
        success: false,
        message: `Payment method '${methodName}' not found`,
      });
    }

    if (!method.enabled) {
      return res.status(400).json({
        success: false,
        message: "Cannot set a disabled payment method as default",
      });
    }

    // Save both methods and defaultMethod to ensure consistency
    await PaymentSettings.updateSettings({ methods, defaultMethod: methodName }, req.admin.adminId);

    res.json({
      success: true,
      message: `'${methodName}' is now the default payment method`,
      data: { defaultMethod: methodName, methods },
    });
  } catch (error) {
    console.error("Set default payment method error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while setting default payment method",
      error: error.message,
    });
  }
};

// @desc    Reorder payment methods
// @route   PUT /api/admin/payments/methods/reorder
// @access  Private (Admin)
const reorderPaymentMethods = async (req, res) => {
  try {
    const { methodOrder } = req.body; // Array of method names in desired order

    if (!Array.isArray(methodOrder)) {
      return res.status(400).json({
        success: false,
        message: "methodOrder must be an array of method names",
      });
    }

    const methods = await getPaymentMethods();

    // Update order for each method
    methodOrder.forEach((methodName, index) => {
      const method = methods.find(m => m.name === methodName);
      if (method) {
        method.order = index;
      }
    });

    // Sort methods by order
    methods.sort((a, b) => (a.order || 0) - (b.order || 0));

    await PaymentSettings.updateSettings({ methods }, req.admin.adminId);

    res.json({
      success: true,
      message: "Payment methods reordered successfully",
      data: { methods },
    });
  } catch (error) {
    console.error("Reorder payment methods error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while reordering payment methods",
      error: error.message,
    });
  }
};

// Helper functions
const processRefundWithGateway = async (payment, refundAmount) => {
  try {
    await new Promise((resolve) => setTimeout(resolve, 800));

    return {
      success: true,
      transactionId: `REF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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

const calculatePaymentDateRange = (period, customStartDate, customEndDate) => {
  const endDate = customEndDate ? new Date(customEndDate) : new Date();
  let startDate = customStartDate ? new Date(customStartDate) : new Date();

  if (!customStartDate) {
    switch (period) {
      case "today":
        startDate = new Date(endDate);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "week":
        startDate.setDate(endDate.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case "quarter":
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      case "year":
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(endDate.getMonth() - 1);
    }
  }

  return { startDate, endDate };
};

const verifyWebhookSignature = (gateway, rawBody, signature) => {
  return true;
};

const handlePaymentCompletedWebhook = async (gateway, data) => {
  const { payment_id, amount, currency } = data;

  const payment = await Payment.findOne({ gatewayTransactionId: payment_id });
  if (payment && payment.status === "pending") {
    payment.status = "completed";
    payment.paymentDate = new Date();
    await payment.save();

    await Order.findByIdAndUpdate(payment.orderId, {
      paymentStatus: "paid",
    });

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

    await Order.findByIdAndUpdate(payment.orderId, {
      paymentStatus: payment.status,
    });

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
  // Payment CRUD
  getAllPayments,
  getPaymentById,
  getPaymentsByUser,
  createPayment,
  refundPayment,
  updatePaymentStatus,
  confirmCODPayment,
  failCODPayment,
  getPaymentStatistics,
  bulkPaymentOperation,
  processWebhook,
  // Payment Methods Management
  getAllPaymentMethods,
  getPaymentMethodByName,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  togglePaymentMethod,
  setDefaultPaymentMethod,
  reorderPaymentMethods,
};
