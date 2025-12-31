const Cart = require("../../models/Cart");
const Product = require("../../models/Product");
const ShippingFee = require("../../models/ShippingFee");
const { validationResult } = require("express-validator");

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
const getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.userId }).populate(
      "items.productId",
      "name price images inventory productType packageDetails packageItems category"
    );

    if (!cart) {
      // Create empty cart if it doesn't exist
      const newCart = new Cart({
        userId: req.user.userId,
        items: [],
        summary: {
          itemsCount: 0,
          totalPrice: 0,
          totalDiscount: 0,
          shippingFee: 0,
          taxAmount: 0,
          grandTotal: 0,
        },
      });
      await newCart.save();

      return res.json({
        success: true,
        data: {
          cart: newCart,
        },
      });
    }

    // Update product availability and recalculate totals
    await updateCartItemsAvailability(cart);
    await cart.calculateTotals();
    await cart.save();

    res.json({
      success: true,
      data: {
        cart,
      },
    });
  } catch (error) {
    console.error("Get cart error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching cart",
      error: error.message,
    });
  }
};

// @desc    Add item to cart
// @route   POST /api/cart/items
// @access  Private
const addToCart = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { productId, quantity = 1 } = req.body;

    // Get product details (with package items if it's a package)
    let product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // If it's a package, populate package items
    if (product.productType === "package") {
      product = await Product.findById(productId).populate({
        path: "packageItems.productId",
        select: "name price images inventory status",
      });

      // Check if all package items are available
      for (const pkgItem of product.packageItems) {
        if (!pkgItem.productId || pkgItem.productId.status !== "active") {
          return res.status(400).json({
            success: false,
            message: `Package item "${pkgItem.name}" is not available`,
          });
        }
      }
    }

    // Check product availability
    if (product.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Product is not available",
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ userId: req.user.userId });
    if (!cart) {
      cart = new Cart({ userId: req.user.userId });
    }

    // Check existing quantity in cart
    const existingItem = cart.items.find(
      (item) => item.productId.toString() === productId
    );
    const existingQuantity = existingItem ? existingItem.quantity : 0;
    const totalQuantity = existingQuantity + quantity;

    if (totalQuantity > product.inventory.quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Only ${product.inventory.quantity} available.`,
        data: {
          available: product.inventory.quantity,
          inCart: existingQuantity,
          requested: quantity,
          maxCanAdd: Math.max(0, product.inventory.quantity - existingQuantity),
        },
      });
    }

    // Add item to cart
    const addResult = cart.addItem(product, quantity);
    if (!addResult.success) {
      return res.status(400).json({
        success: false,
        message: addResult.message,
        data: addResult,
      });
    }
    await cart.save();

    // Populate the cart items
    await cart.populate("items.productId", "name price images inventory");

    res.status(201).json({
      success: true,
      message: "Item added to cart successfully",
      data: {
        cart,
      },
    });
  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while adding item to cart",
      error: error.message,
    });
  }
};

// @desc    Update cart item quantity
// @route   PUT /api/cart/items/:itemId
// @access  Private
const updateCartItem = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { itemId } = req.params;
    const { quantity } = req.body;

    const cart = await Cart.findOne({ userId: req.user.userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Find the item in cart
    const cartItem = cart.items.id(itemId);
    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart",
      });
    }

    // Check product availability
    const product = await Product.findById(cartItem.productId);
    if (!product || product.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Product is no longer available",
      });
    }

    if (quantity > product.inventory.quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.inventory.quantity} items available in stock`,
        data: {
          available: product.inventory.quantity,
          requested: quantity,
        },
      });
    }

    // Update quantity with actual stock validation
    const updateResult = cart.updateQuantity(cartItem.productId, quantity, product.inventory.quantity);
    if (!updateResult.success) {
      return res.status(400).json({
        success: false,
        message: updateResult.message,
        data: updateResult,
      });
    }

    await cart.save();
    await cart.populate("items.productId", "name price images inventory");

    res.json({
      success: true,
      message: "Cart item updated successfully",
      data: {
        cart,
      },
    });
  } catch (error) {
    console.error("Update cart item error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating cart item",
      error: error.message,
    });
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/items/:itemId
// @access  Private
const removeFromCart = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { itemId } = req.params;

    const cart = await Cart.findOne({ userId: req.user.userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Find the item in cart
    const cartItem = cart.items.id(itemId);
    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart",
      });
    }

    // Remove item
    cart.removeItem(cartItem.productId);
    await cart.save();
    await cart.populate("items.productId", "name price images inventory");

    res.json({
      success: true,
      message: "Item removed from cart successfully",
      data: {
        cart,
      },
    });
  } catch (error) {
    console.error("Remove from cart error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while removing item from cart",
      error: error.message,
    });
  }
};

// @desc    Clear entire cart
// @route   DELETE /api/cart/clear
// @access  Private
const clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    cart.clearCart();
    await cart.save();

    res.json({
      success: true,
      message: "Cart cleared successfully",
      data: {
        cart,
      },
    });
  } catch (error) {
    console.error("Clear cart error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while clearing cart",
      error: error.message,
    });
  }
};

// @desc    Apply coupon to cart
// @route   POST /api/cart/coupon
// @access  Private
const applyCoupon = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { couponCode } = req.body;
    const userId = req.user.userId;

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Check if cart has items
    if (cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot apply coupon to empty cart",
      });
    }

    // Prepare cart items for validation
    const cartItems = cart.items.map(item => ({
      productId: item.productId._id,
      name: item.productId.name,
      price: item.productId.price,
      quantity: item.quantity,
      category: item.productId.category,
    }));

    // Validate coupon using the Coupon model
    const coupon = await validateCoupon(couponCode, cart.summary.totalPrice, userId, cartItems);
    if (!coupon.valid) {
      return res.status(400).json({
        success: false,
        message: coupon.message,
      });
    }

    // Apply coupon to cart
    cart.coupon = {
      code: couponCode.toUpperCase(),
      couponId: coupon.couponId,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      calculatedDiscount: coupon.calculatedDiscount,
      freeShipping: coupon.freeShipping || false,
      minOrderValue: coupon.minOrderValue,
      maxDiscountAmount: coupon.maxDiscountAmount,
      restrictions: coupon.restrictions,
    };

    await cart.calculateTotals();
    await cart.save();
    await cart.populate("items.productId", "name price images inventory");

    res.json({
      success: true,
      message: coupon.message,
      data: {
        cart,
        coupon: {
          code: couponCode.toUpperCase(),
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          calculatedDiscount: coupon.calculatedDiscount,
          freeShipping: coupon.freeShipping,
        },
      },
    });
  } catch (error) {
    console.error("Apply coupon error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while applying coupon",
      error: error.message,
    });
  }
};

// @desc    Remove coupon from cart
// @route   DELETE /api/cart/coupon
// @access  Private
const removeCoupon = async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    if (!cart.coupon || !cart.coupon.code) {
      return res.status(400).json({
        success: false,
        message: "No coupon applied to cart",
      });
    }

    // Remove coupon
    cart.coupon = undefined;
    await cart.calculateTotals();
    await cart.save();
    await cart.populate("items.productId", "name price images inventory");

    res.json({
      success: true,
      message: "Coupon removed successfully",
      data: {
        cart,
      },
    });
  } catch (error) {
    console.error("Remove coupon error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while removing coupon",
      error: error.message,
    });
  }
};

// @desc    Update shipping address
// @route   PUT /api/cart/shipping
// @access  Private
const updateShippingAddress = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { street, city, state, zipCode, country } = req.body;

    const cart = await Cart.findOne({ userId: req.user.userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Update shipping address
    cart.shippingAddress = {
      street,
      city,
      state,
      zipCode,
      country: country || "USA",
    };

    await cart.calculateTotals();
    await cart.save();
    await cart.populate("items.productId", "name price images inventory");

    res.json({
      success: true,
      message: "Shipping address updated successfully",
      data: {
        cart,
      },
    });
  } catch (error) {
    console.error("Update shipping address error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating shipping address",
      error: error.message,
    });
  }
};

// @desc    Update selected shipping fee
// @route   PATCH /api/cart/shipping-fee
// @access  Private
const updateSelectedShippingFee = async (req, res) => {
  try {
    const { shippingFeeId } = req.body;

    const cart = await Cart.findOne({ userId: req.user.userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const shippingFee = await ShippingFee.findOne({ _id: shippingFeeId, isActive: true });
    if (!shippingFee) {
      return res.status(404).json({
        success: false,
        message: "Shipping fee location not found or inactive",
      });
    }

    // Update cart with shipping fee details
    cart.selectedShippingFee = {
      shippingFeeId: shippingFee._id,
      name: shippingFee.name,
      amount: shippingFee.shippingFee,
      freeShippingThreshold: shippingFee.freeShippingThreshold
    };

    await cart.calculateTotals();
    await cart.save();

    await cart.populate([
      { path: "items.productId", select: "name price images inventory" }
    ]);

    res.json({
      success: true,
      message: `Shipping set to ${shippingFee.name}`,
      data: {
        cart,
      },
    });
  } catch (error) {
    console.error("Update shipping fee error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating shipping fee",
      error: error.message,
    });
  }
};

// @desc    Update cart notes
// @route   PUT /api/cart/notes
// @access  Private
const updateCartNotes = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { notes } = req.body;

    const cart = await Cart.findOne({ userId: req.user.userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    cart.notes = notes;
    await cart.save();
    await cart.populate("items.productId", "name price images inventory");

    res.json({
      success: true,
      message: "Cart notes updated successfully",
      data: {
        cart,
      },
    });
  } catch (error) {
    console.error("Update cart notes error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating cart notes",
      error: error.message,
    });
  }
};

// Helper function to validate coupon (using Coupon model)
const validateCoupon = async (couponCode, cartTotal, userId, cartItems = []) => {
  try {
    const Coupon = require("../../models/Coupon");

    // Find valid coupon by code
    const coupon = await Coupon.findValidByCode(couponCode);

    if (!coupon) {
      return { valid: false, message: "Invalid or expired coupon code" };
    }

    // Check if coupon can be used by this user
    const canUse = await coupon.canBeUsedBy(userId, cartTotal, cartItems);
    if (!canUse.valid) {
      return { valid: false, message: canUse.message };
    }

    // Calculate discount
    const discountInfo = coupon.calculateDiscount(cartTotal, cartItems);

    return {
      valid: true,
      message: "Coupon applied successfully",
      couponId: coupon._id,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      calculatedDiscount: discountInfo.discount,
      freeShipping: discountInfo.freeShipping,
      minOrderValue: coupon.minimumPurchase,
      maxDiscountAmount: coupon.maxDiscountAmount,
      restrictions: {
        categories: coupon.restrictions?.categories || [],
        products: coupon.restrictions?.products || [],
      },
    };
  } catch (error) {
    console.error("Coupon validation error:", error);
    return { valid: false, message: "Error validating coupon" };
  }
};

// Helper function to update cart items availability
const updateCartItemsAvailability = async (cart) => {
  for (let item of cart.items) {
    const product = await Product.findById(item.productId);
    if (!product || product.status !== "active") {
      item.isAvailable = false;
      item.maxQuantity = 0;
    } else {
      item.isAvailable = product.inventory.quantity > 0;
      item.maxQuantity = Math.min(product.inventory.quantity, 100); // Increased default max

      // Adjust quantity if it exceeds available stock
      if (item.quantity > item.maxQuantity) {
        item.quantity = item.maxQuantity;
      }
    }
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  applyCoupon,
  removeCoupon,
  updateShippingAddress,
  updateCartNotes,
  updateSelectedShippingFee,
};
