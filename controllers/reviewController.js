const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");

const MenuItem = require("../models/MenuItem");
const Review = require("../models/Review");

const addReview = asyncHandler(async (req, res) => {
  const { menuItemId, rating, comment } = req.body;
  const numericRating = Number(rating);

  if (!menuItemId || !mongoose.Types.ObjectId.isValid(menuItemId)) {
    res.status(400);
    throw new Error("A valid menuItemId is required");
  }

  if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    res.status(400);
    throw new Error("Rating must be a whole number between 1 and 5");
  }

  const menuItem = await MenuItem.findById(menuItemId);

  if (!menuItem) {
    res.status(404);
    throw new Error("Menu item not found");
  }

  const existingReview = await Review.findOne({
    user: req.user._id,
    menuItem: menuItemId,
  });

  if (existingReview) {
    res.status(400);
    throw new Error("You have already reviewed this menu item");
  }

  const review = await Review.create({
    user: req.user._id,
    menuItem: menuItemId,
    rating: numericRating,
    comment: comment || "",
  });

  await Review.calculateAverageRating(menuItemId);

  const populatedReview = await Review.findById(review._id)
    .populate("user", "name profileImage")
    .populate("menuItem", "name image averageRating numberOfReviews");

  res.status(201).json({
    success: true,
    message: "Review added successfully",
    review: populatedReview,
  });
});

const getMenuItemReviews = asyncHandler(async (req, res) => {
  const { menuItemId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(menuItemId)) {
    res.status(400);
    throw new Error("Invalid menu item ID");
  }

  const menuItem = await MenuItem.findById(menuItemId);

  if (!menuItem) {
    res.status(404);
    throw new Error("Menu item not found");
  }

  const reviews = await Review.find({ menuItem: menuItemId })
    .populate("user", "name profileImage")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: reviews.length,
    reviews,
  });
});

const getMyReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ user: req.user._id })
    .populate("menuItem", "name image averageRating numberOfReviews")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: reviews.length,
    reviews,
  });
});

const getReviewById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error("Invalid review ID");
  }

  const review = await Review.findById(id)
    .populate("user", "name profileImage")
    .populate("menuItem", "name image averageRating numberOfReviews");

  if (!review) {
    res.status(404);
    throw new Error("Review not found");
  }

  const isOwner = review.user._id.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";

  if (!isOwner && !isAdmin) {
    res.status(403);
    throw new Error("You can only view your own review");
  }

  res.status(200).json({
    success: true,
    review,
  });
});

const updateReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating, comment } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error("Invalid review ID");
  }

  const review = await Review.findById(id);

  if (!review) {
    res.status(404);
    throw new Error("Review not found");
  }

  if (review.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("You can only update your own reviews");
  }

  if (typeof rating !== "undefined") {
    const numericRating = Number(rating);

    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      res.status(400);
      throw new Error("Rating must be a whole number between 1 and 5");
    }

    review.rating = numericRating;
  }

  if (typeof comment !== "undefined") {
    review.comment = comment;
  }

  await review.save();
  await Review.calculateAverageRating(review.menuItem);

  const populatedReview = await Review.findById(review._id)
    .populate("user", "name profileImage")
    .populate("menuItem", "name image averageRating numberOfReviews");

  res.status(200).json({
    success: true,
    message: "Review updated successfully",
    review: populatedReview,
  });
});

const deleteReview = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error("Invalid review ID");
  }

  const review = await Review.findById(id);

  if (!review) {
    res.status(404);
    throw new Error("Review not found");
  }

  const isOwner = review.user.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";

  if (!isOwner && !isAdmin) {
    res.status(403);
    throw new Error("You can only delete your own review");
  }

  const menuItemId = review.menuItem;

  await review.deleteOne();
  await Review.calculateAverageRating(menuItemId);

  res.status(200).json({
    success: true,
    message: "Review deleted successfully",
  });
});

module.exports = {
  addReview,
  getMenuItemReviews,
  getMyReviews,
  getReviewById,
  updateReview,
  deleteReview,
};