// controllers/user/paymentController.js
const Payment = require("../../models/Payment");
const Order = require("../../models/Order");
const Transaction = require("../../models/Transaction");
const PaymentSettings = require("../../models/PaymentSettings");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

// @desc    Create payment for order
// @route   POST /api/user/payments
// @access  Private (User)
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
      currency = "EGP",
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
        nextStep: "process_payment",
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
// @route   POST /api/user/payments/:paymentId/process
// @access  Private (User)
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
    const paymentResult = await processWithPaymentGateway(payment, paymentToken);

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
        gatewayTransactionId: paymentResult.transactionId || `FAILED_${Date.now()}`,
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
// @route   GET /api/user/payments/:paymentId
// @access  Private (User)
const getPaymentById = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findById(paymentId)
      .populate("orderId", "orderNumber totals status shippingAddress");

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
// @route   GET /api/user/payments
// @access  Private (User)
const getUserPayments = async (req, res) => {
  try {
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

// @desc    Get available payment methods for checkout
// @route   GET /api/user/payments/methods
// @access  Public
const getAvailablePaymentMethods = async (req, res) => {
  try {
    const { orderAmount } = req.query;
    const amount = parseFloat(orderAmount) || 0;

    // Get payment settings
    const settings = await PaymentSettings.getSettings();

    if (!settings || !settings.methods || settings.methods.length === 0) {
      // Return empty if no methods configured - admin must create them
      return res.json({
        success: true,
        data: {
          methods: [],
          defaultMethod: null,
          minimumOrderAmount: 0,
          codSettings: {
            enabled: false,
            maxOrderAmount: null,
          },
          message: "No payment methods configured. Please contact admin.",
        },
      });
    }

    // Filter enabled methods and check amount restrictions
    const availableMethods = (settings.methods || [])
      .filter((method) => {
        if (!method.enabled) return false;
        if (method.minAmount && amount < method.minAmount) return false;
        if (method.maxAmount && amount > method.maxAmount) return false;
        return true;
      })
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((method) => ({
        name: method.name,
        displayName: method.displayName || method.name,
        description: method.description,
        instructions: method.instructions,
        icon: method.icon,
        fees: method.fees
          ? {
              type: method.fees.type,
              value: method.fees.value,
              calculated:
                method.fees.type === "percentage"
                  ? (amount * method.fees.value) / 100
                  : method.fees.value,
            }
          : null,
      }));

    // Check COD availability
    const codSettings = settings.codSettings || {};
    const codMethod = availableMethods.find(m => m.name === "cod");
    const codAvailable =
      codMethod &&
      codSettings.enabled !== false &&
      (!codSettings.maxOrderAmount || amount <= codSettings.maxOrderAmount);

    res.json({
      success: true,
      data: {
        methods: availableMethods,
        defaultMethod: settings.defaultMethod || (availableMethods[0]?.name || null),
        minimumOrderAmount: settings.minimumOrderAmount || 0,
        codSettings: {
          enabled: codAvailable,
          maxOrderAmount: codSettings.maxOrderAmount,
          verificationRequired: codSettings.verificationRequired,
        },
        taxSettings: settings.taxSettings,
      },
    });
  } catch (error) {
    console.error("Get available payment methods error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching payment methods",
      error: error.message,
    });
  }
};

// @desc    Validate payment method for order
// @route   POST /api/user/payments/validate-method
// @access  Private (User)
const validatePaymentMethod = async (req, res) => {
  try {
    const { paymentMethod, orderAmount } = req.body;
    const amount = parseFloat(orderAmount) || 0;

    const settings = await Settings.getByKey("payment");
    const methods = settings?.payment?.methods || [];

    const method = methods.find(m => m.name === paymentMethod);

    if (!method) {
      return res.status(400).json({
        success: false,
        message: `Payment method '${paymentMethod}' is not available`,
        valid: false,
      });
    }

    if (!method.enabled) {
      return res.status(400).json({
        success: false,
        message: `Payment method '${paymentMethod}' is currently disabled`,
        valid: false,
      });
    }

    if (method.minAmount && amount < method.minAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount for ${method.displayName} is ${method.minAmount} EGP`,
        valid: false,
      });
    }

    if (method.maxAmount && amount > method.maxAmount) {
      return res.status(400).json({
        success: false,
        message: `Maximum order amount for ${method.displayName} is ${method.maxAmount} EGP`,
        valid: false,
      });
    }

    // Check COD specific restrictions
    if (paymentMethod === "cod") {
      const codSettings = settings?.payment?.codSettings || {};
      if (codSettings.enabled === false) {
        return res.status(400).json({
          success: false,
          message: "Cash on Delivery is currently not available",
          valid: false,
        });
      }
      if (codSettings.maxOrderAmount && amount > codSettings.maxOrderAmount) {
        return res.status(400).json({
          success: false,
          message: `Cash on Delivery is not available for orders above ${codSettings.maxOrderAmount} EGP`,
          valid: false,
        });
      }
    }

    res.json({
      success: true,
      valid: true,
      data: {
        method: {
          name: method.name,
          displayName: method.displayName,
          description: method.description,
          instructions: method.instructions,
          fees: method.fees,
        },
      },
    });
  } catch (error) {
    console.error("Validate payment method error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while validating payment method",
      error: error.message,
    });
  }
};

// @desc    Get payment for order
// @route   GET /api/user/payments/order/:orderId
// @access  Private (User)
const getPaymentByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;

    // Verify order belongs to user
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const payment = await Payment.findOne({ orderId, userId });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found for this order",
      });
    }

    // Get payment method info
    const settings = await Settings.getByKey("payment");
    const methods = settings?.payment?.methods || [];
    const methodInfo = methods.find(m => m.name === payment.paymentMethod);

    res.json({
      success: true,
      data: {
        payment,
        order: {
          orderNumber: order.orderNumber,
          status: order.status,
          total: order.totals?.total,
        },
        paymentMethodInfo: methodInfo ? {
          displayName: methodInfo.displayName,
          icon: methodInfo.icon,
          instructions: methodInfo.instructions,
        } : null,
      },
    });
  } catch (error) {
    console.error("Get payment by order error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching payment",
      error: error.message,
    });
  }
};

// @desc    Retry failed payment
// @route   POST /api/user/payments/:paymentId/retry
// @access  Private (User)
const retryPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { paymentMethod, paymentDetails } = req.body;
    const userId = req.user.userId;

    const payment = await Payment.findOne({ _id: paymentId, userId });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (payment.status !== "failed") {
      return res.status(400).json({
        success: false,
        message: `Cannot retry payment with status '${payment.status}'`,
      });
    }

    // Validate new payment method if provided
    if (paymentMethod) {
      const settings = await Settings.getByKey("payment");
      const methods = settings?.payment?.methods || [];
      const method = methods.find(m => m.name === paymentMethod && m.enabled);

      if (!method) {
        return res.status(400).json({
          success: false,
          message: `Payment method '${paymentMethod}' is not available`,
        });
      }

      payment.paymentMethod = paymentMethod;
    }

    // Update payment details if provided
    if (paymentDetails) {
      payment.paymentDetails = sanitizePaymentDetails(paymentDetails, payment.paymentMethod);
    }

    // Reset payment status
    payment.status = "pending";
    payment.failureReason = null;
    payment.gatewayResponse = null;
    payment.codStatus = payment.paymentMethod === "cod" ? "awaiting_delivery" : undefined;
    await payment.save();

    await payment.populate("orderId", "orderNumber totals status");

    res.json({
      success: true,
      message: "Payment reset for retry",
      data: {
        payment,
        nextStep: payment.paymentMethod === "cod" ? "await_delivery" : "process_payment",
      },
    });
  } catch (error) {
    console.error("Retry payment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while retrying payment",
      error: error.message,
    });
  }
};

// Helper functions
const sanitizePaymentDetails = (paymentDetails, paymentMethod) => {
  const sanitized = { ...paymentDetails };

  if (paymentMethod.includes("card") || paymentMethod === "visa" || paymentMethod === "mastercard") {
    if (sanitized.cardNumber) {
      sanitized.last4 = sanitized.cardNumber.slice(-4);
      delete sanitized.cardNumber;
    }
    delete sanitized.cvv;
  }

  return sanitized;
};

const processWithPaymentGateway = async (payment, paymentToken) => {
  try {
    // Simulate API call to payment gateway
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Simulate success 95% of the time
    const isSuccess = Math.random() < 0.95;

    if (isSuccess) {
      return {
        success: true,
        transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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

const saveUserPaymentMethod = async (userId, paymentDetails) => {
  console.log(`Saving payment method for user ${userId}`);
};

module.exports = {
  createPayment,
  processPayment,
  getPaymentById,
  getUserPayments,
  getAvailablePaymentMethods,
  validatePaymentMethod,
  getPaymentByOrder,
  retryPayment,
};
