const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    // Settings category identifier
    key: {
      type: String,
      required: true,
      unique: true,
      enum: [
        "store",
        "payment",
        "social",
        "appearance",
        "security",
      ],
    },

    // Store Information Settings
    store: {
      name: {
        type: String,
        default: "MK Dental",
      },
      tagline: {
        type: String,
        default: "",
      },
      description: {
        type: String,
        default: "",
      },
      logo: {
        url: String,
        publicId: String,
      },
      favicon: {
        url: String,
        publicId: String,
      },
      contact: {
        email: String,
        phone: String,
        whatsapp: String,
        supportEmail: String,
      },
      address: {
        street: String,
        city: String,
        state: String,
        postalCode: String,
        country: String,
      },
      businessHours: {
        monday: { open: String, close: String, closed: Boolean },
        tuesday: { open: String, close: String, closed: Boolean },
        wednesday: { open: String, close: String, closed: Boolean },
        thursday: { open: String, close: String, closed: Boolean },
        friday: { open: String, close: String, closed: Boolean },
        saturday: { open: String, close: String, closed: Boolean },
        sunday: { open: String, close: String, closed: Boolean },
      },
      currency: {
        code: { type: String, default: "USD" },
        symbol: { type: String, default: "$" },
        position: { type: String, enum: ["before", "after"], default: "before" },
      },
      timezone: {
        type: String,
        default: "UTC",
      },
      language: {
        type: String,
        default: "en",
      },
    },

    // Payment Settings
    payment: {
      methods: [
        {
          name: {
            type: String,
            enum: [
              "stripe",
              "paypal",
              "cash_on_delivery",
              "bank_transfer",
              "credit_card",
            ],
          },
          enabled: { type: Boolean, default: false },
          displayName: String,
          description: String,
          instructions: String,
          testMode: { type: Boolean, default: true },
          credentials: {
            // Encrypted or reference to secure storage
            publicKey: String,
            secretKey: String,
            webhookSecret: String,
          },
          fees: {
            type: { type: String, enum: ["percentage", "fixed"] },
            value: Number,
          },
          order: { type: Number, default: 0 },
        },
      ],
      defaultMethod: String,
      minimumOrderAmount: { type: Number, default: 0 },
      taxSettings: {
        enabled: { type: Boolean, default: false },
        taxRate: { type: Number, default: 0 },
        taxInclusive: { type: Boolean, default: false },
        taxLabel: { type: String, default: "Tax" },
      },
    },


    // Social Media Settings
    social: {
      links: {
        facebook: String,
        instagram: String,
        twitter: String,
        linkedin: String,
        youtube: String,
        tiktok: String,
        pinterest: String,
      },
      sharing: {
        enabled: { type: Boolean, default: true },
        platforms: [String],
      },
    },

    // Appearance Settings
    appearance: {
      theme: {
        primaryColor: { type: String, default: "#007bff" },
        secondaryColor: { type: String, default: "#6c757d" },
        accentColor: { type: String, default: "#28a745" },
      },
      homepage: {
        heroEnabled: { type: Boolean, default: true },
        featuredProductsCount: { type: Number, default: 8 },
        newArrivalsCount: { type: Number, default: 8 },
        showCategories: { type: Boolean, default: true },
      },
      productPage: {
        showRelatedProducts: { type: Boolean, default: true },
        relatedProductsCount: { type: Number, default: 4 },
        showReviews: { type: Boolean, default: true },
        enableZoom: { type: Boolean, default: true },
      },
      catalog: {
        defaultView: { type: String, enum: ["grid", "list"], default: "grid" },
        productsPerPage: { type: Number, default: 20 },
        defaultSortOrder: { type: String, default: "newest" },
        showOutOfStock: { type: Boolean, default: true },
      },
    },


    // Security Settings
    security: {
      passwordMinLength: { type: Number, default: 8 },
      requireStrongPassword: { type: Boolean, default: true },
      sessionTimeout: { type: Number, default: 30 }, // minutes
      maxLoginAttempts: { type: Number, default: 5 },
      lockoutDuration: { type: Number, default: 15 }, // minutes
      twoFactorAuth: { type: Boolean, default: false },
      recaptcha: {
        enabled: { type: Boolean, default: false },
        siteKey: String,
        secretKey: String,
      },
    },

    // Metadata
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
    strict: false, // Allow dynamic fields for flexibility
  }
);

// Indexes
settingsSchema.index({ key: 1 }, { unique: true });

// Static method to get settings by key
settingsSchema.statics.getByKey = async function (key) {
  let settings = await this.findOne({ key });

  if (!settings) {
    // Create default settings if not exists
    settings = await this.create({ key });
  }

  return settings;
};

// Static method to update settings
settingsSchema.statics.updateByKey = async function (key, data, adminId) {
  const settings = await this.findOneAndUpdate(
    { key },
    { $set: { [key]: data, updatedBy: adminId } },
    { new: true, upsert: true, runValidators: true }
  );

  return settings;
};

// Static method to get all settings
settingsSchema.statics.getAllSettings = async function () {
  const settingsKeys = [
    "store",
    "payment",
    "social",
    "appearance",
    "security",
  ];

  const allSettings = {};

  for (const key of settingsKeys) {
    const settings = await this.getByKey(key);
    allSettings[key] = settings[key] || {};
  }

  return allSettings;
};

// Method to get specific setting value
settingsSchema.methods.getValue = function (path) {
  const keys = path.split(".");
  let value = this[this.key];

  for (const key of keys) {
    if (value && typeof value === "object") {
      value = value[key];
    } else {
      return undefined;
    }
  }

  return value;
};

const Settings = mongoose.model("Settings", settingsSchema);

module.exports = Settings;
