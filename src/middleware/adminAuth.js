const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

const adminAuth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided, authorization denied",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user is admin
    if (decoded.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    // Check if admin exists and is active
    const admin = await Admin.findById(decoded.adminId).select("-password");
    if (!admin || !admin.isActive) {
      return res.status(401).json({
        success: false,
        message: "Token is not valid or admin account is inactive",
      });
    }

    req.admin = {
      ...decoded,
      permissions: admin.permissions,
      profile: admin.profile,
    };

    next();
  } catch (error) {
    console.error("Admin auth middleware error:", error);

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

// Permission middleware
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.admin.permissions || !req.admin.permissions[permission]) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required permission: ${permission}`,
      });
    }
    next();
  };
};

// Check permission middleware (alias for requirePermission)
const checkPermission = (permission) => {
  return (req, res, next) => {
    // Super admin has all permissions
    if (req.admin.role === "superadmin") {
      return next();
    }
    
    if (!req.admin.permissions || !req.admin.permissions[permission]) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required permission: ${permission}`,
      });
    }
    next();
  };
};

// Super Admin only middleware
const isSuperAdmin = async (req, res, next) => {
  try {
    const Admin = require("../models/Admin");
    const admin = await Admin.findById(req.admin.adminId);
    
    if (!admin || admin.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Super admin privileges required.",
      });
    }
    
    next();
  } catch (error) {
    console.error("Super admin check error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during authorization check",
    });
  }
};

module.exports = {
  adminAuth,
  requirePermission,
  checkPermission,
  isSuperAdmin,
};
