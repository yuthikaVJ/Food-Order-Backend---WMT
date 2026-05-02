const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    categoryNumber: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },

    name: {
      type: String,
      required: [true, "Category name is required"],
      unique: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    categoryImage: {
      type: String,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Category", categorySchema);