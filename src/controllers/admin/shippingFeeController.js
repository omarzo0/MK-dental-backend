const ShippingFee = require("../../models/ShippingFee");
const { validationResult } = require("express-validator");

// @desc    Get all shipping fees
// @route   GET /api/admin/shipping-fees
// @access  Private (Admin)
const getAllShippingFees = async (req, res) => {
    try {
        const { page = 1, limit = 20, isActive, search } = req.query;

        const filter = {};

        if (isActive !== undefined) {
            filter.isActive = isActive === "true";
        }

        if (search) {
            filter.name = { $regex: search, $options: "i" };
        }

        const shippingFees = await ShippingFee.find(filter)
            .sort({ name: 1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .populate("createdBy", "username")
            .populate("updatedBy", "username");

        const total = await ShippingFee.countDocuments(filter);

        res.json({
            success: true,
            data: {
                shippingFees,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    total,
                    hasNext: page * limit < total,
                    hasPrev: page > 1,
                },
            },
        });
    } catch (error) {
        console.error("Get shipping fees error:", error);
        res.status(500).json({
            success: false,
            message: "Server error while fetching shipping fees",
            error: error.message,
        });
    }
};

// @desc    Get shipping fee by ID
// @route   GET /api/admin/shipping-fees/:id
// @access  Private (Admin)
const getShippingFeeById = async (req, res) => {
    try {
        const { id } = req.params;

        const shippingFee = await ShippingFee.findById(id)
            .populate("createdBy", "username")
            .populate("updatedBy", "username");

        if (!shippingFee) {
            return res.status(404).json({
                success: false,
                message: "Shipping fee not found",
            });
        }

        res.json({
            success: true,
            data: { shippingFee },
        });
    } catch (error) {
        console.error("Get shipping fee error:", error);
        res.status(500).json({
            success: false,
            message: "Server error while fetching shipping fee",
            error: error.message,
        });
    }
};

// @desc    Create new shipping fee
// @route   POST /api/admin/shipping-fees
// @access  Private (Admin)
const createShippingFee = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: errors.array(),
            });
        }

        const { name, fee, isFreeShipping = false, isActive = true } = req.body;

        // Check if name already exists
        const existing = await ShippingFee.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: "A shipping fee for this location already exists",
            });
        }

        const shippingFee = new ShippingFee({
            name,
            fee,
            isFreeShipping,
            isActive,
            createdBy: req.admin.adminId,
        });

        await shippingFee.save();

        res.status(201).json({
            success: true,
            message: "Shipping fee created successfully",
            data: { shippingFee },
        });
    } catch (error) {
        console.error("Create shipping fee error:", error);
        res.status(500).json({
            success: false,
            message: "Server error while creating shipping fee",
            error: error.message,
        });
    }
};

// @desc    Update shipping fee
// @route   PUT /api/admin/shipping-fees/:id
// @access  Private (Admin)
const updateShippingFee = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: errors.array(),
            });
        }

        const { id } = req.params;
        const { name, fee, isFreeShipping, isActive } = req.body;

        const shippingFee = await ShippingFee.findById(id);
        if (!shippingFee) {
            return res.status(404).json({
                success: false,
                message: "Shipping fee not found",
            });
        }

        if (name && name !== shippingFee.name) {
            const existing = await ShippingFee.findOne({
                name: { $regex: new RegExp(`^${name}$`, "i") },
                _id: { $ne: id }
            });
            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: "A shipping fee for this location already exists",
                });
            }
            shippingFee.name = name;
        }

        if (fee !== undefined) shippingFee.fee = fee;
        if (isFreeShipping !== undefined) shippingFee.isFreeShipping = isFreeShipping;
        if (isActive !== undefined) shippingFee.isActive = isActive;

        shippingFee.updatedBy = req.admin.adminId;
        await shippingFee.save();

        res.json({
            success: true,
            message: "Shipping fee updated successfully",
            data: { shippingFee },
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

// @desc    Delete shipping fee
// @route   DELETE /api/admin/shipping-fees/:id
// @access  Private (Admin)
const deleteShippingFee = async (req, res) => {
    try {
        const { id } = req.params;

        const shippingFee = await ShippingFee.findById(id);
        if (!shippingFee) {
            return res.status(404).json({
                success: false,
                message: "Shipping fee not found",
            });
        }

        await ShippingFee.findByIdAndDelete(id);

        res.json({
            success: true,
            message: "Shipping fee deleted successfully",
        });
    } catch (error) {
        console.error("Delete shipping fee error:", error);
        res.status(500).json({
            success: false,
            message: "Server error while deleting shipping fee",
            error: error.message,
        });
    }
};

// @desc    Toggle shipping fee status
// @route   PATCH /api/admin/shipping-fees/:id/toggle
// @access  Private (Admin)
const toggleShippingFeeStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const shippingFee = await ShippingFee.findById(id);
        if (!shippingFee) {
            return res.status(404).json({
                success: false,
                message: "Shipping fee not found",
            });
        }

        shippingFee.isActive = !shippingFee.isActive;
        shippingFee.updatedBy = req.admin.adminId;
        await shippingFee.save();

        res.json({
            success: true,
            message: `Shipping fee ${shippingFee.isActive ? "activated" : "deactivated"} successfully`,
            data: {
                shippingFee: {
                    _id: shippingFee._id,
                    name: shippingFee.name,
                    isActive: shippingFee.isActive,
                },
            },
        });
    } catch (error) {
        console.error("Toggle shipping fee error:", error);
        res.status(500).json({
            success: false,
            message: "Server error while toggling shipping fee status",
            error: error.message,
        });
    }
};

module.exports = {
    getAllShippingFees,
    getShippingFeeById,
    createShippingFee,
    updateShippingFee,
    deleteShippingFee,
    toggleShippingFeeStatus,
};
