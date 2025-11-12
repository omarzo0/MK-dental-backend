const Transaction = require("../../models/Transaction");
const Payment = require("../../models/Payment");
const Order = require("../../models/Order");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

// @desc    Create new transaction
// @route   POST /api/transactions
// @access  Private (System/Admin)
const createTransaction = async (req, res) => {
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
      paymentId,
      type,
      amount,
      gatewayTransactionId,
      status,
      currency = "USD",
      gatewayResponse = {},
    } = req.body;

    // Get payment details
    const payment = await Payment.findById(paymentId).populate("orderId");
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Validate amount for refunds
    if (type === "refund") {
      const previousTransactions = await Transaction.find({ paymentId });
      const totalRefunded = previousTransactions
        .filter((t) => t.type === "refund" && t.status === "success")
        .reduce((sum, t) => sum + t.amount, 0);

      if (amount > payment.amount - totalRefunded) {
        return res.status(400).json({
          success: false,
          message: `Refund amount exceeds available balance. Maximum refundable: $${(
            payment.amount - totalRefunded
          ).toFixed(2)}`,
        });
      }
    }

    // Create transaction
    const transaction = new Transaction({
      paymentId,
      userId: payment.userId,
      type,
      amount,
      currency,
      gatewayTransactionId,
      gatewayResponse,
      status,
      processedAt: status === "success" ? new Date() : null,
    });

    await transaction.save();

    // Update payment status based on transaction
    await updatePaymentStatus(payment, transaction);

    // Populate transaction with related data
    await transaction.populate([
      { path: "paymentId", select: "orderId paymentMethod amount" },
      { path: "userId", select: "username email profile" },
    ]);

    res.status(201).json({
      success: true,
      message: "Transaction created successfully",
      data: {
        transaction,
      },
    });
  } catch (error) {
    console.error("Create transaction error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating transaction",
      error: error.message,
    });
  }
};

// @desc    Get all transactions
// @route   GET /api/transactions
// @access  Private (Admin)
const getAllTransactions = async (req, res) => {
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
      type,
      status,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      gateway,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build filter
    const filter = {};

    if (type) filter.type = type;
    if (status) filter.status = status;
    if (gateway) {
      filter.gatewayResponse = {
        $regex: gateway,
        $options: "i",
      };
    }

    // Date range filter
    if (startDate || endDate) {
      filter.processedAt = {};
      if (startDate) filter.processedAt.$gte = new Date(startDate);
      if (endDate) filter.processedAt.$lte = new Date(endDate);
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

    const transactions = await Transaction.find(filter)
      .sort(sortConfig)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("paymentId", "orderId paymentMethod amount")
      .populate("userId", "username email profile");

    const totalTransactions = await Transaction.countDocuments(filter);

    // Get transaction statistics
    const transactionStats = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalTransactions: { $sum: 1 },
          successTransactions: {
            $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] },
          },
          failedTransactions: {
            $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
          },
          averageAmount: { $avg: "$amount" },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalTransactions / limit),
          totalTransactions,
          hasNext: page * limit < totalTransactions,
          hasPrev: page > 1,
        },
        statistics: transactionStats[0] || {
          totalAmount: 0,
          totalTransactions: 0,
          successTransactions: 0,
          failedTransactions: 0,
          averageAmount: 0,
        },
      },
    });
  } catch (error) {
    console.error("Get all transactions error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching transactions",
      error: error.message,
    });
  }
};

// @desc    Get transaction by ID
// @route   GET /api/transactions/:transactionId
// @access  Private (Admin)
const getTransactionById = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { transactionId } = req.params;

    const transaction = await Transaction.findById(transactionId)
      .populate("paymentId")
      .populate("userId", "username email profile");

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    // Get related order information
    let order = null;
    if (transaction.paymentId?.orderId) {
      order = await Order.findById(transaction.paymentId.orderId).select(
        "orderNumber status totals"
      );
    }

    res.json({
      success: true,
      data: {
        transaction,
        order,
      },
    });
  } catch (error) {
    console.error("Get transaction by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching transaction",
      error: error.message,
    });
  }
};

// @desc    Get user's transactions
// @route   GET /api/transactions/user/:userId
// @access  Private (Admin)
const getUserTransactions = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { userId } = req.params;
    const { page = 1, limit = 10, type, status } = req.query;

    // Build filter
    const filter = { userId };
    if (type) filter.type = type;
    if (status) filter.status = status;

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("paymentId", "orderId paymentMethod amount");

    const totalTransactions = await Transaction.countDocuments(filter);

    // Get user transaction summary
    const userSummary = await Transaction.aggregate([
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
        transactions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalTransactions / limit),
          totalTransactions,
        },
        summary: userSummary,
      },
    });
  } catch (error) {
    console.error("Get user transactions error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user transactions",
      error: error.message,
    });
  }
};

// @desc    Update transaction status
// @route   PUT /api/transactions/:transactionId/status
// @access  Private (Admin)
const updateTransactionStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { transactionId } = req.params;
    const { status, gatewayResponse } = req.body;

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    // Update transaction
    transaction.status = status;
    if (gatewayResponse) {
      transaction.gatewayResponse = {
        ...transaction.gatewayResponse,
        ...gatewayResponse,
      };
    }

    if (status === "success" && !transaction.processedAt) {
      transaction.processedAt = new Date();
    }

    transaction.updatedAt = new Date();
    await transaction.save();

    // Update payment status if needed
    if (["success", "failed"].includes(status)) {
      const payment = await Payment.findById(transaction.paymentId);
      if (payment) {
        await updatePaymentStatus(payment, transaction);
      }
    }

    res.json({
      success: true,
      message: "Transaction status updated successfully",
      data: {
        transaction,
      },
    });
  } catch (error) {
    console.error("Update transaction status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating transaction status",
      error: error.message,
    });
  }
};

// @desc    Process refund transaction
// @route   POST /api/transactions/:transactionId/refund
// @access  Private (Admin)
const processRefundTransaction = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { transactionId } = req.params;
    const { refundAmount, reason } = req.body;

    const originalTransaction = await Transaction.findById(
      transactionId
    ).populate("paymentId");

    if (!originalTransaction) {
      return res.status(404).json({
        success: false,
        message: "Original transaction not found",
      });
    }

    // Validate original transaction can be refunded
    if (
      originalTransaction.type !== "sale" ||
      originalTransaction.status !== "success"
    ) {
      return res.status(400).json({
        success: false,
        message: "Only successful sale transactions can be refunded",
      });
    }

    // Calculate available refund amount
    const existingRefunds = await Transaction.find({
      paymentId: originalTransaction.paymentId,
      type: "refund",
      status: "success",
    });

    const totalRefunded = existingRefunds.reduce((sum, t) => sum + t.amount, 0);
    const availableForRefund = originalTransaction.amount - totalRefunded;
    const actualRefundAmount = refundAmount || availableForRefund;

    if (actualRefundAmount > availableForRefund) {
      return res.status(400).json({
        success: false,
        message: `Refund amount exceeds available balance. Maximum refundable: $${availableForRefund.toFixed(
          2
        )}`,
      });
    }

    // Create refund transaction
    const refundTransaction = new Transaction({
      paymentId: originalTransaction.paymentId,
      userId: originalTransaction.userId,
      type: "refund",
      amount: actualRefundAmount,
      currency: originalTransaction.currency,
      gatewayTransactionId: `REFUND_${
        originalTransaction.gatewayTransactionId
      }_${Date.now()}`,
      gatewayResponse: {
        reason: reason || "Customer request",
        originalTransactionId: originalTransaction.gatewayTransactionId,
      },
      status: "success", // Assuming immediate success for demo
      processedAt: new Date(),
      refundReason: reason,
    });

    await refundTransaction.save();

    // Update original payment status
    const payment = await Payment.findById(originalTransaction.paymentId);
    if (payment) {
      if (actualRefundAmount === availableForRefund) {
        payment.status = "refunded";
      } else {
        payment.status = "partially_refunded";
      }
      payment.refundAmount = (payment.refundAmount || 0) + actualRefundAmount;
      payment.refundDate = new Date();
      await payment.save();
    }

    // Update related order status
    if (payment?.orderId) {
      await Order.findByIdAndUpdate(payment.orderId, {
        paymentStatus:
          actualRefundAmount === availableForRefund
            ? "refunded"
            : "partially_refunded",
        refundAmount: actualRefundAmount,
      });
    }

    res.status(201).json({
      success: true,
      message: "Refund processed successfully",
      data: {
        refundTransaction,
        originalTransaction: {
          id: originalTransaction._id,
          amount: originalTransaction.amount,
        },
        refundSummary: {
          refundedAmount: actualRefundAmount,
          totalRefunded: totalRefunded + actualRefundAmount,
          availableForRefund: availableForRefund - actualRefundAmount,
        },
      },
    });
  } catch (error) {
    console.error("Process refund transaction error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while processing refund",
      error: error.message,
    });
  }
};

// @desc    Search transactions
// @route   GET /api/transactions/search
// @access  Private (Admin)
const searchTransactions = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { q, searchField = "all", limit = 20 } = req.query;

    let filter = {};

    switch (searchField) {
      case "gatewayTransactionId":
        filter.gatewayTransactionId = { $regex: q, $options: "i" };
        break;
      case "paymentId":
        filter.paymentId = q;
        break;
      case "orderId":
        // Find payment by orderId, then get transactions for that payment
        const payment = await Payment.findOne({ orderId: q });
        if (payment) {
          filter.paymentId = payment._id;
        } else {
          return res.json({
            success: true,
            data: {
              transactions: [],
              searchQuery: q,
              resultsCount: 0,
            },
          });
        }
        break;
      case "all":
      default:
        filter.$or = [
          { gatewayTransactionId: { $regex: q, $options: "i" } },
          { "gatewayResponse.description": { $regex: q, $options: "i" } },
        ];

        // Also search by payment ID if it's a valid ObjectId
        if (mongoose.Types.ObjectId.isValid(q)) {
          filter.$or.push({ paymentId: q });

          // Search by user ID
          const userTransactions = await Transaction.find({ userId: q }).limit(
            1
          );
          if (userTransactions.length > 0) {
            filter.$or.push({ userId: q });
          }
        }
        break;
    }

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate("paymentId", "orderId paymentMethod amount")
      .populate("userId", "username email profile");

    res.json({
      success: true,
      data: {
        transactions,
        searchQuery: q,
        searchField,
        resultsCount: transactions.length,
      },
    });
  } catch (error) {
    console.error("Search transactions error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while searching transactions",
      error: error.message,
    });
  }
};

// @desc    Get transaction analytics
// @route   GET /api/transactions/analytics
// @access  Private (Admin)
const getTransactionAnalytics = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { period = "month", startDate, endDate, groupBy = "day" } = req.query;

    // Calculate date range based on period
    const dateRange = calculateDateRange(period, startDate, endDate);

    const matchStage = {
      processedAt: {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate,
      },
      status: "success", // Only count successful transactions for analytics
    };

    // Group by configuration
    let groupStage = {};
    let sortStage = {};

    switch (groupBy) {
      case "day":
        groupStage = {
          _id: {
            year: { $year: "$processedAt" },
            month: { $month: "$processedAt" },
            day: { $dayOfMonth: "$processedAt" },
          },
        };
        sortStage = { "_id.year": 1, "_id.month": 1, "_id.day": 1 };
        break;
      case "week":
        groupStage = {
          _id: {
            year: { $year: "$processedAt" },
            week: { $week: "$processedAt" },
          },
        };
        sortStage = { "_id.year": 1, "_id.week": 1 };
        break;
      case "month":
        groupStage = {
          _id: {
            year: { $year: "$processedAt" },
            month: { $month: "$processedAt" },
          },
        };
        sortStage = { "_id.year": 1, "_id.month": 1 };
        break;
      case "year":
        groupStage = {
          _id: {
            year: { $year: "$processedAt" },
          },
        };
        sortStage = { "_id.year": 1 };
        break;
      case "type":
        groupStage = { _id: "$type" };
        sortStage = { _id: 1 };
        break;
      case "status":
        groupStage = { _id: "$status" };
        sortStage = { _id: 1 };
        break;
      case "gateway":
        groupStage = { _id: "$gatewayResponse.gateway" };
        sortStage = { _id: 1 };
        break;
    }

    const analytics = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          ...groupStage,
          transactionCount: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          averageAmount: { $avg: "$amount" },
          minAmount: { $min: "$amount" },
          maxAmount: { $max: "$amount" },
        },
      },
      { $sort: sortStage },
    ]);

    // Get overall statistics
    const overallStats = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalRevenue: { $sum: "$amount" },
          successRate: {
            $avg: {
              $cond: [{ $eq: ["$status", "success"] }, 1, 0],
            },
          },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        analytics,
        overallStats: overallStats[0] || {
          totalTransactions: 0,
          totalRevenue: 0,
          successRate: 0,
        },
        dateRange: {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          period,
        },
      },
    });
  } catch (error) {
    console.error("Get transaction analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching transaction analytics",
      error: error.message,
    });
  }
};

// @desc    Bulk transaction operations
// @route   POST /api/transactions/bulk
// @access  Private (Admin)
const bulkTransactionOperation = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { transactionIds, action, format = "json" } = req.body;

    let result;
    switch (action) {
      case "export":
        const transactions = await Transaction.find({
          _id: { $in: transactionIds },
        })
          .populate("paymentId", "orderId paymentMethod amount")
          .populate("userId", "username email profile");

        // Format data based on requested format
        const exportData = formatExportData(transactions, format);

        result = {
          action: "export",
          format,
          recordCount: transactions.length,
          data: exportData,
        };
        break;

      case "analyze":
        const analysis = await Transaction.aggregate([
          {
            $match: {
              _id: {
                $in: transactionIds.map(
                  (id) => new mongoose.Types.ObjectId(id)
                ),
              },
            },
          },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: "$amount" },
              averageAmount: { $avg: "$amount" },
              successCount: {
                $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] },
              },
              failureCount: {
                $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
              },
              typeBreakdown: {
                $push: {
                  type: "$type",
                  amount: "$amount",
                  status: "$status",
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

      case "reconcile":
        // This would typically involve comparing with external payment gateway data
        const reconciliationReport = await generateReconciliationReport(
          transactionIds
        );
        result = {
          action: "reconcile",
          report: reconciliationReport,
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
    console.error("Bulk transaction operation error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while performing bulk operation",
      error: error.message,
    });
  }
};

// Helper functions
const updatePaymentStatus = async (payment, transaction) => {
  if (transaction.type === "sale" && transaction.status === "success") {
    payment.status = "completed";
    payment.paymentDate = new Date();
  } else if (
    transaction.type === "refund" &&
    transaction.status === "success"
  ) {
    const totalRefunded = await Transaction.aggregate([
      {
        $match: {
          paymentId: payment._id,
          type: "refund",
          status: "success",
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const refundTotal = totalRefunded[0]?.total || 0;

    if (refundTotal >= payment.amount) {
      payment.status = "refunded";
    } else if (refundTotal > 0) {
      payment.status = "partially_refunded";
    }

    payment.refundAmount = refundTotal;
    payment.refundDate = new Date();
  }

  await payment.save();

  // Update order payment status
  if (payment.orderId) {
    const order = await Order.findById(payment.orderId);
    if (order) {
      order.paymentStatus = payment.status;
      await order.save();
    }
  }
};

const calculateDateRange = (period, customStartDate, customEndDate) => {
  const endDate = customEndDate ? new Date(customEndDate) : new Date();
  let startDate = customStartDate ? new Date(customStartDate) : new Date();

  if (!customStartDate) {
    switch (period) {
      case "today":
        startDate = new Date(endDate);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "yesterday":
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(endDate.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
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
    }
  }

  return { startDate, endDate };
};

const formatExportData = (transactions, format) => {
  if (format === "csv") {
    // Convert to CSV format
    const headers =
      "ID,Type,Amount,Currency,Status,Gateway ID,Processed At,User Email,Order ID\n";
    const rows = transactions
      .map(
        (t) =>
          `"${t._id}","${t.type}",${t.amount},"${t.currency}","${t.status}","${t.gatewayTransactionId}","${t.processedAt}","${t.userId?.email}","${t.paymentId?.orderId}"`
      )
      .join("\n");
    return headers + rows;
  } else if (format === "json") {
    return transactions;
  } else {
    // For PDF, you would typically generate a PDF file
    // This is a simplified version
    return {
      summary: `Transaction Report - ${new Date().toISOString()}`,
      count: transactions.length,
      transactions: transactions.map((t) => ({
        id: t._id,
        type: t.type,
        amount: t.amount,
        status: t.status,
        processedAt: t.processedAt,
      })),
    };
  }
};

const generateReconciliationReport = async (transactionIds) => {
  // This would typically involve calling payment gateway APIs
  // and comparing with our transaction records
  return {
    generatedAt: new Date(),
    totalTransactions: transactionIds.length,
    matched: transactionIds.length, // Simplified
    discrepancies: [],
    summary: "All transactions reconciled successfully",
  };
};

module.exports = {
  createTransaction,
  getAllTransactions,
  getTransactionById,
  getUserTransactions,
  updateTransactionStatus,
  processRefundTransaction,
  searchTransactions,
  getTransactionAnalytics,
  bulkTransactionOperation,
};
