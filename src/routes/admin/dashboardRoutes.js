const express = require("express");
const router = express.Router();
const {
  adminAuth,
  requirePermission,
} = require("../../middleware/adminAuth");

const {
  getDashboardOverview,
  getDashboardStatistics,
  getRealTimeData,
  getSalesPerformance,
  getCustomerInsights,
} = require("../../controllers/admin/dashboardController");

const {
  validateDashboardPeriod,
  validateSalesPerformanceQuery,
} = require("../../validations/admin/dashboardValidation");

// All routes require admin authentication and analytics permission
router.use(adminAuth);
router.use(requirePermission("canViewAnalytics"));

router.get("/", validateDashboardPeriod, getDashboardOverview);
router.get("/statistics", validateDashboardPeriod, getDashboardStatistics);
router.get("/realtime", getRealTimeData);
router.get(
  "/sales-performance",
  validateSalesPerformanceQuery,
  getSalesPerformance
);
router.get("/customer-insights", validateDashboardPeriod, getCustomerInsights);

module.exports = router;
