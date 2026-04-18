const express = require("express");

const {
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
} = require("../controllers/orderController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/cart").get(protect, getMyCart).post(protect, addToCart);
router.route("/cart").delete(protect, clearCart);
router.route("/cart/:menuItemId").put(protect, updateCartItemQuantity);
router.route("/cart/:menuItemId").delete(protect, removeCartItem);

router.route("/my-orders").get(protect, getMyOrders);

router
  .route("/")
  .post(protect, placeOrder)
  .get(protect, authorizeRoles("admin"), getAllOrders);

router
  .route("/:id")
  .get(protect, getOrderById)
  .put(protect, updateOrder)
  .delete(protect, deleteOrder);

router
  .route("/:id/status")
  .patch(protect, authorizeRoles("admin"), updateOrderStatus);

module.exports = router;