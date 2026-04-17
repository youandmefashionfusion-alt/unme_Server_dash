const mongoose = require("mongoose");

const adminOtpSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    adminEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    purpose: {
      type: String,
      required: true,
      default: "user-management",
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    consumedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

adminOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AdminOtpModel =
  mongoose.models.AdminOtp || mongoose.model("AdminOtp", adminOtpSchema);

export default AdminOtpModel;
