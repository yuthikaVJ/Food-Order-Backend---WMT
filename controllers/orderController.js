const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");

const MenuItem = require("../models/MenuItem");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const User = require("../models/User");

const orderStatusFlow = [
  "Pending",
  "Confirmed",
  "Preparing",
  "Out for Delivery",
  "Delivered",
];

const roundToTwo = (value) => {
  return Number(value.toFixed(2));
};

const getDeliveryCharge = (itemsPrice) => {
  if (itemsPrice === 0) {
    return 0;
  }

  return itemsPrice >= 3000 ? 0 : 250;
};

const getPopulatedUserCart = async (userId) => {
  let user = await User.findById(userId).populate({
    path: "cartItems.menuItem",
    select: "name price image isAvailable category",
  });

  if (!user) {
    throw new Error("User not found");
  }

  const hasDeletedMenuItems = user.cartItems.some((item) => !item.menuItem);

  if (hasDeletedMenuItems) {
    user.cartItems = user.cartItems
      .filter((item) => item.menuItem)
      .map((item) => ({
        menuItem: item.menuItem._id,
        quantity: item.quantity,
      }));

    await user.save();

    user = await User.findById(userId).populate({
      path: "cartItems.menuItem",
      select: "name price image isAvailable category",
    });
  }

  return user;
};

const buildCartSummary = (user) => {
  const items = user.cartItems.map((item) => ({
    menuItemId: item.menuItem._id,
    name: item.menuItem.name,
    price: item.menuItem.price,
    image: item.menuItem.image ? item.menuItem.image.url : "",
    isAvailable: item.menuItem.isAvailable,
    quantity: item.quantity,
    subtotal: roundToTwo(item.menuItem.price * item.quantity),
  }));

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const itemsPrice = roundToTwo(
    items.reduce((sum, item) => sum + item.subtotal, 0)
  );
  const deliveryCharge = roundToTwo(getDeliveryCharge(itemsPrice));
  const totalPrice = roundToTwo(itemsPrice + deliveryCharge);

  return {
    items,
    totalItems,
    itemsPrice,
    deliveryCharge,
    totalPrice,
  };
};

const recalculateOrderTotals = (orderItems) => {
  const normalizedItems = orderItems.map((item) => {
    const price = Number(item.price);
    const quantity = Number(item.quantity);
    const subtotal = roundToTwo(price * quantity);

    return {
      ...item,
      price,
      quantity,
      subtotal,
    };
  });

  const itemsPrice = roundToTwo(
    normalizedItems.reduce((sum, item) => sum + item.subtotal, 0)
  );

  const deliveryCharge = roundToTwo(getDeliveryCharge(itemsPrice));
  const totalPrice = roundToTwo(itemsPrice + deliveryCharge);

  return {
    normalizedItems,
    itemsPrice,
    deliveryCharge,
    totalPrice,
  };
};

const getMyCart = asyncHandler(async (req, res) => {
  const user = await getPopulatedUserCart(req.user._id);
  const cart = buildCartSummary(user);

  res.status(200).json({
    success: true,
    cart,
  });
});

const addToCart = asyncHandler(async (req, res) => {
  const { menuItemId, quantity } = req.body;
  const requestedQuantity =
    typeof quantity === "undefined" ? 1 : Number(quantity);

  if (!menuItemId || !mongoose.Types.ObjectId.isValid(menuItemId)) {
    res.status(400);
    throw new Error("A valid menuItemId is required");
  }

  if (Number.isNaN(requestedQuantity) || requestedQuantity < 1) {
    res.status(400);
    throw new Error("Quantity must be at least 1");
  }

  const menuItem = await MenuItem.findById(menuItemId);

  if (!menuItem) {
    res.status(404);
    throw new Error("Menu item not found");
  }

  if (!menuItem.isAvailable) {
    res.status(400);
    throw new Error("This menu item is currently unavailable");
  }

  const user = await User.findById(req.user._id);
  const existingItemIndex = user.cartItems.findIndex(
    (item) => item.menuItem.toString() === menuItemId
  );

  if (existingItemIndex >= 0) {
    user.cartItems[existingItemIndex].quantity += requestedQuantity;
  } else {
    user.cartItems.push({
      menuItem: menuItemId,
      quantity: requestedQuantity,
    });
  }

  await user.save();

  const populatedUser = await getPopulatedUserCart(req.user._id);
  const cart = buildCartSummary(populatedUser);

  res.status(200).json({
    success: true,
    message: "Item added to cart successfully",
    cart,
  });
});

const updateCartItemQuantity = asyncHandler(async (req, res) => {
  const { menuItemId } = req.params;
  const { quantity } = req.body;
  const updatedQuantity = Number(quantity);

  if (!mongoose.Types.ObjectId.isValid(menuItemId)) {
    res.status(400);
    throw new Error("Invalid menu item ID");
  }

  if (Number.isNaN(updatedQuantity) || updatedQuantity < 1) {
    res.status(400);
    throw new Error("Quantity must be at least 1");
  }

  const menuItem = await MenuItem.findById(menuItemId);

  if (!menuItem) {
    res.status(404);
    throw new Error("Menu item not found");
  }

  if (!menuItem.isAvailable) {
    res.status(400);
    throw new Error("This menu item is currently unavailable");
  }

  const user = await User.findById(req.user._id);
  const cartItem = user.cartItems.find(
    (item) => item.menuItem.toString() === menuItemId
  );

  if (!cartItem) {
    res.status(404);
    throw new Error("Item not found in cart");
  }

  cartItem.quantity = updatedQuantity;
  await user.save();

  const populatedUser = await getPopulatedUserCart(req.user._id);
  const cart = buildCartSummary(populatedUser);

  res.status(200).json({
    success: true,
    message: "Cart item updated successfully",
    cart,
  });
});

const removeCartItem = asyncHandler(async (req, res) => {
  const { menuItemId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(menuItemId)) {
    res.status(400);
    throw new Error("Invalid menu item ID");
  }

  const user = await User.findById(req.user._id);
  const initialLength = user.cartItems.length;

  user.cartItems = user.cartItems.filter(
    (item) => item.menuItem.toString() !== menuItemId
  );

  if (user.cartItems.length === initialLength) {
    res.status(404);
    throw new Error("Item not found in cart");
  }

  await user.save();

  const populatedUser = await getPopulatedUserCart(req.user._id);
  const cart = buildCartSummary(populatedUser);

  res.status(200).json({
    success: true,
    message: "Cart item removed successfully",
    cart,
  });
});

const clearCart = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.cartItems = [];
  await user.save();

  res.status(200).json({
    success: true,
    message: "Cart cleared successfully",
    cart: {
      items: [],
      totalItems: 0,
      itemsPrice: 0,
      deliveryCharge: 0,
      totalPrice: 0,
    },
  });
});

const placeOrder = asyncHandler(async (req, res) => {
  const user = await getPopulatedUserCart(req.user._id);

  if (!user.cartItems.length) {
    res.status(400);
    throw new Error("Your cart is empty");
  }

  const unavailableItem = user.cartItems.find(
    (item) => !item.menuItem.isAvailable
  );

  if (unavailableItem) {
    res.status(400);
    throw new Error(
      `The item "${unavailableItem.menuItem.name}" is currently unavailable`
    );
  }

  const deliveryAddress = (req.body.deliveryAddress || user.address || "").trim();

  if (!deliveryAddress) {
    res.status(400);
    throw new Error(
      "Delivery address is required. Add it in the profile or send it in the request body"
    );
  }

  const cart = buildCartSummary(user);

  const orderItems = user.cartItems.map((item) => ({
    menuItem: item.menuItem._id,
    name: item.menuItem.name,
    image: item.menuItem.image ? item.menuItem.image.url : "",
    price: item.menuItem.price,
    quantity: item.quantity,
    subtotal: roundToTwo(item.menuItem.price * item.quantity),
  }));

  const order = await Order.create({
    user: req.user._id,
    orderItems,
    deliveryAddress,
    notes: req.body.notes || "",
    orderStatus: "Pending",
    statusHistory: [
      {
        status: "Pending",
      },
    ],
    itemsPrice: cart.itemsPrice,
    deliveryCharge: cart.deliveryCharge,
    totalPrice: cart.totalPrice,
  });

  user.cartItems = [];
  await user.save();

  res.status(201).json({
    success: true,
    message: "Order placed successfully",
    order,
  });
});

const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .populate("payment")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: orders.length,
    orders,
  });
});

const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error("Invalid order ID");
  }

  const order = await Order.findById(id)
    .populate("user", "name email role")
    .populate("payment");

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  if (
    req.user.role !== "admin" &&
    order.user._id.toString() !== req.user._id.toString()
  ) {
    res.status(403);
    throw new Error("You can only view your own orders");
  }

  res.status(200).json({
    success: true,
    order,
  });
});

const getAllOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find()
    .populate("user", "name email role")
    .populate("payment")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: orders.length,
    orders,
  });
});

const updateOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { deliveryAddress, notes, orderItems } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error("Invalid order ID");
  }

  const order = await Order.findById(id);

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  const isOwner = order.user.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";

  if (!isOwner && !isAdmin) {
    res.status(403);
    throw new Error("You can only update your own order");
  }

  if (!isAdmin && order.orderStatus !== "Pending") {
    res.status(400);
    throw new Error("You can only update an order while it is Pending");
  }

  if (typeof deliveryAddress !== "undefined") {
    const trimmedAddress = deliveryAddress.trim();

    if (!trimmedAddress) {
      res.status(400);
      throw new Error("Delivery address cannot be empty");
    }

    order.deliveryAddress = trimmedAddress;
  }

  if (typeof notes !== "undefined") {
    order.notes = notes;
  }

  if (typeof orderItems !== "undefined") {
    if (!Array.isArray(orderItems) || orderItems.length === 0) {
      res.status(400);
      throw new Error("orderItems must be a non-empty array");
    }

    const updatedItems = [];

    for (const item of orderItems) {
      if (!item.menuItem || !mongoose.Types.ObjectId.isValid(item.menuItem)) {
        res.status(400);
        throw new Error("Each order item must contain a valid menuItem");
      }

      const menu = await MenuItem.findById(item.menuItem);

      if (!menu) {
        res.status(404);
        throw new Error("One of the menu items was not found");
      }

      if (!menu.isAvailable) {
        res.status(400);
        throw new Error(`Menu item "${menu.name}" is unavailable`);
      }

      const quantity = Number(item.quantity);

      if (Number.isNaN(quantity) || quantity < 1) {
        res.status(400);
        throw new Error("Each item quantity must be at least 1");
      }

      updatedItems.push({
        menuItem: menu._id,
        name: menu.name,
        image: menu.image ? menu.image.url : "",
        price: menu.price,
        quantity,
      });
    }

    const totals = recalculateOrderTotals(updatedItems);

    order.orderItems = totals.normalizedItems;
    order.itemsPrice = totals.itemsPrice;
    order.deliveryCharge = totals.deliveryCharge;
    order.totalPrice = totals.totalPrice;
  }

  await order.save();

  const populatedOrder = await Order.findById(order._id)
    .populate("user", "name email role")
    .populate("payment");

  res.status(200).json({
    success: true,
    message: "Order updated successfully",
    order: populatedOrder,
  });
});

const deleteOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error("Invalid order ID");
  }

  const order = await Order.findById(id);

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  const isOwner = order.user.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";

  if (!isOwner && !isAdmin) {
    res.status(403);
    throw new Error("You can only delete your own order");
  }

  if (!isAdmin && order.orderStatus !== "Pending") {
    res.status(400);
    throw new Error("You can only delete an order while it is Pending");
  }

  const existingPayment = await Payment.findOne({ order: order._id });

  if (existingPayment) {
    res.status(400);
    throw new Error("Cannot delete order because a payment record is linked");
  }

  await order.deleteOne();

  res.status(200).json({
    success: true,
    message: "Order deleted successfully",
  });
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { orderStatus } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error("Invalid order ID");
  }

  if (!orderStatusFlow.includes(orderStatus)) {
    res.status(400);
    throw new Error(
      "Invalid order status. Use Pending, Confirmed, Preparing, Out for Delivery, or Delivered"
    );
  }

  const order = await Order.findById(id);

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  const currentStatusIndex = orderStatusFlow.indexOf(order.orderStatus);
  const nextStatusIndex = orderStatusFlow.indexOf(orderStatus);

  if (currentStatusIndex === nextStatusIndex) {
    res.status(400);
    throw new Error("Order is already in this status");
  }

  if (nextStatusIndex !== currentStatusIndex + 1) {
    res.status(400);
    throw new Error(
      "Order status must follow the correct sequence: Pending -> Confirmed -> Preparing -> Out for Delivery -> Delivered"
    );
  }

  order.orderStatus = orderStatus;
  order.statusHistory.push({
    status: orderStatus,
  });

  await order.save();

  res.status(200).json({
    success: true,
    message: "Order status updated successfully",
    order,
  });
});

module.exports = {
  getMyCart,
  addToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
  placeOrder,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
};