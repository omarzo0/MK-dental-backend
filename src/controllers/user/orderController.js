// controllers/user/orderController.js
const Order = require("../../models/Order");
const Product = require("../../models/Product");
const Cart = require("../../models/Cart");
const Payment = require("../../models/Payment");
const { validationResult } = require("express-validator");

// @desc    Get user's orders
// @route   GET /api/user/orders
// @access  Private (User)
const getUserOrders = async (req, res) => {
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
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const userId = req.user.userId;

    // Build filter
    const filter = { userId };
    if (status) filter.status = status;

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "asc" ? 1 : -1;

    const orders = await Order.find(filter)
      .sort(sortConfig)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate("items.productId", "name images slug")
      .select("-__v");

    const totalOrders = await Order.countDocuments(filter);

    // Calculate order statistics for the user
    const orderStats = await Order.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totals.total" },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalOrders / limit),
          totalOrders,
          hasNext: page * limit < totalOrders,
          hasPrev: page > 1,
        },
        statistics: orderStats,
      },
    });
  } catch (error) {
    console.error("Get user orders error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching orders",
      error: error.message,
    });
  }
};

// @desc    Get order by ID
// @route   GET /api/user/orders/:orderId
// @access  Private (User)
const getOrderById = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { orderId } = req.params;
    const userId = req.user.userId;

    const order = await Order.findOne({
      _id: orderId,
      userId: userId,
    })
      .populate("items.productId", "name images slug specifications")
      .populate("userId", "username email profile");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Get payment information for this order
    const payment = await Payment.findOne({ orderId }).select(
      "paymentMethod status paymentDate gatewayTransactionId"
    );

    // Get related products for recommendations
    const category = order.items[0]?.productId?.category;
    const relatedProducts = await Product.find({
      category: category,
      status: "active",
      _id: { $ne: order.items[0]?.productId?._id },
    })
      .limit(4)
      .select("name price images slug");

    res.json({
      success: true,
      data: {
        order,
        payment: payment || null,
        relatedProducts,
      },
    });
  } catch (error) {
    console.error("Get order by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching order",
      error: error.message,
    });
  }
};

// @desc    Create new order from cart
// @route   POST /api/user/orders
// @access  Private (User)
const createOrder = async (req, res) => {
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
      shippingAddress,
      billingAddress,
      shippingMethod = "standard",
      paymentMethod,
      notes,
      useSavedAddress = false,
    } = req.body;

    const userId = req.user.userId;

    // Get user's cart
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }

    // Validate cart items and calculate totals
    const orderItems = [];
    let subtotal = 0;
    let outOfStockItems = [];

    for (const cartItem of cart.items) {
      const product = cartItem.productId;

      if (!product || product.status !== "active") {
        outOfStockItems.push({
          productId: product?._id,
          name: product?.name || "Unknown Product",
          reason: "Product no longer available",
        });
        continue;
      }

      if (product.inventory.quantity < cartItem.quantity) {
        outOfStockItems.push({
          productId: product._id,
          name: product.name,
          reason: `Only ${product.inventory.quantity} available in stock`,
        });
        continue;
      }

      const itemTotal = product.price * cartItem.quantity;
      subtotal += itemTotal;

      orderItems.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity: cartItem.quantity,
        subtotal: itemTotal,
        image: product.images?.[0],
        sku: product.sku,
      });
    }

    // Check if any items are out of stock
    if (outOfStockItems.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Some items are no longer available",
        data: {
          outOfStockItems,
        },
      });
    }

    // Calculate totals
    const shippingFee = calculateShippingFee(shippingMethod, subtotal);
    const taxAmount = calculateTax(subtotal, shippingAddress.state);
    const discount = cart.summary.totalDiscount || 0;
    const total = subtotal + shippingFee + taxAmount - discount;

    // Generate order number
    const orderNumber = await generateOrderNumber();

    // Create order
    const order = new Order({
      orderNumber,
      userId,
      customer: await getCustomerInfo(userId),
      items: orderItems,
      totals: {
        subtotal,
        tax: taxAmount,
        shipping: shippingFee,
        discount: discount,
        total,
      },
      shippingAddress,
      billingAddress: billingAddress?.useShippingAddress
        ? shippingAddress
        : billingAddress,
      shippingMethod,
      paymentMethod,
      notes,
      status: "pending",
      paymentStatus: "pending",
    });

    await order.save();

    // Clear the cart after successful order creation
    await Cart.findOneAndUpdate(
      { userId },
      {
        items: [],
        summary: {
          itemsCount: 0,
          totalPrice: 0,
          totalDiscount: 0,
          shippingFee: 0,
          taxAmount: 0,
          grandTotal: 0,
        },
        coupon: undefined,
      }
    );

    // Update product inventory
    await updateProductInventory(orderItems);

    // Create pending payment record
    const payment = new Payment({
      orderId: order._id,
      userId: userId,
      paymentMethod,
      amount: total,
      currency: "USD",
      status: "pending",
    });
    await payment.save();

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: {
        order,
        payment: {
          id: payment._id,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
        },
        nextStep: "process_payment",
      },
    });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating order",
      error: error.message,
    });
  }
};

// @desc    Cancel order
// @route   PUT /api/user/orders/:orderId/cancel
// @access  Private (User)
const cancelOrder = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { orderId } = req.params;
    const { reason } = req.body;
    const userId = req.user.userId;

    const order = await Order.findOne({
      _id: orderId,
      userId: userId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if order can be cancelled
    if (!["pending", "confirmed"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled in ${order.status} status. Please contact support.`,
      });
    }

    // Check if payment was already made
    const payment = await Payment.findOne({ orderId });
    if (payment && payment.status === "completed") {
      return res.status(400).json({
        success: false,
        message:
          "Cannot cancel order with completed payment. Please contact support for refund.",
      });
    }

    // Update order status
    order.status = "cancelled";
    order.cancellationReason = reason || "Customer request";
    order.cancelledAt = new Date();
    order.updatedAt = new Date();
    await order.save();

    // Update payment status if exists
    if (payment) {
      payment.status = "cancelled";
      await payment.save();
    }

    // Restore product inventory
    await restoreProductInventory(order.items);

    res.json({
      success: true,
      message: "Order cancelled successfully",
      data: {
        order: {
          _id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          cancellationReason: order.cancellationReason,
        },
      },
    });
  } catch (error) {
    console.error("Cancel order error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while cancelling order",
      error: error.message,
    });
  }
};

// @desc    Track order
// @route   GET /api/user/orders/:orderId/track
// @access  Private (User)
const trackOrder = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { orderId } = req.params;
    const userId = req.user.userId;

    const order = await Order.findOne({
      _id: orderId,
      userId: userId,
    }).select(
      "orderNumber status trackingNumber shippingAddress shippingMethod createdAt updatedAt"
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Generate tracking timeline based on order status
    const trackingTimeline = generateTrackingTimeline(order);

    res.json({
      success: true,
      data: {
        order: {
          orderNumber: order.orderNumber,
          status: order.status,
          trackingNumber: order.trackingNumber,
          shippingMethod: order.shippingMethod,
          estimatedDelivery: calculateEstimatedDelivery(
            order.createdAt,
            order.shippingMethod
          ),
        },
        timeline: trackingTimeline,
        shippingAddress: order.shippingAddress,
      },
    });
  } catch (error) {
    console.error("Track order error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while tracking order",
      error: error.message,
    });
  }
};

// @desc    Request order return
// @route   POST /api/user/orders/:orderId/return
// @access  Private (User)
const requestReturn = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { orderId } = req.params;
    const { reason, items, comments } = req.body;
    const userId = req.user.userId;

    const order = await Order.findOne({
      _id: orderId,
      userId: userId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if order can be returned
    if (order.status !== "delivered") {
      return res.status(400).json({
        success: false,
        message: "Only delivered orders can be returned",
      });
    }

    // Check if return was already requested
    if (order.returnStatus) {
      return res.status(400).json({
        success: false,
        message: `Return already ${order.returnStatus} for this order`,
      });
    }

    // Calculate return window (30 days from delivery)
    const returnWindow = new Date(order.updatedAt);
    returnWindow.setDate(returnWindow.getDate() + 30);

    if (new Date() > returnWindow) {
      return res.status(400).json({
        success: false,
        message: "Return window has expired (30 days from delivery)",
      });
    }

    // Update order with return request
    order.returnStatus = "requested";
    order.returnRequestedAt = new Date();
    order.returnReason = reason;
    order.returnComments = comments;
    order.returnItems =
      items ||
      order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        reason: reason,
      }));
    await order.save();

    // TODO: Notify admin about return request
    // sendReturnNotificationToAdmin(order);

    res.json({
      success: true,
      message: "Return request submitted successfully",
      data: {
        order: {
          _id: order._id,
          orderNumber: order.orderNumber,
          returnStatus: order.returnStatus,
          returnRequestedAt: order.returnRequestedAt,
        },
        instructions: {
          nextSteps:
            "Please wait for approval. We will contact you with return instructions.",
          contact: "support@yourstore.com",
          timeframe: "Processing usually takes 1-2 business days",
        },
      },
    });
  } catch (error) {
    console.error("Request return error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while processing return request",
      error: error.message,
    });
  }
};

// @desc    Reorder previous order
// @route   POST /api/user/orders/:orderId/reorder
// @access  Private (User)
const reorder = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { orderId } = req.params;
    const userId = req.user.userId;

    const originalOrder = await Order.findOne({
      _id: orderId,
      userId: userId,
    }).populate("items.productId");

    if (!originalOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check product availability for reorder
    const availableItems = [];
    const unavailableItems = [];

    for (const item of originalOrder.items) {
      const product = item.productId;

      if (!product || product.status !== "active") {
        unavailableItems.push({
          productId: product?._id,
          name: product?.name || "Unknown Product",
          reason: "Product no longer available",
        });
        continue;
      }

      if (product.inventory.quantity < item.quantity) {
        unavailableItems.push({
          productId: product._id,
          name: product.name,
          reason: `Only ${product.inventory.quantity} available in stock (requested: ${item.quantity})`,
        });
        continue;
      }

      availableItems.push({
        productId: product._id,
        quantity: item.quantity,
      });
    }

    if (availableItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "None of the items from this order are currently available",
        data: { unavailableItems },
      });
    }

    // Add available items to cart
    const cart =
      (await Cart.findOne({ userId })) || new Cart({ userId, items: [] });

    for (const item of availableItems) {
      const existingItem = cart.items.find(
        (cartItem) =>
          cartItem.productId.toString() === item.productId.toString()
      );

      if (existingItem) {
        // Update quantity if item already in cart
        existingItem.quantity += item.quantity;
      } else {
        // Add new item to cart
        cart.items.push({
          productId: item.productId,
          quantity: item.quantity,
          price: item.productId.price,
        });
      }
    }

    // Recalculate cart totals
    await cart.calculateTotals();
    await cart.save();

    await cart.populate("items.productId", "name price images");

    res.json({
      success: true,
      message: "Items added to cart successfully",
      data: {
        cart,
        summary: {
          addedItems: availableItems.length,
          unavailableItems: unavailableItems.length,
          unavailableItemsList: unavailableItems,
        },
      },
    });
  } catch (error) {
    console.error("Reorder error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while processing reorder",
      error: error.message,
    });
  }
};

// Helper functions
const calculateShippingFee = (shippingMethod, subtotal) => {
  const shippingRates = {
    standard: 4.99,
    express: 9.99,
    overnight: 19.99,
  };

  // Free shipping for orders over $50
  if (subtotal >= 50) {
    return 0;
  }

  return shippingRates[shippingMethod] || 4.99;
};

const calculateTax = (subtotal, state) => {
  const taxRates = {
    CA: 0.0825,
    NY: 0.08875,
    TX: 0.0825,
    FL: 0.07,
  };

  const taxRate = taxRates[state] || 0.06;
  return parseFloat((subtotal * taxRate).toFixed(2));
};

const generateOrderNumber = async () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const startOfDay = new Date(date.setHours(0, 0, 0, 0));
  const endOfDay = new Date(date.setHours(23, 59, 59, 999));

  const todaysOrderCount = await Order.countDocuments({
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  });

  const sequence = String(todaysOrderCount + 1).padStart(4, "0");
  return `ORD-${year}${month}${day}-${sequence}`;
};

const getCustomerInfo = async (userId) => {
  const User = require("../../models/User");
  const user = await User.findById(userId).select("email profile");
  return {
    email: user.email,
    firstName: user.profile.firstName,
    lastName: user.profile.lastName,
    phone: user.profile.phone,
  };
};

const updateProductInventory = async (orderItems) => {
  for (const item of orderItems) {
    await Product.findByIdAndUpdate(item.productId, {
      $inc: { "inventory.quantity": -item.quantity },
    });
  }
};

const restoreProductInventory = async (orderItems) => {
  for (const item of orderItems) {
    await Product.findByIdAndUpdate(item.productId, {
      $inc: { "inventory.quantity": item.quantity },
    });
  }
};

const generateTrackingTimeline = (order) => {
  const timeline = [
    {
      status: "ordered",
      description: "Order placed",
      date: order.createdAt,
      completed: true,
    },
  ];

  if (["confirmed", "shipped", "delivered"].includes(order.status)) {
    timeline.push({
      status: "confirmed",
      description: "Order confirmed",
      date: order.updatedAt,
      completed: true,
    });
  }

  if (["shipped", "delivered"].includes(order.status)) {
    timeline.push({
      status: "shipped",
      description: "Order shipped",
      date: order.updatedAt,
      completed: true,
      trackingNumber: order.trackingNumber,
    });
  }

  if (order.status === "delivered") {
    timeline.push({
      status: "delivered",
      description: "Order delivered",
      date: order.updatedAt,
      completed: true,
    });
  }

  return timeline;
};

const calculateEstimatedDelivery = (orderDate, shippingMethod) => {
  const deliveryDays = {
    standard: 7,
    express: 3,
    overnight: 1,
  };

  const estimatedDate = new Date(orderDate);
  estimatedDate.setDate(
    estimatedDate.getDate() + (deliveryDays[shippingMethod] || 7)
  );
  return estimatedDate;
};

module.exports = {
  getUserOrders,
  getOrderById,
  createOrder,
  cancelOrder,
  trackOrder,
  requestReturn,
  reorder,
};
