const Order = require("../../models/Order");
const User = require("../../models/User");
const Product = require("../../models/Product");
const Payment = require("../../models/Payment");
const mongoose = require("mongoose");
const { formatImageArray, formatImageUrl } = require("../../utils/imageHelper");

/**
 * @desc    Get all orders with filtering, pagination, and sorting
 * @route   GET /api/admin/orders
 * @access  Private/Admin
 */
const getAllOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      startDate,
      endDate,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build filter object
    const filter = {};

    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Search by order number, customer name, or email
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { orderNumber: searchRegex },
        { "customer.firstName": searchRegex },
        { "customer.lastName": searchRegex },
        { "customer.email": searchRegex },
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get orders with population
    const orders = await Order.find(filter)
      .populate("userId", "username email profile.firstName profile.lastName")
      .populate("handledBy", "username profile.firstName profile.lastName")
      .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const totalOrders = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / limit);

    // Get order statistics
    const stats = await Order.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totals.total" },
          totalOrders: { $sum: 1 },
          averageOrderValue: { $avg: "$totals.total" },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        orders: orders.map(order => ({
          ...order,
          items: (order.items || []).map(item => ({
            ...item,
            image: formatImageUrl(req, item.image),
            packageInfo: item.packageInfo ? {
              ...item.packageInfo,
              items: (item.packageInfo.items || []).map(pkgItem => ({
                ...pkgItem,
                image: formatImageUrl(req, pkgItem.image)
              }))
            } : item.packageInfo
          }))
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalOrders,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        stats: stats[0] || {
          totalRevenue: 0,
          totalOrders: 0,
          averageOrderValue: 0,
        },
      },
    });
  } catch (error) {
    console.error("Get all orders error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching orders",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get order by ID
 * @route   GET /api/admin/orders/:id
 * @access  Private/Admin
 */
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await Order.findById(id)
      .populate(
        "userId",
        "username email profile.firstName profile.lastName profile.phone"
      )
      .populate("handledBy", "username profile.firstName profile.lastName")
      .populate("items.productId", "name images sku inventory");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Get payment information if exists
    const payment = await Payment.findOne({ orderId: id });

    res.json({
      success: true,
      data: {
        order: {
          ...order.toObject(),
          items: (order.items || []).map(item => ({
            ...item.toObject(),
            image: formatImageUrl(req, item.image),
            packageInfo: item.packageInfo ? {
              ...item.packageInfo.toObject(),
              items: (item.packageInfo.items || []).map(pkgItem => ({
                ...pkgItem.toObject(),
                image: formatImageUrl(req, pkgItem.image)
              }))
            } : item.packageInfo,
            productId: item.productId ? {
              ...item.productId.toObject(),
              images: formatImageArray(req, item.productId.images)
            } : item.productId
          }))
        },
        payment,
      },
    });
  } catch (error) {
    console.error("Get order by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching order",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Update order status
 * @route   PUT /api/admin/orders/:id/status
 * @access  Private/Admin
 */
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, trackingNumber, notes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const validStatuses = [
      "pending",
      "processing",
      "confirmed",
      "shipped",
      "delivered",
      "completed",
      "cancelled",
      "returned",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Update order
    const updateData = {
      status,
      updatedAt: new Date(),
      handledBy: req.admin._id, // Track which admin updated the order
    };

    // Set timestamp based on status
    if (status === "confirmed") updateData.confirmedAt = new Date();
    if (status === "shipped") updateData.shippedAt = new Date();
    if (status === "delivered") updateData.deliveredAt = new Date();
    if (status === "returned") updateData.returnedAt = new Date();

    if (trackingNumber) updateData.trackingNumber = trackingNumber;

    const updatedOrder = await Order.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate("handledBy", "username profile.firstName profile.lastName");

    // If order is returned and payment was made, initiate refund process
    if (status === "returned" && order.paymentStatus === "paid") {
      await Payment.findOneAndUpdate(
        { orderId: id },
        {
          status: "refunded",
          refundAmount: order.totals.total,
          refundDate: new Date(),
          processedBy: req.admin._id,
        }
      );

      updatedOrder.paymentStatus = "refunded";
      await updatedOrder.save();
    }

    // If order is cancelled and payment was made, initiate refund process
    if (status === "cancelled" && order.paymentStatus === "paid") {
      // Here you would integrate with your payment gateway for refund
      // For now, we'll just update the payment status
      await Payment.findOneAndUpdate(
        { orderId: id },
        {
          status: "refunded",
          refundAmount: order.totals.total,
          refundDate: new Date(),
          processedBy: req.admin._id,
        }
      );

      // Update order payment status
      updatedOrder.paymentStatus = "refunded";
      await updatedOrder.save();
    }

    // Send status update notification to customer (non-blocking)
    const { sendOrderStatusUpdateEmail } = require("../../services/emailService");
    sendOrderStatusUpdateEmail(updatedOrder).catch(err => console.error("Failed to send status update email:", err));

    res.json({
      success: true,
      message: `Order status updated to ${status}`,
      data: {
        order: updatedOrder,
      },
    });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating order status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Update order payment status
 * @route   PUT /api/admin/orders/:id/payment-status
 * @access  Private/Admin
 */
const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const validStatuses = ["pending", "paid", "failed", "refunded"];
    if (!validStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status",
      });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Update order payment status
    order.paymentStatus = paymentStatus;
    order.updatedAt = new Date();
    order.handledBy = req.admin._id;

    await order.save();

    // Update payment record if exists
    await Payment.findOneAndUpdate(
      { orderId: id },
      {
        status: paymentStatus,
        updatedAt: new Date(),
        processedBy: req.admin._id,
        ...(paymentStatus === "refunded" && {
          refundAmount: order.totals.total,
          refundDate: new Date(),
        }),
      }
    );

    res.json({
      success: true,
      message: `Payment status updated to ${paymentStatus}`,
      data: {
        order,
      },
    });
  } catch (error) {
    console.error("Update payment status error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating payment status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Delete order (soft delete)
 * @route   DELETE /api/admin/orders/:id
 * @access  Private/Admin
 */
const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if order can be deleted (only pending or cancelled orders)
    if (!["pending", "cancelled"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete orders that are confirmed, shipped, or delivered",
      });
    }

    // Soft delete by updating status and adding deleted flag
    await Order.findByIdAndUpdate(id, {
      status: "cancelled",
      updatedAt: new Date(),
      handledBy: req.admin._id,
      deletedAt: new Date(),
      isActive: false,
    });

    res.json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (error) {
    console.error("Delete order error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting order",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get order statistics for dashboard
 * @route   GET /api/admin/orders/stats/overview
 * @access  Private/Admin
 */
const getOrderStats = async (req, res) => {
  try {
    const { period = "30d" } = req.query; // 7d, 30d, 90d, 1y

    // Calculate date range
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case "7d":
        startDate.setDate(now.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(now.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(now.getDate() - 90);
        break;
      case "1y":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Order status counts
    const statusCounts = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Payment status counts
    const paymentStatusCounts = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: "$paymentStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    // Revenue statistics
    const revenueStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totals.total" },
          averageOrderValue: { $avg: "$totals.total" },
          totalOrders: { $sum: 1 },
          totalTax: { $sum: "$totals.tax" },
          totalShipping: { $sum: "$totals.shipping" },
        },
      },
    ]);

    // Daily revenue for chart
    const dailyRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          revenue: { $sum: "$totals.total" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        period,
        startDate,
        endDate: now,
        statusCounts: statusCounts.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {}),
        paymentStatusCounts: paymentStatusCounts.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {}),
        revenueStats: revenueStats[0] || {
          totalRevenue: 0,
          averageOrderValue: 0,
          totalOrders: 0,
          totalTax: 0,
          totalShipping: 0,
        },
        dailyRevenue,
      },
    });
  } catch (error) {
    console.error("Get order stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching order statistics",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Export orders to CSV/Excel
 * @route   GET /api/admin/orders/export
 * @access  Private/Admin
 */
const exportOrders = async (req, res) => {
  try {
    const { format = "csv", startDate, endDate } = req.query;

    const filter = {};
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const orders = await Order.find(filter)
      .populate("userId", "email profile.firstName profile.lastName")
      .sort({ createdAt: -1 });

    // Simple CSV export implementation
    if (format === "csv") {
      const csvHeaders = [
        "Order Number",
        "Customer",
        "Email",
        "Status",
        "Payment Status",
        "Total Amount",
        "Order Date",
        "Items Count",
      ];

      const csvData = orders.map((order) => [
        order.orderNumber,
        `${order.customer.firstName} ${order.customer.lastName}`,
        order.customer.email,
        order.status,
        order.paymentStatus,
        `$${order.totals.total.toFixed(2)}`,
        order.createdAt.toISOString().split("T")[0],
        order.items.length,
      ]);

      const csvContent = [
        csvHeaders.join(","),
        ...csvData.map((row) => row.join(",")),
      ].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=orders-${Date.now()}.csv`
      );
      return res.send(csvContent);
    }

    res.json({
      success: true,
      data: {
        orders,
        total: orders.length,
        exportInfo: {
          format,
          generatedAt: new Date(),
          recordCount: orders.length,
        },
      },
    });
  } catch (error) {
    console.error("Export orders error:", error);
    res.status(500).json({
      success: false,
      message: "Error exporting orders",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get order analytics for charts and insights
 * @route   GET /api/admin/orders/analytics
 * @access  Private/Admin
 */
const getOrderAnalytics = async (req, res) => {
  try {
    const { period = "30d", startDate, endDate, groupBy = "day" } = req.query;

    // Calculate date range
    const now = new Date();
    let start = new Date();

    switch (period) {
      case "7d":
        start.setDate(now.getDate() - 7);
        break;
      case "30d":
        start.setDate(now.getDate() - 30);
        break;
      case "90d":
        start.setDate(now.getDate() - 90);
        break;
      case "1y":
        start.setFullYear(now.getFullYear() - 1);
        break;
      case "custom":
        start = startDate
          ? new Date(startDate)
          : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        start.setDate(now.getDate() - 30);
    }

    const end = endDate ? new Date(endDate) : now;

    // Date format for grouping
    let dateFormat;
    switch (groupBy) {
      case "day":
        dateFormat = "%Y-%m-%d";
        break;
      case "week":
        dateFormat = "%Y-%U";
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

    // Get analytics data in parallel
    const [
      revenueTrend,
      orderCountTrend,
      statusDistribution,
      topProducts,
      customerMetrics,
      paymentAnalytics,
    ] = await Promise.all([
      // Revenue trend
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
            paymentStatus: "paid",
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: dateFormat, date: "$createdAt" },
            },
            revenue: { $sum: "$totals.total" },
            orders: { $sum: 1 },
            averageOrderValue: { $avg: "$totals.total" },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Order count trend
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: dateFormat, date: "$createdAt" },
            },
            orderCount: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Status distribution
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            revenue: {
              $sum: {
                $cond: [
                  { $eq: ["$paymentStatus", "paid"] },
                  "$totals.total",
                  0,
                ],
              },
            },
          },
        },
      ]),

      // Top selling products
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
            paymentStatus: "paid",
          },
        },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.productId",
            productName: { $first: "$items.name" },
            totalSold: { $sum: "$items.quantity" },
            totalRevenue: { $sum: "$items.subtotal" },
          },
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: 10 },
      ]),

      // Customer metrics
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
            paymentStatus: "paid",
          },
        },
        {
          $group: {
            _id: "$userId",
            orderCount: { $sum: 1 },
            totalSpent: { $sum: "$totals.total" },
          },
        },
        {
          $group: {
            _id: null,
            totalCustomers: { $sum: 1 },
            avgOrdersPerCustomer: { $avg: "$orderCount" },
            avgCustomerValue: { $avg: "$totalSpent" },
            repeatCustomers: {
              $sum: {
                $cond: [{ $gt: ["$orderCount", 1] }, 1, 0],
              },
            },
          },
        },
      ]),

      // Payment analytics
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: "$paymentStatus",
            count: { $sum: 1 },
            totalAmount: { $sum: "$totals.total" },
          },
        },
      ]),
    ]);

    // Calculate conversion rates and other metrics
    const totalOrders = await Order.countDocuments({
      createdAt: { $gte: start, $lte: end },
    });

    const paidOrders = await Order.countDocuments({
      createdAt: { $gte: start, $lte: end },
      paymentStatus: "paid",
    });

    const conversionRate =
      totalOrders > 0 ? (paidOrders / totalOrders) * 100 : 0;

    res.json({
      success: true,
      data: {
        period: {
          start,
          end,
          groupBy,
        },
        trends: {
          revenue: revenueTrend,
          orderCount: orderCountTrend,
        },
        distributions: {
          status: statusDistribution,
          payment: paymentAnalytics,
        },
        products: {
          topSelling: topProducts,
        },
        customers: customerMetrics[0] || {
          totalCustomers: 0,
          avgOrdersPerCustomer: 0,
          avgCustomerValue: 0,
          repeatCustomers: 0,
        },
        metrics: {
          totalOrders,
          paidOrders,
          conversionRate: Math.round(conversionRate * 100) / 100,
          totalRevenue: revenueTrend.reduce((sum, day) => sum + day.revenue, 0),
          totalOrdersCount: orderCountTrend.reduce(
            (sum, day) => sum + day.orderCount,
            0
          ),
        },
      },
    });
  } catch (error) {
    console.error("Get order analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching order analytics",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  updatePaymentStatus,
  deleteOrder,
  getOrderStats,
  exportOrders,
  getOrderAnalytics,
  processRefund,
  addOrderNote,
  getOrderNotes,
  generateInvoice,
  cancelOrder,
};

/**
 * @desc    Process refund for an order
 * @route   POST /api/admin/orders/:id/refund
 * @access  Private/Admin
 */
async function processRefund(req, res) {
  try {
    const { id } = req.params;
    const { amount, reason, refundType = "full" } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if order is eligible for refund
    if (order.paymentStatus !== "paid") {
      return res.status(400).json({
        success: false,
        message: "Order must be paid to process a refund",
      });
    }

    // Calculate refund amount
    let refundAmount = order.totals.total;
    if (refundType === "partial" && amount) {
      if (amount > order.totals.total) {
        return res.status(400).json({
          success: false,
          message: "Refund amount cannot exceed order total",
        });
      }
      refundAmount = amount;
    }

    // Update payment record
    const payment = await Payment.findOneAndUpdate(
      { orderId: id },
      {
        status: refundType === "full" ? "refunded" : "partially_refunded",
        refundAmount,
        refundReason: reason,
        refundDate: new Date(),
        processedBy: req.admin.adminId,
      },
      { new: true }
    );

    // Update order
    order.paymentStatus = refundType === "full" ? "refunded" : "partially_refunded";
    order.refund = {
      amount: refundAmount,
      reason,
      type: refundType,
      processedAt: new Date(),
      processedBy: req.admin.adminId,
    };
    order.handledBy = req.admin.adminId;
    await order.save();

    // If full refund, restore inventory
    if (refundType === "full") {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { "inventory.quantity": item.quantity },
        });
      }
    }

    res.json({
      success: true,
      message: `Refund of $${refundAmount.toFixed(2)} processed successfully`,
      data: {
        order,
        payment,
        refund: {
          amount: refundAmount,
          type: refundType,
          reason,
        },
      },
    });
  } catch (error) {
    console.error("Process refund error:", error);
    res.status(500).json({
      success: false,
      message: "Error processing refund",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * @desc    Add note to order
 * @route   POST /api/admin/orders/:id/notes
 * @access  Private/Admin
 */
async function addOrderNote(req, res) {
  try {
    const { id } = req.params;
    const { note, isPrivate = true } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    if (!note || note.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Note content is required",
      });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Initialize notes array if not exists
    if (!order.notes) {
      order.notes = [];
    }

    const newNote = {
      _id: new mongoose.Types.ObjectId(),
      content: note.trim(),
      isPrivate,
      createdBy: req.admin.adminId,
      createdAt: new Date(),
    };

    order.notes.push(newNote);
    await order.save();

    res.status(201).json({
      success: true,
      message: "Note added successfully",
      data: { note: newNote },
    });
  } catch (error) {
    console.error("Add order note error:", error);
    res.status(500).json({
      success: false,
      message: "Error adding order note",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * @desc    Get order notes
 * @route   GET /api/admin/orders/:id/notes
 * @access  Private/Admin
 */
async function getOrderNotes(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await Order.findById(id)
      .select("notes orderNumber")
      .populate("notes.createdBy", "username profile.firstName profile.lastName");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        notes: order.notes || [],
      },
    });
  } catch (error) {
    console.error("Get order notes error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching order notes",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

/**
 * @desc    Generate invoice for order
 * @route   GET /api/admin/orders/:id/invoice
 * @access  Private/Admin
 */
async function generateInvoice(req, res) {
  try {
    const { id } = req.params;
    const { format = "json" } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await Order.findById(id)
      .populate("userId", "email profile.firstName profile.lastName profile.phone")
      .populate("items.productId", "name sku");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Generate invoice data
    const invoiceData = {
      invoiceNumber: `INV-${order.orderNumber}`,
      invoiceDate: new Date(),
      orderNumber: order.orderNumber,
      orderDate: order.createdAt,

      // Customer details
      customer: {
        name: `${order.customer.firstName} ${order.customer.lastName}`,
        email: order.customer.email,
        phone: order.customer.phone || "",
      },

      // Billing address
      billingAddress: order.shippingAddress,

      // Shipping address
      shippingAddress: order.shippingAddress,

      // Items
      items: order.items.map((item) => ({
        name: item.name,
        sku: item.productId?.sku || "N/A",
        quantity: item.quantity,
        unitPrice: item.price,
        subtotal: item.subtotal,
      })),

      // Totals
      subtotal: order.totals.subtotal,
      discount: order.totals.discount || 0,
      tax: order.totals.tax || 0,
      shipping: order.totals.shipping || 0,
      total: order.totals.total,

      // Payment info
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod || "N/A",

      // Company info (should come from settings)
      company: {
        name: "MK Dental",
        address: "",
        phone: "",
        email: "",
        website: "",
      },

      // Notes
      notes: order.notes?.filter((n) => !n.isPrivate).map((n) => n.content) || [],
    };

    // Return based on format
    if (format === "html") {
      // Generate simple HTML invoice
      const htmlInvoice = generateHtmlInvoice(invoiceData);
      res.setHeader("Content-Type", "text/html");
      return res.send(htmlInvoice);
    }

    res.json({
      success: true,
      data: { invoice: invoiceData },
    });
  } catch (error) {
    console.error("Generate invoice error:", error);
    res.status(500).json({
      success: false,
      message: "Error generating invoice",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// Helper function to generate HTML invoice
function generateHtmlInvoice(data) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Invoice ${data.invoiceNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 20px; }
        .invoice-details { text-align: right; }
        .addresses { display: flex; justify-content: space-between; margin: 20px 0; }
        .address { width: 45%; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background-color: #f5f5f5; }
        .totals { text-align: right; }
        .total-row { font-weight: bold; font-size: 1.2em; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company">
          <h1>${data.company.name}</h1>
        </div>
        <div class="invoice-details">
          <h2>INVOICE</h2>
          <p><strong>Invoice #:</strong> ${data.invoiceNumber}</p>
          <p><strong>Date:</strong> ${new Date(data.invoiceDate).toLocaleDateString()}</p>
          <p><strong>Order #:</strong> ${data.orderNumber}</p>
        </div>
      </div>
      
      <div class="addresses">
        <div class="address">
          <h3>Bill To:</h3>
          <p>${data.customer.name}</p>
          <p>${data.customer.email}</p>
          <p>${data.customer.phone}</p>
        </div>
        <div class="address">
          <h3>Ship To:</h3>
          <p>${data.shippingAddress.street}</p>
          <p>${data.shippingAddress.city}, ${data.shippingAddress.state} ${data.shippingAddress.postalCode}</p>
          <p>${data.shippingAddress.country}</p>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>SKU</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${data.items.map((item) => `
            <tr>
              <td>${item.name}</td>
              <td>${item.sku}</td>
              <td>${item.quantity}</td>
              <td>$${item.unitPrice.toFixed(2)}</td>
              <td>$${item.subtotal.toFixed(2)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      
      <div class="totals">
        <p>Subtotal: $${data.subtotal.toFixed(2)}</p>
        ${data.discount > 0 ? `<p>Discount: -$${data.discount.toFixed(2)}</p>` : ""}
        <p>Tax: $${data.tax.toFixed(2)}</p>
        <p>Shipping: $${data.shipping.toFixed(2)}</p>
        <p class="total-row">Total: $${data.total.toFixed(2)}</p>
      </div>
      
      <p><strong>Payment Status:</strong> ${data.paymentStatus}</p>
    </body>
    </html>
  `;
}

/**
 * @desc    Cancel order with reason
 * @route   POST /api/admin/orders/:id/cancel
 * @access  Private/Admin
 */
async function cancelOrder(req, res) {
  try {
    const { id } = req.params;
    const { reason, refund = false } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if order can be cancelled
    if (["delivered", "cancelled"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order with status: ${order.status}`,
      });
    }

    // Update order
    order.status = "cancelled";
    order.cancellation = {
      reason,
      cancelledAt: new Date(),
      cancelledBy: req.admin.adminId,
    };
    order.handledBy = req.admin.adminId;

    // Process refund if requested and order was paid
    if (refund && order.paymentStatus === "paid") {
      order.paymentStatus = "refunded";
      order.refund = {
        amount: order.totals.total,
        reason: `Order cancelled: ${reason}`,
        type: "full",
        processedAt: new Date(),
        processedBy: req.admin.adminId,
      };

      await Payment.findOneAndUpdate(
        { orderId: id },
        {
          status: "refunded",
          refundAmount: order.totals.total,
          refundReason: reason,
          refundDate: new Date(),
          processedBy: req.admin.adminId,
        }
      );
    }

    await order.save();

    // Restore inventory
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { "inventory.quantity": item.quantity },
      });
    }

    res.json({
      success: true,
      message: "Order cancelled successfully",
      data: { order },
    });
  } catch (error) {
    console.error("Cancel order error:", error);
    res.status(500).json({
      success: false,
      message: "Error cancelling order",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
