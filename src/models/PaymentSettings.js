const mongoose = require("mongoose");

const paymentSettingsSchema = new mongoose.Schema(
  {
    methods: [
      {
        name: {
          type: String,
          required: true,
        },
        enabled: { type: Boolean, default: false },
        displayName: String,
        description: String,
        instructions: String,
        icon: String,
        testMode: { type: Boolean, default: true },
        credentials: {
          publicKey: String,
          secretKey: String,
          webhookSecret: String,
        },
        fees: {
          type: { type: String, enum: ["percentage", "fixed"] },
          value: Number,
        },
        minAmount: { type: Number, default: 0 },
        maxAmount: { type: Number },
        order: { type: Number, default: 0 },
      },
    ],
    defaultMethod: String,
    minimumOrderAmount: { type: Number, default: 0 },
    codSettings: {
      enabled: { type: Boolean, default: true },
      maxOrderAmount: { type: Number },
      verificationRequired: { type: Boolean, default: false },
      allowedCities: [String],
    },
    taxSettings: {
      enabled: { type: Boolean, default: false },
      taxRate: { type: Number, default: 0 },
      taxInclusive: { type: Boolean, default: false },
      taxLabel: { type: String, default: "Tax" },
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
  }
);

// Static method to get payment settings (singleton pattern)
paymentSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  
  if (!settings) {
    // Create default settings if not exists
    settings = await this.create({
      methods: [],
      defaultMethod: null,
      minimumOrderAmount: 0,
    });
  }
  
  return settings;
};

// Static method to update payment settings
paymentSettingsSchema.statics.updateSettings = async function (data, adminId) {
  let settings = await this.findOne();
  
  if (!settings) {
    settings = new this(data);
    settings.updatedBy = adminId;
    await settings.save();
  } else {
    Object.assign(settings, data);
    settings.updatedBy = adminId;
    await settings.save();
  }
  
  return settings;
};

const PaymentSettings = mongoose.model("PaymentSettings", paymentSettingsSchema);

module.exports = PaymentSettings;
