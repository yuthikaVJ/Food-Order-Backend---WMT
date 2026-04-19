const mongoose = require("mongoose");

const paymentStatusList = ["Pending", "Paid", "Failed", "Refunded"];
const paymentMethodList = [
  "Cash on Delivery",
  "Card",
  "Online Transfer",
  "Wallet",
];

const paymentSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, "Amount cannot be negative"],
    },
    currency: {
      type: String,
      default: "LKR",
      trim: true,
    },
    paymentMethod: {
      type: String,
      enum: paymentMethodList,
      required: [true, "Payment method is required"],
    },
    transactionId: {
      type: String,
      default: "",
      trim: true,
    },
    paymentStatus: {
      type: String,
      enum: paymentStatusList,
      default: "Pending",
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    refundedAt: {
      type: Date,
      default: null,
    },
    statusHistory: [
      {
        _id: false,
        status: {
          type: String,
          enum: paymentStatusList,
          required: true,
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Payment", paymentSchema);
