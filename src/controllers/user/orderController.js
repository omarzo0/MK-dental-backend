const mongoose = require("mongoose");
const Order = require("../../models/Order");
const Product = require("../../models/Product");
const Cart = require("../../models/Cart");
const Payment = require("../../models/Payment");
const ShippingFee = require("../../models/ShippingFee");
const { validationResult } = require("express-validator");
const { formatImageArray, formatImageUrl } = require("../../utils/imageHelper");

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
      .populate("items.productId", "name images")
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
        orders: orders.map(order => ({
          ...order.toObject(),
          items: order.items.map(item => ({
            ...item.toObject(),
            image: formatImageUrl(req, item.image),
            packageInfo: item.packageInfo ? {
              ...item.packageInfo.toObject(),
              items: item.packageInfo.items.map(pkgItem => ({
                ...pkgItem.toObject(),
                image: formatImageUrl(req, pkgItem.image)
              }))
            } : item.packageInfo,
            productId: item.productId ? {
              ...item.productId.toObject(),
              images: formatImageArray(req, item.productId.images)
            } : item.productId
          }))
        })),
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
      .populate("items.productId", "name images specifications")
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
      .select("name price images");

    res.json({
      success: true,
      data: {
        order: {
          ...order.toObject(),
          items: order.items.map(item => ({
            ...item.toObject(),
            image: formatImageUrl(req, item.image),
            packageInfo: item.packageInfo ? {
              ...item.packageInfo.toObject(),
              items: item.packageInfo.items.map(pkgItem => ({
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
        payment: payment || null,
        relatedProducts: relatedProducts.map(p => ({
          ...p.toObject(),
          images: formatImageArray(req, p.images)
        })),
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
      customerInfo,
      items,
      shippingAddress,
      billingAddress,
      shippingMethod = "standard",
      paymentMethod,
      notes,
    } = req.body;

    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        message: "Shipping address is required",
      });
    }

    const resolvedBillingAddress = (() => {
      // Now we can safely assume shippingAddress exists
      if (!billingAddress || billingAddress.useShippingAddress) {
        return {
          street: shippingAddress.street,
          city: shippingAddress.city,
          state: shippingAddress.state,
          zipCode: shippingAddress.zipCode,
          country: shippingAddress.country,
        };
      }

      return {
        street: billingAddress.street || shippingAddress.street,
        city: billingAddress.city || shippingAddress.city,
        state: billingAddress.state || shippingAddress.state,
        zipCode: billingAddress.zipCode || shippingAddress.zipCode,
        country: billingAddress.country || shippingAddress.country,
      };
    })();
    const resolvedNotes = (() => {
      if (!notes) return undefined;

      if (typeof notes === "string") {
        const trimmed = notes.trim();
        return trimmed ? [{ content: trimmed }] : undefined;
      }

      if (Array.isArray(notes)) {
        const normalized = notes
          .map((n) => {
            if (!n) return null;
            if (typeof n === "string") {
              const trimmed = n.trim();
              return trimmed ? { content: trimmed } : null;
            }
            if (typeof n === "object" && typeof n.content === "string") {
              const trimmed = n.content.trim();
              return trimmed ? { ...n, content: trimmed } : null;
            }
            return null;
          })
          .filter(Boolean);

        return normalized.length > 0 ? normalized : undefined;
      }

      return undefined;
    })();

    const userId = req.user?.userId;
    const isGuestOrder = !userId;

    // Validate required customer info (if not guest, we can still use customerInfo from body if provided, or pull from user)
    const activeCustomerInfo = customerInfo || (req.user ? {
      email: req.user.email,
      firstName: req.user.profile.firstName,
      lastName: req.user.profile.lastName,
      phone: req.user.profile.phone,
    } : null);

    if (!activeCustomerInfo?.email || !activeCustomerInfo?.firstName || !activeCustomerInfo?.lastName) {
      return res.status(400).json({
        success: false,
        message: "Customer information is required (email, firstName, lastName)",
      });
    }

    // Build order items
    let itemsToProcess = items || [];
    let cart = null;

    if (userId) {
      cart = await Cart.findOne({ userId }).populate("items.productId");
      if (itemsToProcess.length === 0 && cart && cart.items.length > 0) {
        itemsToProcess = cart.items;
      }
    }

    if (itemsToProcess.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No items provided for the order",
      });
    }

    const orderItems = [];
    let subtotal = 0;
    let outOfStockItems = [];

    for (const item of itemsToProcess) {
      let product = item.productId;

      // Fetch product if it's just an ID (case for guest orders passed in body)
      if (typeof product === "string" || mongoose.Types.ObjectId.isValid(product)) {
        product = await Product.findById(product);
      }

      if (!product || product.status !== "active") {
        outOfStockItems.push({
          productId: typeof item.productId === "string" ? item.productId : item.productId?._id,
          name: product?.name || "Unknown Product",
          reason: "Product no longer available",
        });
        continue;
      }

      if (product.inventory.quantity < item.quantity) {
        outOfStockItems.push({
          productId: product._id,
          name: product.name,
          reason: `Only ${product.inventory.quantity} available in stock`,
        });
        continue;
      }

      // For package products, also check if all package items are available
      if (product.productType === "package" && product.packageItems) {
        for (const pkgItem of product.packageItems) {
          const pkgProduct = await Product.findById(pkgItem.productId);
          if (!pkgProduct || pkgProduct.status !== "active") {
            outOfStockItems.push({
              productId: product._id,
              name: product.name,
              reason: `Package item "${pkgItem.name}" is no longer available`,
            });
            break;
          }
        }
      }

      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;

      // Build order item
      const orderItem = {
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        subtotal: itemTotal,
        image: formatImageUrl(req, product.images?.[0]),
        productType: product.productType || "single",
      };

      // Add package info if it's a package product
      if (product.productType === "package") {
        orderItem.packageInfo = {
          totalItemsCount: product.packageDetails?.totalItemsCount || 0,
          originalTotalPrice: product.packageDetails?.originalTotalPrice || 0,
          savings: product.packageDetails?.savings || 0,
          savingsPercentage: product.packageDetails?.savingsPercentage || 0,
          items: product.packageItems?.map(item => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            image: formatImageUrl(req, item.image),
          })) || [],
        };
      }

      orderItems.push(orderItem);
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
    let shippingFee = 0;

    // Calculate shipping fee based on governorate (shippingAddress.state)
    const governorateFee = await ShippingFee.findOne({
      name: { $regex: new RegExp(`^${shippingAddress.state}$`, "i") }, // Case-insensitive exact match
      isActive: true
    });

    if (governorateFee) {
      shippingFee = governorateFee.fee;

      // Check for free shipping threshold
      if (governorateFee.freeShippingThreshold !== null && subtotal >= governorateFee.freeShippingThreshold) {
        shippingFee = 0;
      }
    } else {
      shippingFee = calculateShippingFee(shippingMethod, subtotal);
    }

    // Check for coupon and calculate discount
    let discount = 0;
    let couponInfo = null;

    if (cart && cart.coupon && cart.coupon.code) {
      const Coupon = require("../../models/Coupon");
      const coupon = await Coupon.findById(cart.coupon.couponId);

      if (coupon) {
        // Validate coupon one last time
        const canUse = await coupon.canBeUsedBy(userId, subtotal, orderItems);
        if (canUse.valid) {
          const discountInfo = coupon.calculateDiscount(subtotal, orderItems);
          discount = discountInfo.discount;

          if (discountInfo.freeShipping) {
            shippingFee = 0;
          }

          couponInfo = {
            code: coupon.code,
            couponId: coupon._id,
            discount: discount,
            discountValue: coupon.discountValue,
            discountType: coupon.discountType,
          };

          // Record usage
          await coupon.recordUsage(userId);
        }
      }
    }

    const taxAmount = calculateTax(subtotal, shippingAddress.state);
    const total = subtotal + shippingFee + taxAmount - discount;

    // Generate order number
    const orderNumber = await generateOrderNumber();

    // Create order
    const order = new Order({
      orderNumber,
      userId,
      isGuestOrder,
      customer: {
        email: activeCustomerInfo.email,
        firstName: activeCustomerInfo.firstName,
        lastName: activeCustomerInfo.lastName,
        phone: activeCustomerInfo.phone,
        gender: activeCustomerInfo.gender,
        dateOfBirth: activeCustomerInfo.dateOfBirth ? new Date(activeCustomerInfo.dateOfBirth) : undefined,
      },
      items: orderItems,
      totals: {
        subtotal,
        tax: taxAmount,
        shipping: shippingFee,
        discount: discount,
        total,
      },
      shippingAddress,
      billingAddress: (!billingAddress || billingAddress.useShippingAddress)
        ? shippingAddress
        : billingAddress,
      shippingMethod,
      paymentMethod,
      customerNote: typeof notes === "string" ? notes : undefined,
      notes: Array.isArray(notes) ? notes : [],
      coupon: couponInfo,
      status: "pending",
      paymentStatus: "pending",
    });

    await order.save();

    // Clear the cart if user is authenticated
    if (userId) {
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
    }

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

    // Send order confirmation email (non-blocking)
    const { sendOrderConfirmationEmail } = require("../../services/emailService");
    sendOrderConfirmationEmail(order).catch(err => console.error("Failed to send order confirmation email:", err));

    const formattedOrder = {
      ...order.toObject(),
      items: order.items.map(item => ({
        ...item.toObject(),
        image: formatImageUrl(req, item.image),
        packageInfo: item.packageInfo ? {
          ...item.packageInfo.toObject(),
          items: item.packageInfo.items.map(pkgItem => ({
            ...pkgItem.toObject(),
            image: formatImageUrl(req, pkgItem.image)
          }))
        } : undefined
      }))
    };

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        order: formattedOrder,
        payment: {
          id: payment._id,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
        },
        nextStep: paymentMethod === "cod" ? "order_success" : "process_payment",
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

// @desc    Create guest order (no authentication required)
// @route   POST /api/user/orders/guest
// @access  Public
const createGuestOrder = async (req, res) => {
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
      customerInfo,
      items,
      shippingAddress,
      billingAddress,
      shippingMethod = "standard",
      paymentMethod,
      notes,
      couponCode, // Added couponCode
    } = req.body;

    // Validate shipping address is provided
    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        message: "Shipping address is required",
      });
    }

    // Validate required guest info
    if (!customerInfo?.email || !customerInfo?.firstName || !customerInfo?.lastName) {
      return res.status(400).json({
        success: false,
        message: "Customer information is required (email, firstName, lastName)",
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Order items are required",
      });
    }

    // Validate items and calculate totals
    const orderItems = [];
    let subtotal = 0;
    let outOfStockItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);

      if (!product || product.status !== "active") {
        outOfStockItems.push({
          productId: item.productId,
          name: product?.name || "Unknown Product",
          reason: "Product no longer available",
        });
        continue;
      }

      if (product.inventory.quantity < item.quantity) {
        outOfStockItems.push({
          productId: product._id,
          name: product.name,
          reason: `Only ${product.inventory.quantity} available in stock`,
        });
        continue;
      }

      // For package products, also check if all package items are available
      if (product.productType === "package" && product.packageItems) {
        for (const pkgItem of product.packageItems) {
          const pkgProduct = await Product.findById(pkgItem.productId);
          if (!pkgProduct || pkgProduct.status !== "active") {
            outOfStockItems.push({
              productId: product._id,
              name: product.name,
              reason: `Package item "${pkgItem.name}" is no longer available`,
            });
            break;
          }
        }
      }

      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;

      // Build order item
      const orderItem = {
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        subtotal: itemTotal,
        image: product.images?.[0],
        productType: product.productType || "single",
      };

      // Add package info if it's a package product
      if (product.productType === "package") {
        orderItem.packageInfo = {
          totalItemsCount: product.packageDetails?.totalItemsCount || 0,
          originalTotalPrice: product.packageDetails?.originalTotalPrice || 0,
          savings: product.packageDetails?.savings || 0,
          savingsPercentage: product.packageDetails?.savingsPercentage || 0,
          items: product.packageItems?.map(pkgItem => ({
            productId: pkgItem.productId,
            name: pkgItem.name,
            quantity: pkgItem.quantity,
            price: pkgItem.price,
            image: formatImageUrl(req, pkgItem.image),
          })) || [],
        };
      }

      orderItems.push(orderItem);
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
    let shippingFee = calculateShippingFee(shippingMethod, subtotal);

    // Check for governorate specific shipping fee
    const governorateFee = await ShippingFee.findOne({
      name: { $regex: new RegExp(`^${shippingAddress.state}$`, "i") },
      isActive: true
    });
    if (governorateFee) {
      shippingFee = governorateFee.fee;
      if (governorateFee.freeShippingThreshold !== null && subtotal >= governorateFee.freeShippingThreshold) {
        shippingFee = 0;
      }
    }

    // Coupon logic for guest
    let discount = 0;
    let couponInfo = null;
    if (couponCode) {
      const Coupon = require("../../models/Coupon");
      const coupon = await Coupon.findValidByCode(couponCode);
      if (coupon) {
        // Prepare items for validation
        const canUse = await coupon.canBeUsedBy(null, subtotal, orderItems, customerInfo.email);

        if (canUse.valid) {
          const discountInfo = coupon.calculateDiscount(subtotal, orderItems);
          discount = discountInfo.discount;
          if (discountInfo.freeShipping) {
            shippingFee = 0;
          }
          couponInfo = {
            code: coupon.code,
            couponId: coupon._id,
            discount: discount,
            discountValue: coupon.discountValue,
            discountType: coupon.discountType,
          };
        }
      }
    }

    const taxAmount = calculateTax(subtotal, shippingAddress.state);
    const total = subtotal + shippingFee + taxAmount - discount;

    // Generate order number
    const orderNumber = await generateOrderNumber();

    // Ensure billingAddress and notes are resolved (defensive fallback)
    const resolvedBillingAddress = (() => {
      if (!billingAddress || billingAddress.useShippingAddress) {
        return {
          street: shippingAddress.street,
          city: shippingAddress.city,
          state: shippingAddress.state,
          zipCode: shippingAddress.zipCode,
          country: shippingAddress.country,
        };
      }

      return {
        street: billingAddress.street || shippingAddress.street,
        city: billingAddress.city || shippingAddress.city,
        state: billingAddress.state || shippingAddress.state,
        zipCode: billingAddress.zipCode || shippingAddress.zipCode,
        country: billingAddress.country || shippingAddress.country,
      };
    })();

    const resolvedNotes = (() => {
      if (!notes) return undefined;

      if (typeof notes === "string") {
        const trimmed = notes.trim();
        return trimmed ? [{ content: trimmed }] : undefined;
      }

      if (Array.isArray(notes)) {
        const normalized = notes
          .map((n) => {
            if (!n) return null;
            if (typeof n === "string") {
              const trimmed = n.trim();
              return trimmed ? { content: trimmed } : null;
            }
            if (typeof n === "object" && typeof n.content === "string") {
              const trimmed = n.content.trim();
              return trimmed ? { ...n, content: trimmed } : null;
            }
            return null;
          })
          .filter(Boolean);

        return normalized.length > 0 ? normalized : undefined;
      }

      return undefined;
    })();

    // Create guest order
    const order = new Order({
      orderNumber,
      isGuestOrder: true,
      customer: {
        email: customerInfo.email,
        firstName: customerInfo.firstName,
        lastName: customerInfo.lastName,
        phone: customerInfo.phone,
      },
      items: orderItems,
      totals: {
        subtotal,
        tax: taxAmount,
        shipping: shippingFee,
        discount: discount,
        total,
      },
      shippingAddress,
      billingAddress: resolvedBillingAddress,
      shippingMethod,
      paymentMethod,
      notes: resolvedNotes,
      coupon: couponInfo,
      status: "pending",
      paymentStatus: "pending",
    });

    await order.save();

    // Record coupon usage after successful save
    if (couponInfo && couponInfo.couponId) {
      const Coupon = require("../../models/Coupon");
      const coupon = await Coupon.findById(couponInfo.couponId);
      if (coupon) {
        await coupon.recordUsage(null, customerInfo.email);
      }
    }

    // Update product inventory
    await updateProductInventory(orderItems);

    // Create pending payment record
    const payment = new Payment({
      orderId: order._id,
      paymentMethod,
      amount: total,
      currency: "USD",
      status: "pending",
      customerEmail: customerInfo.email,
    });
    await payment.save();

    // Send order confirmation email to customer (non-blocking)
    const { sendOrderConfirmationEmail, sendNewOrderAdminNotification } = require("../../services/emailService");
    sendOrderConfirmationEmail(order).catch(err => console.error("Failed to send order confirmation email:", err));

    // Send notification to admin about new order (non-blocking)
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      sendNewOrderAdminNotification(order, adminEmail).catch(err => console.error("Failed to send admin notification email:", err));
    }

    const formattedOrder = {
      ...order.toObject(),
      items: order.items.map(item => ({
        ...item.toObject(),
        image: formatImageUrl(req, item.image),
        packageInfo: item.packageInfo ? {
          ...item.packageInfo.toObject(),
          items: item.packageInfo.items.map(pkgItem => ({
            ...pkgItem.toObject(),
            image: formatImageUrl(req, pkgItem.image)
          }))
        } : undefined
      }))
    };

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        order: formattedOrder,
        payment: {
          id: payment._id,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
        },
        nextStep: paymentMethod === "cod" ? "order_success" : "process_payment",
        guestOrderTracking: {
          orderNumber: order.orderNumber,
          email: customerInfo.email,
          trackingUrl: `/api/user/orders/track/${order.orderNumber}?email=${customerInfo.email}`,
        },
      },
    });
  } catch (error) {
    console.error("Create guest order error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating order",
      error: error.message,
    });
  }
};
// @desc    Track order by order number (for guests)
// @route   GET /api/user/orders/track/:orderNumber
// @access  Public (with email verification)
const trackGuestOrder = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required to track guest orders",
      });
    }

    const order = await Order.findOne({
      orderNumber: orderNumber.toUpperCase(),
      "customer.email": email.toLowerCase(),
    }).select("orderNumber status trackingNumber shippingAddress shippingMethod createdAt updatedAt items totals customer isGuestOrder");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found. Please check the order number and email.",
      });
    }

    // Generate tracking timeline
    const trackingTimeline = generateTrackingTimeline(order);

    res.json({
      success: true,
      data: {
        order: {
          orderNumber: order.orderNumber,
          status: order.status,
          trackingNumber: order.trackingNumber,
          shippingMethod: order.shippingMethod,
          itemsCount: order.items.length,
          total: order.totals.total,
          createdAt: order.createdAt,
          estimatedDelivery: calculateEstimatedDelivery(
            order.createdAt,
            order.shippingMethod
          ),
        },
        timeline: trackingTimeline,
        shippingAddress: {
          city: order.shippingAddress.city,
          state: order.shippingAddress.state,
          zipCode: order.shippingAddress.zipCode,
        },
        items: order.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          image: item.image,
        })),
      },
    });
  } catch (error) {
    console.error("Track guest order error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while tracking order",
      error: error.message,
    });
  }
};

// @desc    Get detailed order timeline
// @route   GET /api/user/orders/:orderId/timeline
// @access  Private (User)
const getOrderTimeline = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;

    const order = await Order.findOne({
      _id: orderId,
      userId: userId,
    }).select("orderNumber status trackingNumber statusHistory shippingMethod createdAt updatedAt deliveredAt shippedAt confirmedAt");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Build detailed timeline
    const timeline = [];

    // Order placed
    timeline.push({
      status: "placed",
      title: "Order Placed",
      description: `Order #${order.orderNumber} has been received`,
      date: order.createdAt,
      completed: true,
      icon: "shopping-cart",
    });

    // Payment confirmed (if applicable)
    if (order.paymentStatus === "paid" || ["confirmed", "processing", "shipped", "delivered"].includes(order.status)) {
      timeline.push({
        status: "payment",
        title: "Payment Confirmed",
        description: "Payment has been successfully processed",
        date: order.confirmedAt || order.createdAt,
        completed: true,
        icon: "credit-card",
      });
    }

    // Order confirmed
    if (["confirmed", "processing", "shipped", "delivered"].includes(order.status)) {
      timeline.push({
        status: "confirmed",
        title: "Order Confirmed",
        description: "Your order has been confirmed and is being prepared",
        date: order.confirmedAt || order.createdAt,
        completed: true,
        icon: "check-circle",
      });
    }

    // Processing
    if (["processing", "shipped", "delivered"].includes(order.status)) {
      timeline.push({
        status: "processing",
        title: "Processing",
        description: "Your order is being prepared for shipment",
        date: order.updatedAt,
        completed: true,
        icon: "package",
      });
    }

    // Shipped
    if (["shipped", "delivered"].includes(order.status)) {
      timeline.push({
        status: "shipped",
        title: "Shipped",
        description: order.trackingNumber
          ? `Package shipped with tracking number: ${order.trackingNumber}`
          : "Your package has been shipped",
        date: order.shippedAt || order.updatedAt,
        completed: true,
        icon: "truck",
        trackingNumber: order.trackingNumber,
      });
    }

    // Out for delivery (if status exists)
    if (order.status === "out_for_delivery" || order.status === "delivered") {
      timeline.push({
        status: "out_for_delivery",
        title: "Out for Delivery",
        description: "Your package is out for delivery",
        date: order.updatedAt,
        completed: order.status === "delivered",
        icon: "map-pin",
      });
    }

    // Delivered
    if (order.status === "delivered") {
      timeline.push({
        status: "delivered",
        title: "Delivered",
        description: "Package has been delivered successfully",
        date: order.deliveredAt || order.updatedAt,
        completed: true,
        icon: "home",
      });
    }

    // Add estimated steps for non-delivered orders
    if (!["delivered", "cancelled", "refunded"].includes(order.status)) {
      const estimatedDelivery = calculateEstimatedDelivery(order.createdAt, order.shippingMethod);

      if (order.status !== "shipped") {
        timeline.push({
          status: "shipped",
          title: "Shipping",
          description: "Estimated shipping date",
          date: null,
          completed: false,
          isEstimate: true,
          icon: "truck",
        });
      }

      timeline.push({
        status: "delivered",
        title: "Estimated Delivery",
        description: `Expected by ${estimatedDelivery.toLocaleDateString()}`,
        date: estimatedDelivery,
        completed: false,
        isEstimate: true,
        icon: "home",
      });
    }

    res.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        currentStatus: order.status,
        timeline,
        trackingNumber: order.trackingNumber,
        estimatedDelivery: calculateEstimatedDelivery(order.createdAt, order.shippingMethod),
      },
    });
  } catch (error) {
    console.error("Get order timeline error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching timeline",
      error: error.message,
    });
  }
};

// @desc    Download order invoice
// @route   GET /api/user/orders/:orderId/invoice
// @access  Private (User)
const downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;

    const order = await Order.findOne({
      _id: orderId,
      userId: userId,
    }).populate("items.productId", "name");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Generate invoice data (could be used to generate PDF)
    const invoiceData = {
      invoiceNumber: `INV-${order.orderNumber}`,
      orderNumber: order.orderNumber,
      orderDate: order.createdAt,
      customer: order.customer,
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress || order.shippingAddress,
      items: order.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.subtotal,
      })),
      totals: order.totals,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      status: order.status,
    };

    res.json({
      success: true,
      message: "Invoice data retrieved",
      data: {
        invoice: invoiceData,
        downloadUrl: `/api/user/orders/${orderId}/invoice/pdf`, // Future PDF endpoint
      },
    });
  } catch (error) {
    console.error("Download invoice error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while generating invoice",
      error: error.message,
    });
  }
};

module.exports = {
  getUserOrders,
  getOrderById,
  createOrder,
  cancelOrder,
  trackOrder,
  requestReturn,
  reorder,
  createGuestOrder,
  trackGuestOrder,
  getOrderTimeline,
  downloadInvoice,
};
