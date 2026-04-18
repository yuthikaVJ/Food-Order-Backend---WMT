const mongoose = require("mongoose");

const MenuItem = require("./MenuItem");

const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MenuItem",
      required: true,
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot be more than 5"],
      validate: {
        validator: Number.isInteger,
        message: "Rating must be a whole number between 1 and 5",
      },
    },
    comment: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "Comment cannot be more than 500 characters"],
    },
  },
  {
    timestamps: true,
  }
);

reviewSchema.index({ user: 1, menuItem: 1 }, { unique: true });

reviewSchema.statics.calculateAverageRating = async function (menuItemId) {
  const stats = await this.aggregate([
    {
      $match: {
        menuItem: new mongoose.Types.ObjectId(menuItemId),
      },
    },
    {
      $group: {
        _id: "$menuItem",
        averageRating: { $avg: "$rating" },
        numberOfReviews: { $sum: 1 },
      },
    },
  ]);

  if (stats.length > 0) {
    await MenuItem.findByIdAndUpdate(menuItemId, {
      averageRating: Number(stats[0].averageRating.toFixed(1)),
      numberOfReviews: stats[0].numberOfReviews,
    });
    return;
  }

  await MenuItem.findByIdAndUpdate(menuItemId, {
    averageRating: 0,
    numberOfReviews: 0,
  });
};

module.exports = mongoose.model("Review", reviewSchema);
