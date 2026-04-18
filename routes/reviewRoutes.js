const express = require("express");

const {
  addReview,
  getMenuItemReviews,
  getMyReviews,
  getReviewById,
  updateReview,
  deleteReview,
} = require("../controllers/reviewController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/").post(protect, addReview);
router.route("/my-reviews").get(protect, getMyReviews);
router.route("/menu/:menuItemId").get(getMenuItemReviews);

router
  .route("/:id")
  .get(protect, getReviewById)
  .put(protect, updateReview)
  .delete(protect, deleteReview);

module.exports = router;