// controllers/user/wishlistController.js
const Wishlist = require("../../models/Wishlist");
const Product = require("../../models/Product");
const { validationResult } = require("express-validator");

// @desc    Get user's wishlist
// @route   GET /api/user/wishlist
// @access  Private (User)
const getWishlist = async (req, res) => {
  try {
    let wishlist = await Wishlist.findOne({ userId: req.user.userId }).populate(
      {
        path: "items.productId",
        select:
          "name price images inventory.quantity status category",
      }
    );

    if (!wishlist) {
      wishlist = await Wishlist.create({
        userId: req.user.userId,
        items: [],
      });
    }

    // Filter out items where product no longer exists
    const validItems = wishlist.items.filter((item) => item.productId !== null);

    // Calculate price changes
    const itemsWithPriceChanges = validItems.map((item) => {
      const product = item.productId;
      const currentPrice = product.price;
      const priceChange = item.priceAtAdd
        ? currentPrice - item.priceAtAdd
        : null;

      return {
        _id: item._id,
        product: {
          _id: product._id,
          name: product.name,
          price: product.price,
          images: product.images,
          inStock: product.inventory?.quantity > 0,
          stockQuantity: product.inventory?.quantity,
          status: product.status,
          category: product.category,
        },
        addedAt: item.addedAt,
        priceAtAdd: item.priceAtAdd,
        currentPrice,
        priceChange,
        priceDropped: priceChange !== null && priceChange < 0,
        notes: item.notes,
      };
    });

    res.json({
      success: true,
      data: {
        wishlist: {
          _id: wishlist._id,
          items: itemsWithPriceChanges,
          itemsCount: itemsWithPriceChanges.length,
        },
      },
    });
  } catch (error) {
    console.error("Get wishlist error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching wishlist",
      error: error.message,
    });
  }
};

// @desc    Add item to wishlist
// @route   POST /api/user/wishlist
// @access  Private (User)
const addToWishlist = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { productId, notes } = req.body;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Get or create wishlist
    let wishlist = await Wishlist.findOne({ userId: req.user.userId });
    if (!wishlist) {
      wishlist = new Wishlist({
        userId: req.user.userId,
        items: [],
      });
    }

    // Check if product already in wishlist
    const existingItem = wishlist.items.find(
      (item) => item.productId.toString() === productId
    );

    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: "Product already in wishlist",
      });
    }

    // Calculate current price (considering discount)
    const currentPrice = product.price;

    // Add to wishlist
    wishlist.items.push({
      productId,
      priceAtAdd: currentPrice,
      notes: notes || "",
      addedAt: new Date(),
    });

    await wishlist.save();

    res.status(201).json({
      success: true,
      message: "Product added to wishlist",
      data: {
        wishlist: {
          itemsCount: wishlist.itemsCount,
        },
        addedProduct: {
          _id: product._id,
          name: product.name,
          price: product.price,
          images: product.images,
        },
      },
    });
  } catch (error) {
    console.error("Add to wishlist error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while adding to wishlist",
      error: error.message,
    });
  }
};

// @desc    Remove item from wishlist
// @route   DELETE /api/user/wishlist/:productId
// @access  Private (User)
const removeFromWishlist = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { productId } = req.params;

    const wishlist = await Wishlist.findOne({ userId: req.user.userId });
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    const itemIndex = wishlist.items.findIndex(
      (item) => item.productId.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Product not found in wishlist",
      });
    }

    wishlist.items.splice(itemIndex, 1);
    await wishlist.save();

    res.json({
      success: true,
      message: "Product removed from wishlist",
      data: {
        wishlist: {
          itemsCount: wishlist.itemsCount,
        },
      },
    });
  } catch (error) {
    console.error("Remove from wishlist error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while removing from wishlist",
      error: error.message,
    });
  }
};

// @desc    Clear entire wishlist
// @route   DELETE /api/user/wishlist
// @access  Private (User)
const clearWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ userId: req.user.userId });
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    wishlist.items = [];
    await wishlist.save();

    res.json({
      success: true,
      message: "Wishlist cleared successfully",
      data: {
        wishlist: {
          itemsCount: 0,
        },
      },
    });
  } catch (error) {
    console.error("Clear wishlist error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while clearing wishlist",
      error: error.message,
    });
  }
};

// @desc    Check if product is in wishlist
// @route   GET /api/user/wishlist/check/:productId
// @access  Private (User)
const checkProductInWishlist = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { productId } = req.params;

    const wishlist = await Wishlist.findOne({ userId: req.user.userId });

    const inWishlist = wishlist
      ? wishlist.items.some((item) => item.productId.toString() === productId)
      : false;

    res.json({
      success: true,
      data: {
        inWishlist,
        productId,
      },
    });
  } catch (error) {
    console.error("Check wishlist error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while checking wishlist",
      error: error.message,
    });
  }
};

// @desc    Move item from wishlist to cart
// @route   POST /api/user/wishlist/:productId/move-to-cart
// @access  Private (User)
const moveToCart = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { productId } = req.params;
    const { quantity = 1 } = req.body;

    // Check if product exists and is available
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (product.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Product is not available",
      });
    }

    if (product.inventory.quantity < quantity) {
      return res.status(400).json({
        success: false,
        message: "Insufficient stock",
        data: {
          available: product.inventory.quantity,
          requested: quantity,
        },
      });
    }

    // Get wishlist
    const wishlist = await Wishlist.findOne({ userId: req.user.userId });
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    const itemIndex = wishlist.items.findIndex(
      (item) => item.productId.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Product not found in wishlist",
      });
    }

    // Get or create cart
    const Cart = require("../../models/Cart");
    let cart = await Cart.findOne({ userId: req.user.userId });
    if (!cart) {
      cart = new Cart({
        userId: req.user.userId,
        items: [],
      });
    }

    // Check if product already in cart
    const existingCartItem = cart.items.find(
      (item) => item.productId.toString() === productId
    );

    // Calculate total quantity (existing + new)
    const existingQuantity = existingCartItem ? existingCartItem.quantity : 0;
    const totalQuantity = existingQuantity + quantity;

    // Check if total quantity exceeds stock
    if (totalQuantity > product.inventory.quantity) {
      return res.status(400).json({
        success: false,
        message: "Insufficient stock for requested quantity",
        data: {
          available: product.inventory.quantity,
          inCart: existingQuantity,
          requested: quantity,
          maxCanAdd: Math.max(0, product.inventory.quantity - existingQuantity),
        },
      });
    }

    const currentPrice = product.price;

    if (existingCartItem) {
      existingCartItem.quantity = totalQuantity;
    } else {
      cart.items.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity,
        image: product.images?.[0] || "",
      });
    }

    await cart.save();

    // Remove from wishlist
    wishlist.items.splice(itemIndex, 1);
    await wishlist.save();

    res.json({
      success: true,
      message: "Product moved to cart",
      data: {
        wishlist: {
          itemsCount: wishlist.itemsCount,
        },
        cart: {
          itemsCount: cart.items.length,
        },
        product: {
          _id: product._id,
          name: product.name,
        },
      },
    });
  } catch (error) {
    console.error("Move to cart error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while moving to cart",
      error: error.message,
    });
  }
};

// @desc    Update wishlist item notes
// @route   PUT /api/user/wishlist/:productId
// @access  Private (User)
const updateWishlistItem = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { productId } = req.params;
    const { notes } = req.body;

    const wishlist = await Wishlist.findOne({ userId: req.user.userId });
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    const item = wishlist.items.find(
      (item) => item.productId.toString() === productId
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Product not found in wishlist",
      });
    }

    item.notes = notes;
    await wishlist.save();

    res.json({
      success: true,
      message: "Wishlist item updated",
      data: {
        item: {
          productId: item.productId,
          notes: item.notes,
        },
      },
    });
  } catch (error) {
    console.error("Update wishlist item error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating wishlist item",
      error: error.message,
    });
  }
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
  checkProductInWishlist,
  moveToCart,
  updateWishlistItem,
};
