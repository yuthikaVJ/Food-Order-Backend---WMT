const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");

const Order = require("../models/Order");
const Payment = require("../models/Payment");

const paymentStatusList = ["Pending", "Paid", "Failed", "Refunded"];
const paymentMethodList = [
  "Cash on Delivery",
  "Card",
  "Online Transfer",
  "Wallet",
];

const canAccessOrder = (order, user) => {
  return (
    user.role === "admin" || order.user.toString() === user._id.toString()
  );
};

const getInitialPaymentStatus = (paymentMethod, requestedStatus) => {
  if (requestedStatus) {
    return requestedStatus;
  }

  if (paymentMethod === "Cash on Delivery") {
    return "Pending";
  }

  return "Paid";
};

const applyPaymentStatusDates = (payment, nextStatus) => {
  if (nextStatus === "Paid" && !payment.paidAt) {
    payment.paidAt = new Date();
  }

  if (nextStatus !== "Paid") {
    payment.paidAt = nextStatus === "Refunded" ? payment.paidAt : null;
  }

  if (nextStatus === "Refunded") {
    payment.refundedAt = new Date();
  }

  if (nextStatus !== "Refunded") {
    payment.refundedAt = null;
  }
};

const syncOrderPaymentFields = async (order, payment) => {
  order.payment = payment._id;
  order.paymentStatus = payment.paymentStatus;
  order.paymentMethod = payment.paymentMethod;
  await order.save();
};

const clearOrderPaymentFields = async (order) => {
  order.payment = null;
  order.paymentStatus = "Pending";
  order.paymentMethod = "";
  await order.save();
};

const isValidPaymentTransition = (currentStatus, nextStatus) => {
  if (currentStatus === nextStatus) {
    return false;
  }

  const allowedTransitions = {
    Pending: ["Paid", "Failed"],
    Failed: ["Pending", "Paid"],
    Paid: ["Refunded"],
    Refunded: [],
  };

  return allowedTransitions[currentStatus].includes(nextStatus);
};

const recordPayment = asyncHandler(async (req, res) => {
  const { orderId, paymentMethod, paymentStatus, transactionId, notes } =
    req.body;

  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
    res.status(400);
    throw new Error("A valid orderId is required");
  }

  if (!paymentMethod || !paymentMethodList.includes(paymentMethod)) {
    res.status(400);
    throw new Error(
      "Valid paymentMethod is required. Use Cash on Delivery, Card, Online Transfer, or Wallet"
    );
  }

  if (paymentStatus && !paymentStatusList.includes(paymentStatus)) {
    res.status(400);
    throw new Error(
      "Invalid payment status. Use Pending, Paid, Failed, or Refunded"
    );
  }

  if (req.user.role !== "admin" && paymentStatus === "Refunded") {
    res.status(403);
    throw new Error("Only admin can mark a payment as refunded");
  }

  const order = await Order.findById(orderId);

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  if (!canAccessOrder(order, req.user)) {
    res.status(403);
    throw new Error("You can only record payment for your own order");
  }

  const nextStatus = getInitialPaymentStatus(paymentMethod, paymentStatus);
  let payment = await Payment.findOne({ order: orderId });
  const isNewPayment = !payment;

  if (isNewPayment && nextStatus === "Refunded") {
    res.status(400);
    throw new Error("A new payment cannot start with refunded status");
  }

  if (payment && payment.paymentStatus === "Refunded") {
    res.status(400);
    throw new Error("This payment has already been refunded");
  }

  if (!payment) {
    payment = await Payment.create({
      order: order._id,
      user: order.user,
      amount: order.totalPrice,
      paymentMethod,
      transactionId: transactionId || "",
      paymentStatus: nextStatus,
      notes: notes || "",
      statusHistory: [
        {
          status: nextStatus,
        },
      ],
    });
  } else {
    if (
      payment.paymentStatus !== nextStatus &&
      !isValidPaymentTransition(payment.paymentStatus, nextStatus)
    ) {
      res.status(400);
      throw new Error(
        "Invalid payment status transition. Allowed: Pending -> Paid/Failed, Failed -> Pending/Paid, Paid -> Refunded"
      );
    }

    payment.paymentMethod = paymentMethod;

    if (typeof transactionId !== "undefined") {
      payment.transactionId = transactionId;
    }

    if (typeof notes !== "undefined") {
      payment.notes = notes;
    }

    if (payment.paymentStatus !== nextStatus) {
      payment.paymentStatus = nextStatus;
      payment.statusHistory.push({
        status: nextStatus,
      });
    }

    payment.amount = order.totalPrice;
    await payment.save();
  }

  applyPaymentStatusDates(payment, payment.paymentStatus);
  await payment.save();
  await syncOrderPaymentFields(order, payment);

  const populatedPayment = await Payment.findById(payment._id)
    .populate("order", "totalPrice orderStatus paymentStatus paymentMethod")
    .populate("user", "name email");

  res.status(isNewPayment ? 201 : 200).json({
    success: true,
    message: "Payment recorded successfully",
    payment: populatedPayment,
  });
});

const getMyPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ user: req.user._id })
    .populate("order", "totalPrice orderStatus paymentStatus paymentMethod")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: payments.length,
    payments,
  });
});

const getPaymentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error("Invalid payment ID");
  }

  const payment = await Payment.findById(id)
    .populate("order", "totalPrice orderStatus paymentStatus paymentMethod user")
    .populate("user", "name email");

  if (!payment) {
    res.status(404);
    throw new Error("Payment not found");
  }

  if (
    req.user.role !== "admin" &&
    payment.user._id.toString() !== req.user._id.toString()
  ) {
    res.status(403);
    throw new Error("You can only view your own payments");
  }

  res.status(200).json({
    success: true,
    payment,
  });
});

const getAllPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find()
    .populate("order", "totalPrice orderStatus paymentStatus paymentMethod")
    .populate("user", "name email")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: payments.length,
    payments,
  });
});

const updatePayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { paymentMethod, paymentStatus, transactionId, notes } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error("Invalid payment ID");
  }

  const payment = await Payment.findById(id);

  if (!payment) {
    res.status(404);
    throw new Error("Payment not found");
  }

  const isOwner = payment.user.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";

  if (!isOwner && !isAdmin) {
    res.status(403);
    throw new Error("You can only update your own payment");
  }

  if (typeof paymentMethod !== "undefined") {
    if (!paymentMethodList.includes(paymentMethod)) {
      res.status(400);
      throw new Error(
        "Valid paymentMethod is required. Use Cash on Delivery, Card, Online Transfer, or Wallet"
      );
    }

    payment.paymentMethod = paymentMethod;
  }

  if (typeof transactionId !== "undefined") {
    payment.transactionId = transactionId;
  }

  if (typeof notes !== "undefined") {
    payment.notes = notes;
  }

  if (typeof paymentStatus !== "undefined") {
    if (!paymentStatusList.includes(paymentStatus)) {
      res.status(400);
      throw new Error(
        "Invalid payment status. Use Pending, Paid, Failed, or Refunded"
      );
    }

    if (!isAdmin && paymentStatus === "Refunded") {
      res.status(403);
      throw new Error("Only admin can mark a payment as refunded");
    }

    if (payment.paymentStatus !== paymentStatus) {
      if (!isValidPaymentTransition(payment.paymentStatus, paymentStatus)) {
        res.status(400);
        throw new Error(
          "Invalid payment status transition. Allowed: Pending -> Paid/Failed, Failed -> Pending/Paid, Paid -> Refunded"
        );
      }

      payment.paymentStatus = paymentStatus;
      payment.statusHistory.push({
        status: paymentStatus,
      });
    }
  }

  const order = await Order.findById(payment.order);

  if (order) {
    payment.amount = order.totalPrice;
  }

  applyPaymentStatusDates(payment, payment.paymentStatus);
  await payment.save();

  if (order) {
    await syncOrderPaymentFields(order, payment);
  }

  const populatedPayment = await Payment.findById(payment._id)
    .populate("order", "totalPrice orderStatus paymentStatus paymentMethod")
    .populate("user", "name email");

  res.status(200).json({
    success: true,
    message: "Payment updated successfully",
    payment: populatedPayment,
  });
});

const updatePaymentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { paymentStatus } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error("Invalid payment ID");
  }

  if (!paymentStatus || !paymentStatusList.includes(paymentStatus)) {
    res.status(400);
    throw new Error(
      "Invalid payment status. Use Pending, Paid, Failed, or Refunded"
    );
  }

  const payment = await Payment.findById(id);

  if (!payment) {
    res.status(404);
    throw new Error("Payment not found");
  }

  if (!isValidPaymentTransition(payment.paymentStatus, paymentStatus)) {
    res.status(400);
    throw new Error(
      "Invalid payment status transition. Allowed: Pending -> Paid/Failed, Failed -> Pending/Paid, Paid -> Refunded"
    );
  }

  payment.paymentStatus = paymentStatus;
  payment.statusHistory.push({
    status: paymentStatus,
  });

  applyPaymentStatusDates(payment, paymentStatus);
  await payment.save();

  const order = await Order.findById(payment.order);

  if (order) {
    await syncOrderPaymentFields(order, payment);
  }

  const populatedPayment = await Payment.findById(payment._id)
    .populate("order", "totalPrice orderStatus paymentStatus paymentMethod")
    .populate("user", "name email");

  res.status(200).json({
    success: true,
    message: "Payment status updated successfully",
    payment: populatedPayment,
  });
});

const deletePayment = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error("Invalid payment ID");
  }

  const payment = await Payment.findById(id);

  if (!payment) {
    res.status(404);
    throw new Error("Payment not found");
  }

  const isAdmin = req.user.role === "admin";

  if (!isAdmin) {
    res.status(403);
    throw new Error("Only admin can delete payments");
  }

  const order = await Order.findById(payment.order);

  await payment.deleteOne();

  if (order) {
    await clearOrderPaymentFields(order);
  }

  res.status(200).json({
    success: true,
    message: "Payment deleted successfully",
  });
});

module.exports = {
  recordPayment,
  getMyPayments,
  getPaymentById,
  getAllPayments,
  updatePayment,
  updatePaymentStatus,
  deletePayment,
};