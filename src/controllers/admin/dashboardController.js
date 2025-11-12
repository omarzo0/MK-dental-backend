const User = require("../../models/User");
const Product = require("../../models/Product");
const Order = require("../../models/Order");
const Payment = require("../../models/Payment");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

// @desc    Get admin dashboard overview
// @route   GET /api/admin/dashboard
// @access  Private (Admin - canViewAnalytics)
const getDashboardOverview = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { period = "month", compareWithPrevious = true } = req.query;

    // Calculate date ranges
    const currentPeriod = calculateDateRange(period);
    const previousPeriod = compareWithPrevious
      ? calculateDateRange(period, true)
      : null;

    // Get all dashboard data in parallel
    const [
      revenueData,
      ordersData,
      customersData,
      productsData,
      recentOrders,
      topProducts,
      lowStockProducts,
      salesChartData,
      paymentData,
    ] = await Promise.all([
      getRevenueAnalytics(currentPeriod, previousPeriod),
      getOrdersAnalytics(currentPeriod, previousPeriod),
      getCustomersAnalytics(currentPeriod, previousPeriod),
      getProductsAnalytics(),
      getRecentOrders(10),
      getTopProducts(currentPeriod, 5),
      getLowStockProducts(10),
      getSalesChartData(currentPeriod, "day"),
      getPaymentAnalytics(currentPeriod),
    ]);

    // Calculate KPIs with growth percentages
    const kpis = calculateKPIs(
      revenueData,
      ordersData,
      customersData,
      productsData,
      paymentData
    );

    res.json({
      success: true,
      data: {
        kpis,
        charts: {
          sales: salesChartData,
          revenue: await getRevenueChartData(currentPeriod, "day"),
        },
        recentActivity: {
          orders: recentOrders,
          topProducts,
          lowStockProducts,
        },
        period: {
          current: currentPeriod,
          previous: previousPeriod,
          label: period,
        },
        summary: {
          totalRevenue: revenueData.current.totalRevenue || 0,
          totalOrders: ordersData.current.totalOrders || 0,
          totalCustomers: customersData.current.totalCustomers || 0,
          conversionRate: calculateConversionRate(customersData, ordersData),
        },
      },
    });
  } catch (error) {
    console.error("Get dashboard overview error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching dashboard data",
      error: error.message,
    });
  }
};

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard/statistics
// @access  Private (Admin - canViewAnalytics)
const getDashboardStatistics = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { period = "month" } = req.query;
    const dateRange = calculateDateRange(period);

    const [
      revenueStats,
      orderStats,
      customerStats,
      productStats,
      paymentStats,
    ] = await Promise.all([
      getDetailedRevenueStats(dateRange),
      getDetailedOrderStats(dateRange),
      getDetailedCustomerStats(dateRange),
      getDetailedProductStats(),
      getDetailedPaymentStats(dateRange),
    ]);

    res.json({
      success: true,
      data: {
        period: dateRange,
        revenue: revenueStats,
        orders: orderStats,
        customers: customerStats,
        products: productStats,
        payments: paymentStats,
      },
    });
  } catch (error) {
    console.error("Get dashboard statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching dashboard statistics",
      error: error.message,
    });
  }
};

// @desc    Get real-time dashboard data
// @route   GET /api/admin/dashboard/realtime
// @access  Private (Admin - canViewAnalytics)
const getRealTimeData = async (req, res) => {
  try {
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfYesterday = new Date(yesterday.setHours(0, 0, 0, 0));
    const endOfYesterday = new Date(yesterday.setHours(23, 59, 59, 999));

    const [
      todayRevenue,
      todayOrders,
      todayCustomers,
      yesterdayRevenue,
      yesterdayOrders,
      hourlyData,
      liveOrders,
    ] = await Promise.all([
      getRevenueForPeriod(startOfToday, endOfToday),
      getOrdersForPeriod(startOfToday, endOfToday),
      getCustomersForPeriod(startOfToday, endOfToday),
      getRevenueForPeriod(startOfYesterday, endOfYesterday),
      getOrdersForPeriod(startOfYesterday, endOfYesterday),
      getHourlySalesData(startOfToday, endOfToday),
      getLiveOrders(5),
    ]);

    // Calculate growth compared to yesterday
    const revenueGrowth =
      yesterdayRevenue > 0
        ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
        : 0;
    const ordersGrowth =
      yesterdayOrders > 0
        ? ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100
        : 0;

    res.json({
      success: true,
      data: {
        timestamp: new Date(),
        today: {
          revenue: todayRevenue,
          orders: todayOrders,
          customers: todayCustomers,
        },
        growth: {
          revenue: revenueGrowth,
          orders: ordersGrowth,
        },
        hourly: hourlyData,
        liveOrders,
        currentHour: new Date().getHours(),
        peakHour: findPeakHour(hourlyData),
      },
    });
  } catch (error) {
    console.error("Get real-time data error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching real-time data",
      error: error.message,
    });
  }
};

// @desc    Get sales performance data
// @route   GET /api/admin/dashboard/sales-performance
// @access  Private (Admin - canViewAnalytics)
const getSalesPerformance = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { period = "month", groupBy = "day" } = req.query;
    const dateRange = calculateDateRange(period);

    const [
      salesData,
      topCategories,
      topProducts,
      paymentMethods,
      geographicData,
    ] = await Promise.all([
      getSalesPerformanceData(dateRange, groupBy),
      getTopCategories(dateRange),
      getTopProducts(dateRange, 10),
      getPaymentMethodDistribution(dateRange),
      getSalesByGeography(dateRange),
    ]);

    res.json({
      success: true,
      data: {
        period: dateRange,
        groupBy,
        performance: salesData,
        topCategories,
        topProducts,
        paymentMethods,
        geographic: geographicData,
        summary: {
          bestPerformingCategory: topCategories[0],
          bestSellingProduct: topProducts[0],
          mostPopularPayment: paymentMethods[0],
        },
      },
    });
  } catch (error) {
    console.error("Get sales performance error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching sales performance",
      error: error.message,
    });
  }
};

// @desc    Get customer insights
// @route   GET /api/admin/dashboard/customer-insights
// @access  Private (Admin - canViewAnalytics)
const getCustomerInsights = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { period = "month" } = req.query;
    const dateRange = calculateDateRange(period);

    const [
      customerGrowth,
      customerLifetimeValue,
      retentionRate,
      acquisitionChannels,
      geographicDistribution,
      customerSegments,
    ] = await Promise.all([
      getCustomerGrowthData(dateRange),
      getCustomerLifetimeValue(dateRange),
      getRetentionRate(dateRange),
      getAcquisitionChannels(dateRange),
      getCustomerGeographicData(dateRange),
      getCustomerSegments(dateRange),
    ]);

    res.json({
      success: true,
      data: {
        period: dateRange,
        growth: customerGrowth,
        lifetimeValue: customerLifetimeValue,
        retention: retentionRate,
        acquisition: acquisitionChannels,
        geographic: geographicDistribution,
        segments: customerSegments,
        insights: generateCustomerInsights(
          customerGrowth,
          retentionRate,
          customerLifetimeValue
        ),
      },
    });
  } catch (error) {
    console.error("Get customer insights error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching customer insights",
      error: error.message,
    });
  }
};

// Helper Functions

const calculateDateRange = (period, isPrevious = false) => {
  const now = new Date();
  let startDate, endDate;

  switch (period) {
    case "today":
      startDate = new Date(now.setHours(0, 0, 0, 0));
      endDate = new Date(now.setHours(23, 59, 59, 999));
      if (isPrevious) {
        startDate.setDate(startDate.getDate() - 1);
        endDate.setDate(endDate.getDate() - 1);
      }
      break;

    case "yesterday":
      startDate = new Date(now.setDate(now.getDate() - 1));
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now.setHours(23, 59, 59, 999));
      if (isPrevious) {
        startDate.setDate(startDate.getDate() - 1);
        endDate.setDate(endDate.getDate() - 1);
      }
      break;

    case "week":
      startDate = new Date(now.setDate(now.getDate() - 7));
      endDate = new Date();
      if (isPrevious) {
        startDate.setDate(startDate.getDate() - 7);
        endDate.setDate(endDate.getDate() - 7);
      }
      break;

    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      if (isPrevious) {
        startDate.setMonth(startDate.getMonth() - 1);
        endDate.setMonth(endDate.getMonth() - 1);
      }
      break;

    case "quarter":
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0);
      if (isPrevious) {
        startDate.setMonth(startDate.getMonth() - 3);
        endDate.setMonth(endDate.getMonth() - 3);
      }
      break;

    case "year":
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
      if (isPrevious) {
        startDate.setFullYear(startDate.getFullYear() - 1);
        endDate.setFullYear(endDate.getFullYear() - 1);
      }
      break;

    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date();
  }

  return { startDate, endDate };
};

const getRevenueAnalytics = async (currentPeriod, previousPeriod) => {
  const currentRevenue = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: currentPeriod.startDate,
          $lte: currentPeriod.endDate,
        },
        paymentStatus: "paid",
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$totals.total" },
        totalOrders: { $sum: 1 },
        averageOrderValue: { $avg: "$totals.total" },
        taxCollected: { $sum: "$totals.tax" },
        shippingCollected: { $sum: "$totals.shipping" },
      },
    },
  ]);

  let previousRevenue = null;
  if (previousPeriod) {
    previousRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: previousPeriod.startDate,
            $lte: previousPeriod.endDate,
          },
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totals.total" },
          totalOrders: { $sum: 1 },
          averageOrderValue: { $avg: "$totals.total" },
        },
      },
    ]);
  }

  return {
    current: currentRevenue[0] || {
      totalRevenue: 0,
      totalOrders: 0,
      averageOrderValue: 0,
      taxCollected: 0,
      shippingCollected: 0,
    },
    previous: previousRevenue?.[0] || null,
  };
};

const getOrdersAnalytics = async (currentPeriod, previousPeriod) => {
  const currentOrders = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: currentPeriod.startDate,
          $lte: currentPeriod.endDate,
        },
      },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$totals.total" },
      },
    },
  ]);

  const totalCurrentOrders = currentOrders.reduce(
    (sum, item) => sum + item.count,
    0
  );

  let previousOrders = null;
  if (previousPeriod) {
    previousOrders = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: previousPeriod.startDate,
            $lte: previousPeriod.endDate,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
        },
      },
    ]);
  }

  return {
    current: {
      totalOrders: totalCurrentOrders,
      byStatus: currentOrders,
      completed:
        currentOrders.find((item) => item._id === "delivered")?.count || 0,
      pending: currentOrders.find((item) => item._id === "pending")?.count || 0,
    },
    previous: previousOrders?.[0] || null,
  };
};

const getCustomersAnalytics = async (currentPeriod, previousPeriod) => {
  const currentCustomers = await User.aggregate([
    {
      $match: {
        createdAt: {
          $gte: currentPeriod.startDate,
          $lte: currentPeriod.endDate,
        },
        role: "user",
      },
    },
    {
      $group: {
        _id: null,
        newCustomers: { $sum: 1 },
        activeCustomers: {
          $sum: {
            $cond: [{ $eq: ["$isActive", true] }, 1, 0],
          },
        },
      },
    },
  ]);

  const totalCustomers = await User.countDocuments({ role: "user" });

  let previousCustomers = null;
  if (previousPeriod) {
    previousCustomers = await User.aggregate([
      {
        $match: {
          createdAt: {
            $gte: previousPeriod.startDate,
            $lte: previousPeriod.endDate,
          },
          role: "user",
        },
      },
      {
        $group: {
          _id: null,
          newCustomers: { $sum: 1 },
        },
      },
    ]);
  }

  return {
    current: {
      totalCustomers,
      newCustomers: currentCustomers[0]?.newCustomers || 0,
      activeCustomers: currentCustomers[0]?.activeCustomers || 0,
    },
    previous: previousCustomers?.[0] || null,
  };
};

const getProductsAnalytics = async () => {
  const productStats = await Product.aggregate([
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        activeProducts: {
          $sum: {
            $cond: [{ $eq: ["$status", "active"] }, 1, 0],
          },
        },
        outOfStockProducts: {
          $sum: {
            $cond: [{ $eq: ["$inventory.quantity", 0] }, 1, 0],
          },
        },
        lowStockProducts: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gt: ["$inventory.quantity", 0] },
                  { $lte: ["$inventory.quantity", "$inventory.lowStockAlert"] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  return (
    productStats[0] || {
      totalProducts: 0,
      activeProducts: 0,
      outOfStockProducts: 0,
      lowStockProducts: 0,
    }
  );
};

const getPaymentAnalytics = async (period) => {
  const paymentStats = await Payment.aggregate([
    {
      $match: {
        createdAt: { $gte: period.startDate, $lte: period.endDate },
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

  const paymentMethods = await Payment.aggregate([
    {
      $match: {
        createdAt: { $gte: period.startDate, $lte: period.endDate },
        status: "completed",
      },
    },
    {
      $group: {
        _id: "$paymentMethod",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
      },
    },
    { $sort: { totalAmount: -1 } },
  ]);

  return {
    byStatus: paymentStats,
    byMethod: paymentMethods,
    successfulPayments:
      paymentStats.find((p) => p._id === "completed")?.count || 0,
    failedPayments: paymentStats.find((p) => p._id === "failed")?.count || 0,
  };
};

const getRecentOrders = async (limit = 10) => {
  return await Order.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("userId", "username email profile")
    .select("orderNumber totals totalAmount status paymentStatus createdAt");
};

const getTopProducts = async (period, limit = 5) => {
  return await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: period.startDate, $lte: period.endDate },
        paymentStatus: "paid",
      },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.productId",
        productName: { $first: "$items.name" },
        totalRevenue: { $sum: "$items.subtotal" },
        totalUnits: { $sum: "$items.quantity" },
        averagePrice: { $avg: "$items.price" },
      },
    },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product",
      },
    },
    {
      $project: {
        productName: 1,
        totalRevenue: 1,
        totalUnits: 1,
        averagePrice: 1,
        image: { $arrayElemAt: ["$product.images", 0] },
        category: { $arrayElemAt: ["$product.category", 0] },
      },
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: limit },
  ]);
};

const getLowStockProducts = async (limit = 10) => {
  return await Product.find({
    "inventory.quantity": { $lte: 10 },
    status: "active",
  })
    .sort({ "inventory.quantity": 1 })
    .limit(limit)
    .select("name inventory.quantity inventory.lowStockAlert images price");
};

const getSalesChartData = async (period, groupBy) => {
  let groupFormat;
  switch (groupBy) {
    case "day":
      groupFormat = { day: { $dayOfMonth: "$createdAt" } };
      break;
    case "week":
      groupFormat = { week: { $week: "$createdAt" } };
      break;
    case "month":
      groupFormat = { month: { $month: "$createdAt" } };
      break;
    default:
      groupFormat = { day: { $dayOfMonth: "$createdAt" } };
  }

  return await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: period.startDate, $lte: period.endDate },
        paymentStatus: "paid",
      },
    },
    {
      $group: {
        _id: {
          ...groupFormat,
          month: { $month: "$createdAt" },
          year: { $year: "$createdAt" },
        },
        revenue: { $sum: "$totals.total" },
        orders: { $sum: 1 },
        averageOrderValue: { $avg: "$totals.total" },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1, ...groupFormat } },
  ]);
};

const calculateKPIs = (
  revenueData,
  ordersData,
  customersData,
  productsData,
  paymentData
) => {
  const current = revenueData.current;
  const previous = revenueData.previous;

  const revenueGrowth = previous
    ? ((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue) *
      100
    : 0;

  const ordersGrowth = previous
    ? ((ordersData.current.totalOrders - previous.totalOrders) /
        previous.totalOrders) *
      100
    : 0;

  const customersGrowth = customersData.previous
    ? ((customersData.current.newCustomers -
        customersData.previous.newCustomers) /
        customersData.previous.newCustomers) *
      100
    : 0;

  const conversionRate = calculateConversionRate(customersData, ordersData);

  return [
    {
      title: "Total Revenue",
      value: `$${current.totalRevenue.toFixed(2)}`,
      growth: revenueGrowth,
      icon: "dollar",
      color: "success",
      description: "Total revenue from paid orders",
    },
    {
      title: "Total Orders",
      value: ordersData.current.totalOrders.toString(),
      growth: ordersGrowth,
      icon: "shopping-cart",
      color: "primary",
      description: "Total number of orders",
    },
    {
      title: "New Customers",
      value: customersData.current.newCustomers.toString(),
      growth: customersGrowth,
      icon: "users",
      color: "info",
      description: "New customers registered",
    },
    {
      title: "Conversion Rate",
      value: `${conversionRate}%`,
      growth: 0,
      icon: "trending-up",
      color: "warning",
      description: "Order to customer conversion rate",
    },
    {
      title: "Average Order Value",
      value: `$${current.averageOrderValue.toFixed(2)}`,
      growth: 0,
      icon: "package",
      color: "secondary",
      description: "Average value per order",
    },
    {
      title: "Successful Payments",
      value: paymentData.successfulPayments.toString(),
      growth: 0,
      icon: "credit-card",
      color: "success",
      description: "Successfully processed payments",
    },
  ];
};

const calculateConversionRate = (customersData, ordersData) => {
  if (customersData.current.totalCustomers === 0) return 0;
  return (
    (ordersData.current.totalOrders / customersData.current.totalCustomers) *
    100
  ).toFixed(1);
};

// Additional helper functions would be implemented for the other endpoints
const getRevenueForPeriod = async (startDate, endDate) => {
  const result = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        paymentStatus: "paid",
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$totals.total" },
      },
    },
  ]);
  return result[0]?.total || 0;
};

const getOrdersForPeriod = async (startDate, endDate) => {
  return await Order.countDocuments({
    createdAt: { $gte: startDate, $lte: endDate },
  });
};

const getCustomersForPeriod = async (startDate, endDate) => {
  return await User.countDocuments({
    createdAt: { $gte: startDate, $lte: endDate },
    role: "user",
  });
};

const getHourlySalesData = async (startDate, endDate) => {
  return await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        paymentStatus: "paid",
      },
    },
    {
      $group: {
        _id: { $hour: "$createdAt" },
        revenue: { $sum: "$totals.total" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

const findPeakHour = (hourlyData) => {
  if (!hourlyData.length) return null;
  return hourlyData.reduce((peak, current) =>
    current.revenue > peak.revenue ? current : peak
  );
};

const getLiveOrders = async (limit = 5) => {
  return await Order.find({
    status: { $in: ["pending", "confirmed", "shipped"] },
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("userId", "username email")
    .select("orderNumber status totals.total createdAt");
};

module.exports = {
  getDashboardOverview,
  getDashboardStatistics,
  getRealTimeData,
  getSalesPerformance,
  getCustomerInsights,
};
