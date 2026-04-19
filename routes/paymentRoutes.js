const express = require("express");

const {
  recordPayment,
  getMyPayments,
  getPaymentById,
  getAllPayments,
  updatePayment,
  updatePaymentStatus,
  deletePayment,
} = require("../controllers/paymentController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router
  .route("/")
  .post(protect, recordPayment)
  .get(protect, authorizeRoles("admin"), getAllPayments);

router.route("/my-payments").get(protect, getMyPayments);

router
  .route("/:id")
  .get(protect, getPaymentById)
  .put(protect, updatePayment)
  .delete(protect, authorizeRoles("admin"), deletePayment);

router
  .route("/:id/status")
  .patch(protect, authorizeRoles("admin"), updatePaymentStatus);

module.exports = router;