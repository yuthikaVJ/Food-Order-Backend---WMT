const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");

const Category = require("../models/Category");
const MenuItem = require("../models/MenuItem");

const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const createCategory = asyncHandler(async (req, res) => {
  const { name, description, isActive } = req.body;

  if (!name || !name.trim()) {
    res.status(400);
    throw new Error("Category name is required");
  }

  const trimmedName = name.trim();
  const existingCategory = await Category.findOne({
    name: {
      $regex: `^${escapeRegex(trimmedName)}$`,
      $options: "i",
    },
  });

  if (existingCategory) {
    res.status(400);
    throw new Error("Category already exists");
  }

  const category = await Category.create({
    name: trimmedName,
    description,
    isActive:
      typeof isActive === "undefined" ? true : String(isActive) === "true",
  });

  res.status(201).json({
    success: true,
    message: "Category created successfully",
    category,
  });
});

const getCategories = asyncHandler(async (req, res) => {
  const filter = {};

  if (typeof req.query.isActive !== "undefined") {
    filter.isActive = String(req.query.isActive) === "true";
  }

  const categories = await Category.find(filter).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: categories.length,
    categories,
  });
});

const getCategoryById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error("Invalid category ID");
  }

  const category = await Category.findById(id);

  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  res.status(200).json({
    success: true,
    category,
  });
});

const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, isActive } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error("Invalid category ID");
  }

  const category = await Category.findById(id);

  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  if (name && name.trim()) {
    const trimmedName = name.trim();
    const existingCategory = await Category.findOne({
      _id: { $ne: id },
      name: {
        $regex: `^${escapeRegex(trimmedName)}$`,
        $options: "i",
      },
    });

    if (existingCategory) {
      res.status(400);
      throw new Error("Another category already uses this name");
    }

    category.name = trimmedName;
  }

  if (typeof description !== "undefined") {
    category.description = description;
  }

  if (typeof isActive !== "undefined") {
    category.isActive = String(isActive) === "true";
  }

  await category.save();

  res.status(200).json({
    success: true,
    message: "Category updated successfully",
    category,
  });
});

const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error("Invalid category ID");
  }

  const category = await Category.findById(id);

  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  const linkedMenuItem = await MenuItem.findOne({ category: id });

  if (linkedMenuItem) {
    res.status(400);
    throw new Error(
      "Cannot delete this category because menu items are linked to it"
    );
  }

  await category.deleteOne();

  res.status(200).json({
    success: true,
    message: "Category deleted successfully",
  });
});

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
