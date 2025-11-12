const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

// Load environment variables
dotenv.config();

const app = express();

// Security Middleware
app.use(helmet()); // Security headers
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
});
app.use("/api/", limiter);

// More strict rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs for auth
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later.",
  },
});

// Apply auth rate limiting to both user and admin auth routes
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/admin/auth/login", authLimiter);

// Logging
app.use(morgan("combined")); // Use 'dev' for development, 'combined' for production

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static files (if needed)
app.use("/uploads", express.static("uploads"));

// ==================== ROUTES WITH NEW STRUCTURE ====================

// User Routes
const userAuthRoutes = require("./src/routes/user/authRoutes");
const userProfileRoutes = require("./src/routes/user/profileRoutes");
const userOrderRoutes = require("./src/routes/user/orderRoutes");
const userCartRoutes = require("./src/routes/user/cartRoutes");

// Admin Routes
const adminAuthRoutes = require("./src/routes/admin/authRoutes");
const adminDashboardRoutes = require("./src/routes/admin/dashboardRoutes");
const adminUserRoutes = require("./src/routes/admin/userRoutes");
const adminProductRoutes = require("./src/routes/admin/productRoutes");
const adminOrderRoutes = require("./src/routes/admin/orderRoutes");

// Shared Routes
const sharedProductRoutes = require("./src/routes/shared/productRoutes");
const sharedPaymentRoutes = require("./src/routes/shared/paymentRoutes");
const sharedTransactionRoutes = require("./src/routes/shared/transactionRoutes");

// ==================== API ROUTES REGISTRATION ====================

// User API Routes
app.use("/api/auth", userAuthRoutes);
app.use("/api/user/profile", userProfileRoutes);
app.use("/api/user/orders", userOrderRoutes);
app.use("/api/user/cart", userCartRoutes);

// Admin API Routes
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/dashboard", adminDashboardRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin/products", adminProductRoutes);
app.use("/api/admin/orders", adminOrderRoutes);

// Shared API Routes
app.use("/api/products", sharedProductRoutes);
app.use("/api/payments", sharedPaymentRoutes);
app.use("/api/transactions", sharedTransactionRoutes);

// ==================== PUBLIC ROUTES ====================

// Public product routes (no authentication required)
app.get("/api/products/featured", async (req, res) => {
  try {
    const Product = require("./src/models/Product");
    const products = await Product.find({
      featured: true,
      status: "active",
    })
      .limit(8)
      .select("name price images slug category")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { products },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching featured products",
    });
  }
});

app.get("/api/products/category/:category", async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 12 } = req.query;

    const Product = require("./src/models/Product");
    const products = await Product.find({
      category: { $regex: category, $options: "i" },
      status: "active",
    })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select("name price images slug category");

    const totalProducts = await Product.countDocuments({
      category: { $regex: category, $options: "i" },
      status: "active",
    });

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalProducts / limit),
          totalProducts,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching products by category",
    });
  }
});

// Health check with detailed status
app.get("/health", async (req, res) => {
  const healthCheck = {
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: "Unknown",
  };

  try {
    // Check database connection
    if (mongoose.connection.readyState === 1) {
      healthCheck.database = "Connected";

      // Add some basic stats if needed
      const User = require("./src/models/User");
      const Product = require("./src/models/Product");
      const Order = require("./src/models/Order");

      const [userCount, productCount, orderCount] = await Promise.all([
        User.countDocuments(),
        Product.countDocuments(),
        Order.countDocuments(),
      ]);

      healthCheck.stats = {
        users: userCount,
        products: productCount,
        orders: orderCount,
      };
    } else {
      healthCheck.database = "Disconnected";
      healthCheck.status = "WARNING";
    }
  } catch (error) {
    healthCheck.database = "Error";
    healthCheck.status = "ERROR";
    healthCheck.error = error.message;
  }

  res.status(healthCheck.status === "OK" ? 200 : 503).json(healthCheck);
});

// API info endpoint
app.get("/", (req, res) => {
  res.json({
    message: "🛍️ E-Commerce API Server",
    version: "1.0.0",
    documentation: "/api/docs",
    endpoints: {
      auth: {
        user: {
          register: "/api/auth/register",
          login: "/api/auth/login",
          logout: "/api/auth/logout",
        },
        admin: {
          login: "/api/admin/auth/login",
        },
      },
      user: {
        profile: "/api/user/profile",
        orders: "/api/user/orders",
        cart: "/api/user/cart",
      },
      admin: {
        dashboard: "/api/admin/dashboard",
        users: "/api/admin/users",
        products: "/api/admin/products",
        orders: "/api/admin/orders",
        analytics: "/api/admin/analytics",
      },
      public: {
        products: "/api/products",
        featured: "/api/products/featured",
        categories: "/api/products/category/:category",
      },
      shared: {
        payments: "/api/payments",
        transactions: "/api/transactions",
      },
    },
    health: "/health",
  });
});

// 404 handler for undefined routes
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// Global error handling middleware
app.use((error, req, res, next) => {
  console.error("🚫 Global Error Handler:", error);

  // Mongoose validation error
  if (error.name === "ValidationError") {
    const errors = Object.values(error.errors).map((err) => err.message);
    return res.status(400).json({
      success: false,
      message: "Validation Error",
      errors,
    });
  }

  // Mongoose duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`,
    });
  }

  // JWT errors
  if (error.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }

  if (error.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token expired",
    });
  }

  // Default error
  const statusCode = error.statusCode || 500;
  const message = error.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  });
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.error("🚫 Unhandled Promise Rejection:", err);
  // Close server & exit process
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("🚫 Uncaught Exception:", err);
  process.exit(1);
});

// MongoDB connection with better error handling and retry logic
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ Connected to MongoDB: ${conn.connection.host}`);

    // MongoDB connection event listeners
    mongoose.connection.on("connected", () => {
      console.log("✅ MongoDB connected");
    });

    mongoose.connection.on("error", (err) => {
      console.error("🚫 MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("⚠️ MongoDB disconnected");
    });
  } catch (error) {
    console.error("🚫 Failed to connect to MongoDB:", error.message);

    // Retry connection after 5 seconds
    console.log("🔄 Retrying connection in 5 seconds...");
    setTimeout(connectDB, 5000);
  }
};

// Graceful shutdown
const gracefulShutdown = () => {
  console.log("🛑 Received shutdown signal, closing server...");

  mongoose.connection.close(false, () => {
    console.log("✅ MongoDB connection closed.");
    process.exit(0);
  });
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

// Initialize database connection and start server
const startServer = async () => {
  await connectDB();

  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log("\n📁 Route Structure:");
    console.log("   👤 User Routes: /api/auth/*, /api/user/*");
    console.log("   👑 Admin Routes: /api/admin/*");
    console.log("   🔗 Shared Routes: /api/products, /api/payments");
    console.log(
      "   🌐 Public Routes: /api/products/featured, /api/products/category/*"
    );
  });

  // Handle server errors
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`🚫 Port ${PORT} is already in use`);
    } else {
      console.error("🚫 Server error:", error);
    }
    process.exit(1);
  });
};

// Start the server
startServer();

module.exports = app;
