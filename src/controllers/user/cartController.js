const Cart = require("../../models/Cart");
const Product = require("../../models/Product");
const { validationResult } = require("express-validator");

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
const getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.userId }).populate(
      "items.productId",
      "name price images inventory slug"
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

    // Get product details
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check product availability
    if (product.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Product is not available",
      });
    }

    if (product.inventory.quantity < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.inventory.quantity} items available in stock`,
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ userId: req.user.userId });
    if (!cart) {
      cart = new Cart({ userId: req.user.userId });
    }

    // Add item to cart
    cart.addItem(product, quantity);
    await cart.save();

    // Populate the cart items
    await cart.populate("items.productId", "name price images inventory slug");

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
      });
    }

    // Update quantity
    const success = cart.updateQuantity(cartItem.productId, quantity);
    if (!success) {
      return res.status(400).json({
        success: false,
        message: "Failed to update item quantity",
      });
    }

    await cart.save();
    await cart.populate("items.productId", "name price images inventory slug");

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
    await cart.populate("items.productId", "name price images inventory slug");

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

    const cart = await Cart.findOne({ userId: req.user.userId });
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

    // In a real application, you would validate the coupon against a database
    // For now, we'll simulate coupon validation
    const coupon = await validateCoupon(couponCode, cart.summary.totalPrice);
    if (!coupon.valid) {
      return res.status(400).json({
        success: false,
        message: coupon.message,
      });
    }

    // Apply coupon to cart
    cart.coupon = {
      code: couponCode,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minOrderValue: coupon.minOrderValue,
    };

    await cart.calculateTotals();
    await cart.save();
    await cart.populate("items.productId", "name price images inventory slug");

    res.json({
      success: true,
      message: "Coupon applied successfully",
      data: {
        cart,
        discount: coupon.discountValue,
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
    await cart.populate("items.productId", "name price images inventory slug");

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

    // Recalculate shipping fee based on address (simplified)
    cart.summary.shippingFee = calculateShippingFee(cart, state);
    await cart.calculateTotals();
    await cart.save();
    await cart.populate("items.productId", "name price images inventory slug");

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
    await cart.populate("items.productId", "name price images inventory slug");

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

// Helper function to validate coupon (simulated)
const validateCoupon = async (couponCode, cartTotal) => {
  // In a real application, you would query a coupons collection
  const coupons = {
    WELCOME10: {
      discountType: "percentage",
      discountValue: 10,
      minOrderValue: 50,
      valid: true,
    },
    SAVE20: {
      discountType: "fixed",
      discountValue: 20,
      minOrderValue: 100,
      valid: true,
    },
    FREESHIP: {
      discountType: "shipping",
      discountValue: 0,
      minOrderValue: 75,
      valid: true,
    },
  };

  const coupon = coupons[couponCode.toUpperCase()];

  if (!coupon) {
    return { valid: false, message: "Invalid coupon code" };
  }

  if (!coupon.valid) {
    return { valid: false, message: "Coupon is no longer valid" };
  }

  if (cartTotal < coupon.minOrderValue) {
    return {
      valid: false,
      message: `Minimum order value of $${coupon.minOrderValue} required for this coupon`,
    };
  }

  return { ...coupon, valid: true, message: "Coupon applied successfully" };
};

// Helper function to calculate shipping fee (simplified)
const calculateShippingFee = (cart, state) => {
  const freeShippingStates = ["CA", "NY", "TX", "FL"];
  const baseShipping = 9.99;
  const freeShippingThreshold = 75;

  if (
    cart.summary.totalPrice >= freeShippingThreshold &&
    freeShippingStates.includes(state)
  ) {
    return 0;
  }

  return baseShipping;
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
      item.maxQuantity = Math.min(product.inventory.quantity, 10);

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
};
