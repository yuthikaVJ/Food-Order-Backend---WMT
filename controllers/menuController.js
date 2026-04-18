const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");

const Category = require("../models/Category");
const MenuItem = require("../models/MenuItem");
const Review = require("../models/Review");
const {
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
} = require("../utils/cloudinaryUpload");

const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const parseBoolean = (value, defaultValue = false) => {
  if (typeof value === "undefined") {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return String(value).toLowerCase() === "true";
};

const parseIngredients = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const createMenuItem = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    price,
    category,
    isAvailable,
    preparationTime,
    ingredients,
    quantity,
  } = req.body;

  if (!name || !name.trim() || typeof price === "undefined" || !category) {
    res.status(400);
    throw new Error("Name, price, and category are required");
  }

  if (!mongoose.Types.ObjectId.isValid(category)) {
    res.status(400);
    throw new Error("Invalid category ID");
  }

  const existingCategory = await Category.findById(category);

  if (!existingCategory) {
    res.status(404);
    throw new Error("Category not found");
  }

  const numericPrice = Number(price);
  const numericPreparationTime =
    typeof preparationTime !== "undefined" ? Number(preparationTime) : 20;
  const numericQuantity =
    typeof quantity !== "undefined" && quantity !== ""
      ? Number(quantity)
      : 0;

  if (Number.isNaN(numericPrice) || numericPrice < 0) {
    res.status(400);
    throw new Error("Price must be a valid positive number");
  }

  if (Number.isNaN(numericPreparationTime) || numericPreparationTime < 1) {
    res.status(400);
    throw new Error("Preparation time must be at least 1 minute");
  }

  if (Number.isNaN(numericQuantity) || numericQuantity < 0) {
    res.status(400);
    throw new Error("Quantity must be a valid non-negative number");
  }

  const image = req.file
    ? await uploadImageToCloudinary(req.file, "food-order-management/menu")
    : { url: "", publicId: "" };

  const resolvedAvailability =
    typeof isAvailable !== "undefined"
      ? parseBoolean(isAvailable, numericQuantity > 0)
      : numericQuantity > 0;

  const menuItem = await MenuItem.create({
    name: name.trim(),
    description,
    price: numericPrice,
    category,
    ingredients: parseIngredients(ingredients),
    quantity: numericQuantity,
    isAvailable: numericQuantity === 0 ? false : resolvedAvailability,
    preparationTime: numericPreparationTime,
    image,
    createdBy: req.user ? req.user._id : null,
  });

  await menuItem.populate("category", "name description isActive");

  res.status(201).json({
    success: true,
    message: "Menu item created successfully",
    menuItem,
  });
});

const getMenuItems = asyncHandler(async (req, res) => {
  const { category, search, minPrice, maxPrice, isAvailable } = req.query;
  const filter = {};

  if (category) {
    if (!mongoose.Types.ObjectId.isValid(category)) {
      res.status(400);
      throw new Error("Invalid category ID in query");
    }

    filter.category = category;
  }

  if (typeof isAvailable !== "undefined") {
    filter.isAvailable = parseBoolean(isAvailable);
  }

  if (minPrice || maxPrice) {
    filter.price = {};

    if (minPrice) {
      const minPriceNumber = Number(minPrice);

      if (Number.isNaN(minPriceNumber)) {
        res.status(400);
        throw new Error("minPrice must be a valid number");
      }

      filter.price.$gte = minPriceNumber;
    }

    if (maxPrice) {
      const maxPriceNumber = Number(maxPrice);

      if (Number.isNaN(maxPriceNumber)) {
        res.status(400);
        throw new Error("maxPrice must be a valid number");
      }

      filter.price.$lte = maxPriceNumber;
    }
  }

  if (search) {
    const safeSearch = escapeRegex(search);

    filter.$or = [
      { name: { $regex: safeSearch, $options: "i" } },
      { description: { $regex: safeSearch, $options: "i" } },
      { ingredients: { $regex: safeSearch, $options: "i" } },
    ];
  }

  const menuItems = await MenuItem.find(filter)
    .populate("category", "name description isActive")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: menuItems.length,
    menuItems,
  });
});

const getMenuItemById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error("Invalid menu item ID");
  }

  const menuItem = await MenuItem.findById(id).populate(
    "category",
    "name description isActive"
  );

  if (!menuItem) {
    res.status(404);
    throw new Error("Menu item not found");
  }

  res.status(200).json({
    success: true,
    menuItem,
  });
});

const updateMenuItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    price,
    category,
    isAvailable,
    preparationTime,
    ingredients,
    quantity,
  } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error("Invalid menu item ID");
  }

  const menuItem = await MenuItem.findById(id);

  if (!menuItem) {
    res.status(404);
    throw new Error("Menu item not found");
  }

  if (category) {
    if (!mongoose.Types.ObjectId.isValid(category)) {
      res.status(400);
      throw new Error("Invalid category ID");
    }

    const existingCategory = await Category.findById(category);

    if (!existingCategory) {
      res.status(404);
      throw new Error("Category not found");
    }

    menuItem.category = category;
  }

  if (typeof name !== "undefined" && name.trim()) {
    menuItem.name = name.trim();
  }

  if (typeof description !== "undefined") {
    menuItem.description = description;
  }

  if (typeof price !== "undefined") {
    const numericPrice = Number(price);

    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      res.status(400);
      throw new Error("Price must be a valid positive number");
    }

    menuItem.price = numericPrice;
  }

  if (typeof quantity !== "undefined") {
    const numericQuantity = Number(quantity);

    if (Number.isNaN(numericQuantity) || numericQuantity < 0) {
      res.status(400);
      throw new Error("Quantity must be a valid non-negative number");
    }

    menuItem.quantity = numericQuantity;

    if (numericQuantity === 0) {
      menuItem.isAvailable = false;
    }
  }

  if (typeof isAvailable !== "undefined") {
    menuItem.isAvailable = parseBoolean(isAvailable, menuItem.quantity > 0);
  }

  if (typeof preparationTime !== "undefined") {
    const numericPreparationTime = Number(preparationTime);

    if (Number.isNaN(numericPreparationTime) || numericPreparationTime < 1) {
      res.status(400);
      throw new Error("Preparation time must be at least 1 minute");
    }

    menuItem.preparationTime = numericPreparationTime;
  }

  if (typeof ingredients !== "undefined") {
    menuItem.ingredients = parseIngredients(ingredients);
  }

  if (req.file) {
    const newImage = await uploadImageToCloudinary(
      req.file,
      "food-order-management/menu"
    );

    if (menuItem.image && menuItem.image.publicId) {
      await deleteImageFromCloudinary(menuItem.image.publicId);
    }

    menuItem.image = newImage;
  }

  await menuItem.save();
  await menuItem.populate("category", "name description isActive");

  res.status(200).json({
    success: true,
    message: "Menu item updated successfully",
    menuItem,
  });
});

const deleteMenuItem = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400);
    throw new Error("Invalid menu item ID");
  }

  const menuItem = await MenuItem.findById(id);

  if (!menuItem) {
    res.status(404);
    throw new Error("Menu item not found");
  }

  if (menuItem.image && menuItem.image.publicId) {
    await deleteImageFromCloudinary(menuItem.image.publicId);
  }

  await Review.deleteMany({ menuItem: id });
  await menuItem.deleteOne();

  res.status(200).json({
    success: true,
    message: "Menu item deleted successfully",
  });
});

module.exports = {
  createMenuItem,
  getMenuItems,
  getMenuItemById,
  updateMenuItem,
  deleteMenuItem,
};