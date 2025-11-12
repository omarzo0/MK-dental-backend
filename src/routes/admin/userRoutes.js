const express = require("express");
const router = express.Router();
const { adminAuth, requirePermission } = require("../../middleware/adminAuth");

const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  bulkUserOperations,
  getUserActivity,
  searchUsers,
} = require("../../controllers/admin/userManagementController");

const {
  validateGetUsers,
  validateUserId,
  validateCreateUser,
  validateUpdateUser,
  validateDeleteUser,
  validateBulkOperations,
  validateUserSearch,
} = require("../../validations/admin/userManagementValidation");

// All routes require admin authentication and user management permission
router.use(adminAuth);
router.use(requirePermission("canManageUsers"));

router.get("/", validateGetUsers, getAllUsers);
router.get("/search", validateUserSearch, searchUsers);
router.get("/:userId", validateUserId, getUserById);
router.get("/:userId/activity", validateUserId, getUserActivity);
router.post("/", validateCreateUser, createUser);
router.put("/:userId", validateUserId, validateUpdateUser, updateUser);
router.delete("/:userId", validateUserId, validateDeleteUser, deleteUser);
router.post("/bulk", validateBulkOperations, bulkUserOperations);

module.exports = router;
