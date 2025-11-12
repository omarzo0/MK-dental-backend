const jwt = require("jsonwebtoken");
const User = require("../models/User");

const userAuth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided, authorization denied",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user is regular user
    if (decoded.role !== "user") {
      return res.status(403).json({
        success: false,
        message: "Access denied. User privileges required.",
      });
    }

    // Check if user exists and is active
    const user = await User.findById(decoded.userId).select("-password");
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Token is not valid or user account is inactive",
      });
    }

    req.user = {
      ...decoded,
      profile: user.profile,
      preferences: user.preferences,
      address: user.address,
    };

    next();
  } catch (error) {
    console.error("User auth middleware error:", error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    res.status(401).json({
      success: false,
      message: "Token is not valid",
    });
  }
};

// User permission middleware (for future role-based user features)
const requireUserPermission = (permission) => {
  return (req, res, next) => {
    // For now, all authenticated users have basic permissions
    // You can extend this for premium users, etc.
    const userPermissions = {
      canViewProducts: true,
      canPlaceOrders: true,
      canManageCart: true,
      canWriteReviews: true,
      canUpdateProfile: true,
    };

    if (!userPermissions[permission]) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required permission: ${permission}`,
      });
    }
    next();
  };
};

// Optional auth middleware (for routes that work with or without auth)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return next(); // Continue without user data
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role === "user") {
      const user = await User.findById(decoded.userId).select("-password");
      if (user && user.isActive) {
        req.user = {
          ...decoded,
          profile: user.profile,
          preferences: user.preferences,
        };
      }
    } else if (decoded.role === "admin") {
      const admin = await Admin.findById(decoded.adminId).select("-password");
      if (admin && admin.isActive) {
        req.admin = decoded;
      }
    }

    next();
  } catch (error) {
    // For optional auth, we don't block the request on token errors
    // Just continue without authentication
    next();
  }
};

module.exports = {
  userAuth,
  requireUserPermission,
  optionalAuth,
};
