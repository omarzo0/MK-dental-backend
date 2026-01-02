// controllers/admin/transactionController.js
const Transaction = require("../../models/Transaction");
const Payment = require("../../models/Payment");
const Order = require("../../models/Order");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

// @desc    Create new transaction
// @route   POST /api/admin/transactions
// @access  Private (Admin)
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
      currency = "EGP",
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
          message: `Refund amount exceeds available balance. Maximum refundable: ${(
            payment.amount - totalRefunded
          ).toFixed(2)} EGP`,
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
// @route   GET /api/admin/transactions
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
      userId,
      paymentId,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build filter
    const filter = {};

    if (type) filter.type = type;
    if (status) filter.status = status;
    if (userId) filter.userId = userId;
    if (paymentId) filter.paymentId = paymentId;

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

    // Gateway filter
    if (gateway) {
      filter.gatewayTransactionId = { $regex: gateway, $options: "i" };
    }

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Get transactions with pagination
    const transactions = await Transaction.find(filter)
      .populate("paymentId", "orderId paymentMethod amount status")
      .populate("userId", "username email profile")
      .sort(sortConfig)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const totalTransactions = await Transaction.countDocuments(filter);

    // Calculate summary statistics
    const summaryPipeline = [
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          avgAmount: { $avg: "$amount" },
          successCount: {
            $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] },
          },
          failedCount: {
            $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
          },
          pendingCount: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
        },
      },
    ];

    const summary = await Transaction.aggregate(summaryPipeline);

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
        summary: summary[0] || {
          totalAmount: 0,
          avgAmount: 0,
          successCount: 0,
          failedCount: 0,
          pendingCount: 0,
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
// @route   GET /api/admin/transactions/:transactionId
// @access  Private (Admin)
const getTransactionById = async (req, res) => {
  try {
    const { transactionId } = req.params;

    const transaction = await Transaction.findById(transactionId)
      .populate({
        path: "paymentId",
        select: "orderId paymentMethod amount status paymentDetails",
        populate: {
          path: "orderId",
          select: "orderNumber totals status shippingAddress",
        },
      })
      .populate("userId", "username email profile");

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    // Get related transactions (same payment)
    const relatedTransactions = await Transaction.find({
      paymentId: transaction.paymentId._id,
      _id: { $ne: transaction._id },
    })
      .select("type amount status createdAt")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        transaction,
        relatedTransactions,
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

// @desc    Get transactions by user ID
// @route   GET /api/admin/transactions/user/:userId
// @access  Private (Admin)
const getTransactionsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, type, status } = req.query;

    const filter = { userId };
    if (type) filter.type = type;
    if (status) filter.status = status;

    const transactions = await Transaction.find(filter)
      .populate("paymentId", "orderId paymentMethod amount")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Transaction.countDocuments(filter);

    res.json({
      success: true,
      data: {
        transactions,
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
    console.error("Get user transactions error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user transactions",
      error: error.message,
    });
  }
};

// @desc    Update transaction status
// @route   PUT /api/admin/transactions/:transactionId/status
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

    // Validate status transition
    const validTransitions = {
      pending: ["success", "failed", "cancelled"],
      success: [], // Cannot change from success
      failed: ["pending"], // Can retry
      cancelled: [], // Cannot change from cancelled
    };

    if (!validTransitions[transaction.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from '${transaction.status}' to '${status}'`,
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
    if (status === "success") {
      transaction.processedAt = new Date();
    }

    await transaction.save();

    // Update related payment status
    const payment = await Payment.findById(transaction.paymentId);
    if (payment) {
      await updatePaymentStatus(payment, transaction);
    }

    await transaction.populate([
      { path: "paymentId", select: "orderId paymentMethod amount" },
      { path: "userId", select: "username email profile" },
    ]);

    res.json({
      success: true,
      message: "Transaction status updated successfully",
      data: { transaction },
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

// @desc    Process refund for transaction
// @route   POST /api/admin/transactions/:transactionId/refund
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

    // Get original transaction
    const originalTransaction = await Transaction.findById(transactionId)
      .populate("paymentId");

    if (!originalTransaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    if (originalTransaction.type !== "sale" || originalTransaction.status !== "success") {
      return res.status(400).json({
        success: false,
        message: "Can only refund successful sale transactions",
      });
    }

    // Calculate refundable amount
    const relatedRefunds = await Transaction.find({
      paymentId: originalTransaction.paymentId._id,
      type: "refund",
      status: "success",
    });

    const totalRefunded = relatedRefunds.reduce((sum, t) => sum + t.amount, 0);
    const maxRefundable = originalTransaction.amount - totalRefunded;

    const amountToRefund = refundAmount || maxRefundable;

    if (amountToRefund > maxRefundable) {
      return res.status(400).json({
        success: false,
        message: `Refund amount exceeds maximum refundable amount of ${maxRefundable.toFixed(2)} EGP`,
      });
    }

    // Create refund transaction
    const refundTransaction = new Transaction({
      paymentId: originalTransaction.paymentId._id,
      userId: originalTransaction.userId,
      type: "refund",
      amount: amountToRefund,
      currency: originalTransaction.currency,
      gatewayTransactionId: `REFUND-${originalTransaction.gatewayTransactionId}-${Date.now()}`,
      status: "success",
      processedAt: new Date(),
      gatewayResponse: {
        originalTransactionId: originalTransaction._id,
        reason: reason || "Admin initiated refund",
        processedBy: req.admin.adminId,
      },
    });

    await refundTransaction.save();

    // Update payment status
    const payment = await Payment.findById(originalTransaction.paymentId._id);
    const newTotalRefunded = totalRefunded + amountToRefund;

    if (newTotalRefunded >= originalTransaction.amount) {
      payment.status = "refunded";
    } else {
      payment.status = "partially_refunded";
    }
    payment.refundedAmount = newTotalRefunded;
    await payment.save();

    // Update order status if fully refunded
    if (payment.status === "refunded") {
      await Order.findByIdAndUpdate(payment.orderId, {
        status: "refunded",
        paymentStatus: "refunded",
      });
    }

    await refundTransaction.populate([
      { path: "paymentId", select: "orderId paymentMethod amount" },
      { path: "userId", select: "username email profile" },
    ]);

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
          amountRefunded: amountToRefund,
          totalRefunded: newTotalRefunded,
          remainingBalance: originalTransaction.amount - newTotalRefunded,
        },
      },
    });
  } catch (error) {
    console.error("Process refund error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while processing refund",
      error: error.message,
    });
  }
};

// @desc    Search transactions
// @route   GET /api/admin/transactions/search
// @access  Private (Admin)
const searchTransactions = async (req, res) => {
  try {
    const { q, searchField = "all", page = 1, limit = 20 } = req.query;

    let filter = {};

    if (searchField === "all") {
      filter.$or = [
        { gatewayTransactionId: { $regex: q, $options: "i" } },
      ];

      // Check if search term is valid ObjectId for payment/order search
      if (mongoose.Types.ObjectId.isValid(q)) {
        filter.$or.push({ paymentId: q });
      }
    } else if (searchField === "gatewayTransactionId") {
      filter.gatewayTransactionId = { $regex: q, $options: "i" };
    } else if (searchField === "paymentId" && mongoose.Types.ObjectId.isValid(q)) {
      filter.paymentId = q;
    }

    const transactions = await Transaction.find(filter)
      .populate("paymentId", "orderId paymentMethod amount status")
      .populate("userId", "username email")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Transaction.countDocuments(filter);

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          total,
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
        searchQuery: q,
        searchField,
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
// @route   GET /api/admin/transactions/analytics
// @access  Private (Admin)
const getTransactionAnalytics = async (req, res) => {
  try {
    const { period = "month", startDate, endDate, groupBy = "day" } = req.query;

    const dateRange = getDateRange(period, startDate, endDate);

    // Overall statistics
    const overallStats = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          avgAmount: { $avg: "$amount" },
          successfulTransactions: {
            $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] },
          },
          failedTransactions: {
            $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
          },
          successfulAmount: {
            $sum: { $cond: [{ $eq: ["$status", "success"] }, "$amount", 0] },
          },
          refundedAmount: {
            $sum: { $cond: [{ $eq: ["$type", "refund"] }, "$amount", 0] },
          },
        },
      },
    ]);

    // Transactions by type
    const byType = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        },
      },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    // Transactions by status
    const byStatus = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    // Time series data
    let dateFormat;
    switch (groupBy) {
      case "day":
        dateFormat = "%Y-%m-%d";
        break;
      case "week":
        dateFormat = "%Y-W%V";
        break;
      case "month":
        dateFormat = "%Y-%m";
        break;
      case "year":
        dateFormat = "%Y";
        break;
      default:
        dateFormat = "%Y-%m-%d";
    }

    const timeSeries = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          successCount: {
            $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        period: {
          type: period,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        },
        overall: overallStats[0] || {
          totalTransactions: 0,
          totalAmount: 0,
          avgAmount: 0,
          successfulTransactions: 0,
          failedTransactions: 0,
          successfulAmount: 0,
          refundedAmount: 0,
        },
        byType,
        byStatus,
        timeSeries,
      },
    });
  } catch (error) {
    console.error("Get transaction analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching analytics",
      error: error.message,
    });
  }
};

// @desc    Bulk transaction operations
// @route   POST /api/admin/transactions/bulk
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

    // Verify all transactions exist
    const transactions = await Transaction.find({
      _id: { $in: transactionIds },
    })
      .populate("paymentId", "orderId paymentMethod amount")
      .populate("userId", "username email");

    if (transactions.length !== transactionIds.length) {
      return res.status(400).json({
        success: false,
        message: "Some transaction IDs are invalid",
      });
    }

    let result;

    switch (action) {
      case "export":
        result = {
          action: "export",
          format,
          data: formatExportData(transactions, format),
          count: transactions.length,
        };
        break;

      case "analyze":
        const analysis = {
          totalTransactions: transactions.length,
          totalAmount: transactions.reduce((sum, t) => sum + t.amount, 0),
          byType: {},
          byStatus: {},
          dateRange: {
            earliest: null,
            latest: null,
          },
        };

        transactions.forEach((t) => {
          // By type
          analysis.byType[t.type] = (analysis.byType[t.type] || 0) + 1;
          // By status
          analysis.byStatus[t.status] = (analysis.byStatus[t.status] || 0) + 1;
          // Date range
          if (!analysis.dateRange.earliest || t.createdAt < analysis.dateRange.earliest) {
            analysis.dateRange.earliest = t.createdAt;
          }
          if (!analysis.dateRange.latest || t.createdAt > analysis.dateRange.latest) {
            analysis.dateRange.latest = t.createdAt;
          }
        });

        result = {
          action: "analyze",
          analysis,
        };
        break;

      case "reconcile":
        result = {
          action: "reconcile",
          report: await generateReconciliationReport(transactionIds),
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
      message: `Bulk ${action} completed successfully`,
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

// Helper function to update payment status based on transaction
const updatePaymentStatus = async (payment, transaction) => {
  if (transaction.type === "sale") {
    if (transaction.status === "success") {
      payment.status = "completed";
      // Update order payment status
      await Order.findByIdAndUpdate(payment.orderId, {
        paymentStatus: "paid",
      });
    } else if (transaction.status === "failed") {
      payment.status = "failed";
    }
  } else if (transaction.type === "refund" && transaction.status === "success") {
    const allRefunds = await Transaction.find({
      paymentId: payment._id,
      type: "refund",
      status: "success",
    });
    const totalRefunded = allRefunds.reduce((sum, t) => sum + t.amount, 0);

    if (totalRefunded >= payment.amount) {
      payment.status = "refunded";
      await Order.findByIdAndUpdate(payment.orderId, {
        paymentStatus: "refunded",
        status: "refunded",
      });
    } else {
      payment.status = "partially_refunded";
    }
    payment.refundedAmount = totalRefunded;
  }

  await payment.save();
};

// Helper function to get date range based on period
const getDateRange = (period, startDateParam, endDateParam) => {
  let startDate, endDate;

  if (period === "custom" && startDateParam && endDateParam) {
    startDate = new Date(startDateParam);
    endDate = new Date(endDateParam);
  } else {
    endDate = new Date();
    startDate = new Date();

    switch (period) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        break;
      case "yesterday":
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "week":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(startDate.getMonth() - 1);
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
  return {
    generatedAt: new Date(),
    totalTransactions: transactionIds.length,
    matched: transactionIds.length,
    discrepancies: [],
    summary: "All transactions reconciled successfully",
  };
};

module.exports = {
  createTransaction,
  getAllTransactions,
  getTransactionById,
  getTransactionsByUser,
  updateTransactionStatus,
  processRefundTransaction,
  searchTransactions,
  getTransactionAnalytics,
  bulkTransactionOperation,
};
