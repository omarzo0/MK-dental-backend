const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      unique: true,
      trim: true,
      minlength: [2, "Category name must be at least 2 characters"],
      maxlength: [100, "Category name cannot exceed 100 characters"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    
    // Parent category for hierarchical structure
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    
    // Level in hierarchy (0 = root, 1 = child, 2 = grandchild, etc.)
    level: {
      type: Number,
      default: 0,
    },
    
    // Full path of category IDs from root to this category
    path: {
      type: String,
      default: "",
    },
    
    // Image/Icon
    image: {
      url: {
        type: String,
        default: "",
      },
      publicId: {
        type: String,
        default: "",
      },
    },
    icon: {
      type: String, // Icon name or URL
      default: "",
    },
    
    // Display settings
    displayOrder: {
      type: Number,
      default: 0,
    },
    showInMenu: {
      type: Boolean,
      default: true,
    },
    showInHomepage: {
      type: Boolean,
      default: false,
    },
    
    // SEO
    seo: {
      metaTitle: {
        type: String,
        maxlength: 70,
      },
      metaDescription: {
        type: String,
        maxlength: 160,
      },
      metaKeywords: [String],
    },
    
    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
    
    // Statistics (updated periodically)
    statistics: {
      productCount: {
        type: Number,
        default: 0,
      },
      activeProductCount: {
        type: Number,
        default: 0,
      },
      totalSales: {
        type: Number,
        default: 0,
      },
      totalRevenue: {
        type: Number,
        default: 0,
      },
    },
    
    // Custom attributes/filters for this category
    attributes: [
      {
        name: {
          type: String,
          required: true,
        },
        type: {
          type: String,
          enum: ["text", "number", "select", "multiselect", "boolean"],
          default: "text",
        },
        options: [String], // For select/multiselect types
        required: {
          type: Boolean,
          default: false,
        },
        filterable: {
          type: Boolean,
          default: false,
        },
      },
    ],
    
    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ parent: 1 });
categorySchema.index({ path: 1 });
categorySchema.index({ isActive: 1 });
categorySchema.index({ displayOrder: 1 });
categorySchema.index({ showInMenu: 1 });
categorySchema.index({ name: "text", description: "text" });

// Virtual for children categories
categorySchema.virtual("children", {
  ref: "Category",
  localField: "_id",
  foreignField: "parent",
});

// Virtual for full path names
categorySchema.virtual("breadcrumb").get(function () {
  return this.path
    ? this.path.split(",").filter((id) => id.length > 0)
    : [this._id.toString()];
});

// Pre-save middleware to generate slug and update path
categorySchema.pre("save", async function (next) {
  // Generate slug from name if not provided
  if (!this.slug || this.isModified("name")) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    
    // Ensure unique slug
    const existingCategory = await this.constructor.findOne({
      slug: this.slug,
      _id: { $ne: this._id },
    });
    
    if (existingCategory) {
      this.slug = `${this.slug}-${Date.now()}`;
    }
  }
  
  // Update path and level based on parent
  if (this.parent) {
    const parentCategory = await this.constructor.findById(this.parent);
    if (parentCategory) {
      this.level = parentCategory.level + 1;
      this.path = parentCategory.path
        ? `${parentCategory.path},${parentCategory._id}`
        : parentCategory._id.toString();
    }
  } else {
    this.level = 0;
    this.path = "";
  }
  
  next();
});

// Post-save middleware to update product counts
categorySchema.post("save", async function () {
  await this.updateProductCount();
});

// Method to update product count
categorySchema.methods.updateProductCount = async function () {
  const Product = mongoose.model("Product");
  
  const productCount = await Product.countDocuments({ category: this.name });
  const activeProductCount = await Product.countDocuments({
    category: this.name,
    status: "active",
  });
  
  this.statistics.productCount = productCount;
  this.statistics.activeProductCount = activeProductCount;
  
  // Use updateOne to avoid triggering pre-save again
  await this.constructor.updateOne(
    { _id: this._id },
    {
      $set: {
        "statistics.productCount": productCount,
        "statistics.activeProductCount": activeProductCount,
      },
    }
  );
};

// Static method to get category tree
categorySchema.statics.getCategoryTree = async function (options = {}) {
  const { includeInactive = false, rootOnly = false } = options;
  
  const filter = {};
  if (!includeInactive) filter.isActive = true;
  if (rootOnly) filter.parent = null;
  
  const categories = await this.find(filter)
    .sort({ displayOrder: 1, name: 1 })
    .populate({
      path: "children",
      match: includeInactive ? {} : { isActive: true },
      options: { sort: { displayOrder: 1, name: 1 } },
    })
    .lean();
  
  if (rootOnly) {
    return categories;
  }
  
  // Build tree structure
  const buildTree = (items, parentId = null) => {
    return items
      .filter((item) =>
        parentId === null
          ? !item.parent
          : item.parent?.toString() === parentId?.toString()
      )
      .map((item) => ({
        ...item,
        children: buildTree(items, item._id),
      }));
  };
  
  return buildTree(categories);
};

// Static method to get all descendants of a category
categorySchema.statics.getDescendants = async function (categoryId) {
  const category = await this.findById(categoryId);
  if (!category) return [];
  
  const pathPattern = category.path
    ? `${category.path},${category._id}`
    : category._id.toString();
  
  return this.find({
    path: { $regex: new RegExp(`^${pathPattern}`) },
  });
};

// Static method to update all statistics
categorySchema.statics.updateAllStatistics = async function () {
  const categories = await this.find();
  
  for (const category of categories) {
    await category.updateProductCount();
  }
};

// Method to get full path with names
categorySchema.methods.getFullPath = async function () {
  if (!this.path) return [this.name];
  
  const pathIds = this.path.split(",").filter((id) => id.length > 0);
  const ancestors = await this.constructor
    .find({ _id: { $in: pathIds } })
    .select("name")
    .lean();
  
  const ancestorMap = {};
  ancestors.forEach((a) => {
    ancestorMap[a._id.toString()] = a.name;
  });
  
  const pathNames = pathIds.map((id) => ancestorMap[id] || "Unknown");
  pathNames.push(this.name);
  
  return pathNames;
};

const Category = mongoose.model("Category", categorySchema);

module.exports = Category;
