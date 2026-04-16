const dotenv = require("dotenv");

dotenv.config();

const connectDB = require("../config/db");
const User = require("../models/User");

const adminSeedData = {
  name: "dk",
  email: "dk@gmail.com",
  password: "123456",
  phone: "0771234567",
  address: "Colombo",
};

const createAdmin = async () => {
  try {
    await connectDB();

    const adminEmail = adminSeedData.email.toLowerCase();

    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      existingAdmin.name = adminSeedData.name;
      existingAdmin.password = adminSeedData.password;
      existingAdmin.phone = adminSeedData.phone;
      existingAdmin.address = adminSeedData.address;
      existingAdmin.role = "admin";
      await existingAdmin.save();

      console.log("Existing user updated as admin successfully");
      process.exit(0);
    }

    await User.create({
      name: adminSeedData.name,
      email: adminEmail,
      password: adminSeedData.password,
      phone: adminSeedData.phone,
      address: adminSeedData.address,
      role: "admin",
    });

    console.log("Admin user created successfully");
    process.exit(0);
  } catch (error) {
    console.error(`Admin seeding failed: ${error.message}`);
    process.exit(1);
  }
};

createAdmin();
