require('dotenv').config(); // Load environment variables
const express = require('express');
const admin = require('firebase-admin');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const passport = require('passport');
const jwt = require('jsonwebtoken'); // 🔐 Add this
const bcrypt = require('bcrypt'); // For password hashing
const sequelize = require('./config/dbconfig'); // Database connection
const { User, Order, Location, Vehicle, UserLog,Vendor,Product } = require('./models/models');
const { hashPassword } = require('./middleware/auth'); // ✅ Update path if needed
const argon2 = require('argon2');
const pushNotification = require('./controllers/pushnotification');


const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key'; // 🔐 Use env or fallback

// ✅ Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(passport.initialize());

// ✅ Registration with Token Response
app.post(`/api/user/register`, async (req, res) => {
  const { email, username, password, fcmToken } = req.body;

  if (!email || !username || !password) {
    console.log("❌ Missing required fields (email, username, password)");
    return res.status(400).json({ code: 1000, message: "Email, username, and password are required" });
  }

  try {
    console.log("🔍 Checking if the email already exists...");
    const existingUser = await User.findOne({ where: { email } });

    if (existingUser) {
      console.log("❌ Email already exists:", email);
      return res.status(400).json({ code: 1001, message: "Email already exists" });
    }

    console.log("✅ Email not found. Proceeding with password hashing...");
    const hashedPwd = await hashPassword(password);

    let newUser;
    await sequelize.transaction(async (t) => {
      console.log("💼 Starting database transaction...");
      newUser = await User.create({
        email,
        name: username,
        password: hashedPwd,
        type: 'driver',
        state: 'NA',
        district: 'NA',
        age: 0,
        latitude: 0,
        longitude: 0
      }, { transaction: t });

      console.log("✅ New user created with ID:", newUser.id);

      await UserLog.create({
        user_id: newUser.id,
        fcmToken: fcmToken || null
      }, { transaction: t });

      console.log("📱 User log created for FCM token.");
    });

    // 🔐 Generate JWT Token
    const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });

    console.log("🎉 Registration successful! Sending token.");
    res.setHeader('x-auth-token', token); // ✅ Send token in header
    return res.status(201).json({ message: "Registration successful" });

  } catch (err) {
    console.error("❌ Registration error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ✅ Login Endpoint
app.post(`/api/user/login`, async (req, res) => {
  const { email, password, fcmToken } = req.body;

  if (!email || !password) {
    console.log("❌ Missing required fields (email, password)");
    return res.status(400).json({ code: 1000, message: "Email and password are required" });
  }

  try {
    console.log("🔍 Checking if user exists for email:", email);
    const user = await User.findOne({ where: { email } });

    if (!user) {
      console.log("❌ No user found with email:", email);
      return res.status(400).json({ code: 1001, message: "Invalid email or password" });
    }

    console.log("🔐 Comparing password...");
    const isMatch = await argon2.verify(user.password, password); // <-- Use argon2 to compare password

    if (!isMatch) {
      console.log("❌ Incorrect password for user:", email);
      return res.status(401).json({ code: 1002, message: "Invalid email or password" });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    if (fcmToken) {
      await UserLog.upsert({ user_id: user.id, fcmToken });
      console.log("📱 FCM token updated in UserLog");
    }

    console.log("✅ Login successful. Sending token...");
    res.setHeader('x-auth-token', token);
    return res.status(200).json({ message: "Login successful" });

  } catch (err) {
    console.error("❌ Login error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ✅ (Unchanged) Get User Data
app.get('/api/user/data', passport.authenticate('jwt', { session: false }), async (req, res) => {
  const userId = req.user.id;
  console.log("🔐 Fetching basic user data for ID:", userId);

  try {
    // Fetch user data
    const user = await User.findOne({ where: { id: userId } });

    if (!user) {
      console.log("❌ User not found:", userId);
      return res.status(404).json({ message: 'User not found' });
    }

    // Fetch the user's vehicle details (if any)
    const vehicle = await Vehicle.findOne({ where: { userId: userId } });

    // Prepare safe user data
    const safeUser = {
      id: user.id || 'No ID',
      name: user.name || 'No name',
      email: user.email || 'No email',
      phone: user.phone || 'No phone',
      state: user.state || 'No state',
      district: user.district || 'No district',
      type: user.type || 'driver',
      status: user.status || 'active',
      isOnline: user.isOnline,
      createdAt: user.createdAt || new Date(),
      aadhaarNumber: user.aadhaarNumber || 'No Aadhaar Number',
      updatedAt: user.updatedAt || new Date(),
    };

    // If a vehicle exists, include it in the response
    if (vehicle) {
      const safeVehicle = {
        id: vehicle.id,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleType: vehicle.vehicleType,
        model: vehicle.model,
        brand: vehicle.brand,
        year: vehicle.year,
        status: vehicle.status,
        createdAt: vehicle.createdAt || new Date(),
        updatedAt: vehicle.updatedAt || new Date(),
      };

      // Add vehicle details to the user response
      safeUser.vehicle = safeVehicle;
    }

    console.log("🎉 User data fetched successfully:", safeUser);
    return res.status(200).json({ user: safeUser });

  } catch (err) {
    console.error("❌ Error fetching user data:", err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/api/user/logout', passport.authenticate('jwt', { session: false }), async (req, res) => {
  const userId = req.user.id;
  console.log("🔐 Logging out user with ID:", userId);

  try {
    // Delete all UserLog entries for the user
    const deleted = await UserLog.destroy({ where: { user_id: userId } });

    console.log(`🗑️ Deleted ${deleted} log(s) for user ${userId}`);
    return res.status(200).json({ message: 'User logged out and logs removed successfully.' });

  } catch (err) {
    console.error("❌ Error during logout:", err);
    return res.status(500).json({ message: 'Internal server error during logout' });
  }
});


app.put('/api/user/online-status', passport.authenticate('jwt', { session: false }), async (req, res) => {
  const userId = req.user.id;
  const { isOnline } = req.body;

  console.log(`📡 Received online status update for user ID: ${userId} → ${isOnline}`);

  try {
    // Validate input
    if (typeof isOnline !== 'boolean') {
      console.warn("⚠️ Invalid isOnline value received:", isOnline);
      return res.status(400).json({ message: "Missing or invalid 'isOnline' value." });
    }

    const user = await User.findOne({ where: { id: userId } });

    if (!user) {
      console.log("❌ User not found:", userId);
      return res.status(404).json({ message: 'User not found' });
    }

    // Update online status
    user.isOnline = isOnline;
    await user.save();

    console.log(`✅ User ${userId} is now ${user.isOnline ? 'online' : 'offline'}`);
    return res.status(200).json({
      message: `User is now ${user.isOnline ? 'online' : 'offline'}`,
      isOnline: user.isOnline,
    });

  } catch (err) {
    console.error("❌ Error updating online status:", err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

app.put('/api/user/update-aadhaar', passport.authenticate('jwt', { session: false }), async (req, res) => {
  const userId = req.user.id;
  const { aadhaarNumber } = req.body;

  console.log(`📡 Received Aadhaar number update for user ID: ${userId} → ${aadhaarNumber}`);

  try {
    // Validate input
    if (!aadhaarNumber || typeof aadhaarNumber !== 'string' || aadhaarNumber.length !== 12) {
      console.warn("⚠️ Invalid Aadhaar number received:", aadhaarNumber);
      return res.status(400).json({ message: "Missing or invalid Aadhaar number." });
    }

    const user = await User.findOne({ where: { id: userId } });

    if (!user) {
      console.log("❌ User not found:", userId);
      return res.status(404).json({ message: 'User not found' });
    }

    // Update Aadhaar number
    user.aadhaarNumber = aadhaarNumber;
    await user.save();

    console.log(`✅ User ${userId}'s Aadhaar number updated successfully`);
    return res.status(200).json({
      message: 'Aadhaar number updated successfully',
      aadhaarNumber: user.aadhaarNumber,
    });

  } catch (err) {
    console.error("❌ Error updating Aadhaar number:", err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});


app.post( '/api/vehicles/register',passport.authenticate('jwt', { session: false }), async (req, res) => {
    const userId = req.user.id;
    const vehicleData = req.body;

    console.log(`🚚 Registering vehicle for user ID: ${userId}`);

    try {
      // Validate required fields (you can adjust this as needed)
      const requiredFields = ['vehicleNumber', 'vehicleType'];
      const missingFields = requiredFields.filter(field => !vehicleData[field]);

      if (missingFields.length > 0) {
        console.warn('⚠️ Missing vehicle fields:', missingFields);
        return res.status(400).json({
          message: `Missing required fields: ${missingFields.join(', ')}`,
        });
      }

      // Create and save vehicle
      const newVehicle = await Vehicle.create({
        ...vehicleData,
        userId, // Associate with the current user
      });

      console.log(`✅ Vehicle registered for user ${userId}:`, newVehicle.id);

      return res.status(200).json({
        message: 'Vehicle registered successfully',
        vehicle: newVehicle,
      });
    } catch (err) {
      console.error('❌ Error registering vehicle:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
);

app.put('/api/user/change-password', async (req, res) => {
  const { password } = req.body;
  const token = req.headers['authorization']?.split(' ')[1];

  if (!password) {
    console.log("❌ Missing new password in request body");
    return res.status(400).json({ code: 1000, message: "Password is required" });
  }

  if (!token) {
    console.log("❌ Missing authentication token");
    return res.status(401).json({ code: 1002, message: "Authorization token missing" });
  }

  try {
    // 🔍 Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    console.log("🔐 Authenticated user ID:", userId);

    const user = await User.findByPk(userId);
    if (!user) {
      console.log("❌ User not found for token ID:", userId);
      return res.status(404).json({ code: 1003, message: "User not found" });
    }

    const hashedPassword = await argon2.hash(password);

    // 🔁 Update password in a transaction
    await sequelize.transaction(async (t) => {
      await user.update({ password: hashedPassword }, { transaction: t });
      console.log("✅ Password updated for user ID:", userId);
    });

    return res.status(200).json({ message: "Password updated successfully" });

  } catch (err) {
    console.error("❌ Change password error:", err);

    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ code: 1004, message: "Invalid or expired token" });
    }

    return res.status(500).json({ message: "Internal server error" });
  }
});

app.post(`/api/user/google-login`, async (req, res) => {
  const { idToken, fcmToken, age, state, district, type, latitude, longitude } = req.body;

  if (!idToken) {
    console.log("❌ Missing Google ID token");
    return res.status(400).json({ code: 1003, message: "Google ID token is required" });
  }

  try {
    console.log("🔐 Verifying Google ID token...");

    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, sub: googleId, picture } = payload;

    if (!email) {
      console.log("❌ Email not found in token");
      return res.status(400).json({ code: 1004, message: "Invalid Google ID token" });
    }

    console.log("🔍 Looking up user by email:", email);
    let user = await User.findOne({ where: { email } });

    let statusCode = 200;

    if (!user) {
      console.log("🆕 Creating new user for Google login...");
      user = await User.create({
        name,
        email,
        googleId,
        profilePic: picture,
        age: age || 0, // Set a default or handle this field accordingly
        state: state || 'Unknown', // Set default
        district: district || 'Unknown', // Set default
        type: type || 'driver', // Set default
        latitude: latitude || 0, // Set default
        longitude: longitude || 0, // Set default
      });
      statusCode = 201;
    } else {
      console.log("✅ Existing user found. Updating Google info...");
      await user.update({
        googleId,
        profilePic: picture,
        age: age || user.age, // If age is provided, update; otherwise keep the existing value
        state: state || user.state,
        district: district || user.district,
        type: type || user.type,
        latitude: latitude || user.latitude,
        longitude: longitude || user.longitude,
      });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    if (fcmToken) {
      await UserLog.upsert({ user_id: user.id, fcmToken });
      console.log("📱 FCM token updated in UserLog");
    }

    console.log("✅ Google login successful. Sending token...");
    res.setHeader('x-auth-token', token);
    return res.status(statusCode).json({ message: "Google login successful" });

  } catch (err) {
    console.error("❌ Google login error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.get('/api/admin/get-allusers', passport.authenticate('jwt', { session: false }), async (req, res) => {
  const userId = req.user.id; // Get the user ID from the JWT payload
  console.log("🔐 Fetching all drivers for the admin:", userId);

  try {
    // Fetch all users with 'driver' type
    const drivers = await User.findAll({ where: { type: 'driver' } });

    if (!drivers || drivers.length === 0) {
      console.log("❌ No drivers found.");
      return res.status(404).json({ message: 'No drivers found' });
    }

    const users = [];

    for (const driver of drivers) {
      const vehicle = await Vehicle.findOne({ where: { userId: driver.id } });

      const user = {
        id: driver.id || 'No ID',
        name: driver.name || 'No name',
        email: driver.email || 'No email',
        phone: driver.phone || 'No phone',
        state: driver.state || 'No state',
        district: driver.district || 'No district',
        type: driver.type || 'driver',
        status: driver.status || 'active',
        isOnline: driver.isOnline,
        createdAt: driver.createdAt || new Date(),
        aadhaarNumber: driver.aadhaarNumber || 'No Aadhaar Number',
        updatedAt: driver.updatedAt || new Date(),
      };

      const vehicles = [];

      if (vehicle) {
        vehicles.push({
          id: vehicle.id,
          vehicleNumber: vehicle.vehicleNumber,
          vehicleType: vehicle.vehicleType,
          model: vehicle.model,
          brand: vehicle.brand,
          year: vehicle.year,
          status: vehicle.status,
          createdAt: vehicle.createdAt || new Date(),
          updatedAt: vehicle.updatedAt || new Date(),
        });
      }

      users.push({ user, vehicles });
    }

    console.log("🎉 Drivers fetched successfully:", users);
    return res.status(200).json({ users });

  } catch (err) {
    console.error("❌ Error fetching drivers:", err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/admin/get-allvendors', passport.authenticate('jwt', { session: false }), async (req, res) => {
  const userId = req.user.id;
  console.log("🔐 Fetching all vendors for the admin:", userId);

  try {
    const vendors = await Vendor.findAll({
      include: [{
        model: Product,
        attributes: ['productId', 'name', 'description', 'unitPrice', 'status', 'createdAt', 'updatedAt', 'category'], // ✅ added 'category'
      }]
    });

    if (!vendors || vendors.length === 0) {
      console.log("❌ No vendors found.");
      return res.status(404).json({ message: 'No vendors found' });
    }

    const vendorList = vendors.map(vendor => {
      const vendorProducts = vendor.Products.map(product => ({
        id: product.productId,
        name: product.name,
        description: product.description || 'No description',
        price: product.unitPrice,
        status: product.status,
        category: product.category || 'Uncategorized',  // ✅ include per-product category
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      }));

      // ✅ Derive categories from the product list (unique values)
      const uniqueCategories = [...new Set(vendorProducts.map(p => p.category))];

      const vendorData = {
        id: vendor.vendorId,
        name: vendor.name,
        contactPerson: vendor.contactPerson || 'No contact person',
        email: vendor.email || 'No email',
        phone: vendor.phone,
        address: vendor.address || 'No address',
        city: vendor.city || 'No city',
        state: vendor.state || 'No state',
        pincode: vendor.pincode || 'No pincode',
        gstNumber: vendor.gstNumber || 'No GST number',
        companyName: vendor.companyName,
        category: uniqueCategories.join(', ') || 'No category', // ✅ combine categories into one string
        status: vendor.status,
        createdAt: vendor.createdAt || new Date(),
        updatedAt: vendor.updatedAt || new Date(),
      };

      return { vendor: vendorData, products: vendorProducts };
    });

    console.log("🎉 Vendors fetched successfully:", vendorList);
    return res.status(200).json({ vendors: vendorList });

  } catch (err) {
    console.error("❌ Error fetching vendors:", err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});



app.post('/api/admin/vendordetail', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const adminId = req.user.id;
    const vendor = req.body;
    const products = vendor.products || [];

    console.log("📥 Raw request body:", req.body);
    console.log("📥 Incoming vendor data:", vendor);
    console.log("📦 Products:", products);

    // Validate required fields
    const requiredFields = [
      'name', 'phone', 'address', 'companyName', 'city',
      'pincode', 'gstNumber', 'contactPerson', 'status',
      'category', 'productCount', 'state'
    ];

    for (const field of requiredFields) {
      if (!vendor[field]) {
        return res.status(400).json({ message: `Required field '${field}' is missing.` });
      }
    }

    let savedVendor;

    if (vendor.vendorId) {
      savedVendor = await Vendor.findByPk(vendor.vendorId);
      if (savedVendor) {
        await savedVendor.update({
          ...vendor,
          updatedAt: new Date(),
          adminId,
        });
      } else {
        return res.status(404).json({ message: "Vendor not found." });
      }
    } else {
      savedVendor = await Vendor.create({
        ...vendor,
        adminId,
        createdAt: new Date(),
      });
    }

    const savedProducts = [];

    if (Array.isArray(products)) {
      for (const rawProduct of products) {
        try {
          const product = {
            name: rawProduct.name || "Unnamed Product",
            productType: rawProduct.productType || "grocery",
            category: rawProduct.category || "General",
            description: rawProduct.description || "No description provided.",
            unitPrice: rawProduct.unitPrice != null ? rawProduct.unitPrice : 0,
            quantityAvailable: rawProduct.quantityAvailable != null ? rawProduct.quantityAvailable : 0,
            unit: rawProduct.unit || "pcs",
            status: rawProduct.status || "active",
            imageUrl: rawProduct.imageUrl || null,
          };

          let savedProduct;

          if (rawProduct.productId) {
            savedProduct = await Product.findByPk(rawProduct.productId);
            if (savedProduct) {
              await savedProduct.update({
                ...product,
                vendorId: savedVendor.vendorId,
                updatedAt: new Date(),
              });
            } else {
              console.warn(`⚠️ Product ID ${rawProduct.productId} not found. Skipping.`);
              continue;
            }
          } else {
            savedProduct = await Product.create({
              ...product,
              vendorId: savedVendor.vendorId,
              createdAt: new Date(),
            });
          }

          savedProducts.push(savedProduct);
        } catch (productError) {
          console.error("❌ Error saving product:", rawProduct, productError);
        }
      }
    }

    return res.status(200).json({
      message: vendor.vendorId ? "Vendor updated successfully." : "Vendor created successfully.",
      vendor: savedVendor,
      products: savedProducts,
    });

  } catch (err) {
    console.error("❌ Error in vendor submission:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
});


app.delete('/api/admin/delete-vendor/:vendorId', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const adminId = req.user.id; // Extracted from JWT token
    const { vendorId } = req.params;

    console.log("📥 Received request to delete vendor");
    console.log("🔑 Authenticated Admin ID:", adminId);
    console.log("🔍 Vendor ID to delete:", vendorId);

    const vendor = await Vendor.findByPk(vendorId);

    if (!vendor) {
      console.log("❌ Vendor not found with ID:", vendorId);
      return res.status(404).json({ message: "Vendor not found." });
    }

    // Only allow deletion if the vendor belongs to the admin

    // Delete all associated products
    const deletedProducts = await Product.destroy({ where: { vendorId } });
    console.log(`🗑️ Deleted ${deletedProducts} products for vendor ID: ${vendorId}`);

    // Delete the vendor
    await vendor.destroy();
    console.log(`✅ Vendor ID ${vendorId} deleted successfully.`);

    return res.status(200).json({ message: "Vendor and its products deleted successfully." });

  } catch (err) {
    console.error("❌ Error deleting vendor:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
});

app.get('/api/admin/activeVendors', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const adminId = req.user.id;  // Get the admin ID from the JWT token
    console.log(`✅ Admin ID extracted from token: ${adminId}`);

    // Fetch active vendors
    console.log("📡 Fetching vendors with status 'active' from DB...");
    const vendors = await Vendor.findAll({
      where: {
        status: 'Active',
      },
    });

    // Log raw vendor data
    console.log("📦 Raw vendors fetched from DB:", JSON.stringify(vendors, null, 2));

    // If no vendors found
    if (!vendors || vendors.length === 0) {
      console.warn("⚠️ No active vendors found.");
      return res.status(404).json({ message: "No active vendors found." });
    }

    // Map and format vendor data
    console.log(`🛠 Mapping ${vendors.length} vendors...`);
    const vendorData = vendors.map((vendor) => {
      const mappedVendor = {
        id: vendor.vendorId,
        name: vendor.name,
        city: vendor.city,
        phone: vendor.phone,
        address: vendor.address,
        status: vendor.status,
        products: vendor.products, // Assuming Sequelize association with products
      };
      console.log("✅ Mapped vendor:", mappedVendor);
      return mappedVendor;
    });

    console.log("🎯 Final vendor response to be sent:", JSON.stringify(vendorData, null, 2));
    return res.status(200).json(vendorData);

  } catch (err) {
    console.error("❌ Error fetching active vendors:", err);
    return res.status(500).json({ message: "Failed to fetch active vendors." });
  }
});

app.delete('/api/admin/delete-user/:userId',
  passport.authenticate('jwt', { session: false }),
  async (req, res) => {
    try {
      const adminId = req.user.id; // From JWT
      const { userId } = req.params;

      console.log("📥 Received request to delete user");
      console.log("🔑 Authenticated Admin ID:", adminId);
      console.log("🧍 User ID to delete:", userId);

      // Use userId instead of id
      const user = await User.findByPk(userId);

      if (!user) {
        console.log("❌ User not found with ID:", userId);
        return res.status(404).json({ message: "User not found." });
      }

      // Optional: Add any access check logic here if needed
      // Example: only allow admins to delete non-admin users

      // Delete user logs if applicable
      const deletedLogs = await UserLog.destroy({ where: { user_id: userId } });
      console.log(`🗑️ Deleted ${deletedLogs} log entries for user ID: ${userId}`);

      // Delete user
      await user.destroy();
      console.log(`✅ User ID ${userId} deleted successfully.`);

      return res.status(200).json({ message: "User and associated logs deleted successfully." });

    } catch (err) {
      console.error("❌ Error deleting user:", err);
      return res.status(500).json({ message: "Internal server error." });
    }
  }
);

app.get('/api/admin/dashboard-summary', passport.authenticate('jwt', { session: false }), async (req, res) => {
  const userId = req.user.id;
  console.log("🔐 Fetching dashboard summary for the admin:", userId);

  try {
    // Fetch total number of orders
    const totalOrders = await Order.count();

    // Fetch total number of active vendors
    const totalVendors = await Vendor.count();

    // Fetch total number of active delivery partners
    const totalDeliveryPartners = await User.count();

    // Prepare summary response
    const summary = {
      totalOrders,
      totalVendors,
      totalDeliveryPartners,
    };

    console.log("🎉 Dashboard summary fetched successfully:", summary);
    return res.status(200).json(summary);

  } catch (err) {
    console.error("❌ Error fetching dashboard summary:", err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});
  // Make sure to import the User model

app.post('/api/admin/assign-order', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const adminId = req.user.id;
    const {
      driverId,
      vendorId,
      pickupTime,
      deliveryTime,
      goodsType,
      fare,
      weight,
      distance,
      notes,
      location,     // format: "latitude,longitude"
      deliveryPlace // full address string
    } = req.body;

    console.log("📥 Incoming request body:", req.body);
    
    // Validate required fields
    if (!driverId || !vendorId) {
      console.error("❌ Missing required fields: driverId, vendorId.");
      return res.status(400).json({ message: 'Missing required fields: driverId, vendorId.' });
    }

    // Fetch driver details from the User table using driverId
    const driver = await User.findOne({
      where: { id: driverId },
      attributes: ['id', 'name', 'email', 'phone'], // You can fetch more fields as needed
    });

    if (!driver) {
      console.error("❌ Driver not found for driverId:", driverId);
      return res.status(404).json({ message: 'Driver not found.' });
    }

    const driverName = driver.name;  // Assuming 'name' field stores the driver's name
    console.log("✅ Driver found:", driverName);

    // Split location string if available
    let latitude = null, longitude = null;
    if (location) {
      console.log("📍 Parsing location:", location);
      const locArray = location.split(',').map(Number);
      if (locArray.length === 2 && !isNaN(locArray[0]) && !isNaN(locArray[1])) {
        latitude = locArray[0];
        longitude = locArray[1];
        console.log("✅ Parsed latitude:", latitude, "longitude:", longitude);
      } else {
        console.error("❌ Invalid location format. Use 'latitude,longitude'.");
        return res.status(400).json({ message: 'Invalid location format. Use "latitude,longitude".' });
      }
    }

    // Save location if available
    if (latitude && longitude) {
      console.log("📍 Saving location for driverId:", driverId);
      await Location.create({
        userId: driverId,
        latitude,
        longitude,
        address: deliveryPlace || '',
        lastUpdated: new Date(),
      });
      console.log("✅ Location saved successfully.");
    }

    // Create the order with optional/nullable fields
    console.log("📦 Creating order with details:", {
      driverId,
      assignedByAdminId: adminId,
      driverName,
      pickupLocation: deliveryPlace || '',
      deliveryLocation: deliveryPlace || '',
      status: 'assigned',
      pickupTime: pickupTime ? new Date(pickupTime) : null,
      deliveryTime: deliveryTime ? new Date(deliveryTime) : null,
      distanceInKm: distance || 0,
      loadWeightInTons: weight || 0,
      goodsType: goodsType || 'Not Specified',
      fare: fare || 0,
      notes: notes || '',
    });
    const order = await Order.create({
      driverId,
      assignedByAdminId: adminId,
      driverName,
      pickupLocation: deliveryPlace || '',
      deliveryLocation: deliveryPlace || '',
      status: 'assigned',
      pickupTime: pickupTime ? new Date(pickupTime) : null,
      deliveryTime: deliveryTime ? new Date(deliveryTime) : null,
      distanceInKm: distance || 0,
      loadWeightInTons: weight || 0,
      goodsType: goodsType || 'Not Specified',
      fare: fare || 0,
      notes: notes || '',
    });
    console.log("✅ Order created successfully:", order);

    // Find the latest FCM token for the driver
    console.log("🔍 Fetching the latest FCM token for driverId:", driverId);
    const userLog = await UserLog.findOne({
      where: { user_id: driverId },
      order: [['timestamp', 'DESC']],
    });

    if (!userLog) {
      console.error("❌ No user log found for driverId:", driverId);
    }

    // Send push notification if FCM token is available
    if (userLog && userLog.fcmToken) {
      console.log("📲 FCM token found, sending push notification...");
      const message = {
        message: {
          token: userLog.fcmToken,
          notification: {
            title: 'New Order Assigned 🚚',
            body: `Hi ${driverName}, you’ve been assigned a new order.`,
          },
          android: {
            notification: {
              sound: 'default',
              color: '#00aaff',
            },
          },
          data: {
            orderId: order.orderId.toString(),
            driverId: driverId,
            vendorId: vendorId,
          },
        },
      };

      const fcmResponse = await pushNotification.sendMessage(message);
      console.log("📲 Push sent successfully:", fcmResponse);
    } else {
      console.warn("⚠️ No FCM token found for driverId:", driverId);
    }

    return res.status(201).json({
      message: 'Order assigned and location saved successfully.',
      order,
    });
  } catch (err) {
    console.error('❌ Error in order assignment:', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});


// 📦 models/Order.js, Location.js, Vendor.js should be properly associated with the User model via `userId` and `driverId`
app.get('/api/user/user-order', passport.authenticate('jwt', { session: false }), async (req, res) => {
  const userId = req.user.id;
  console.log("🔐 Fetching orders for user ID:", userId);

  try {
    const orders = await Order.findAll({
      where: { driverId: userId },
      order: [['createdAt', 'DESC']],
    });

    if (!orders || orders.length === 0) {
      console.log("❌ No orders found for user:", userId);
      return res.status(200).json({ orders: [] });
    }

    const safeOrders = await Promise.all(orders.map(async (order) => {
      const location = await Location.findOne({
        where: { userId: order.driverId },
      });

      const vendor = await Vendor.findOne({
        where: { vendorId: order.vendorId },
      });

      return {
        id: order.id,
        orderId: order.orderId,
        pickupLocation: order.pickupLocation,
        deliveryLocation: order.deliveryLocation,
        status: order.status,
        pickupTime: order.pickupTime,
        deliveryTime: order.deliveryTime,
        distanceInKm: order.distanceInKm,
        loadWeightInTons: order.loadWeightInTons,
        goodsType: order.goodsType,
        fare: order.fare,
        notes: order.notes,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        location: location ? {
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address,
        } : null,
        vendor: vendor ? {
          vendorId: vendor.vendorId,
          name: vendor.name,
          phone: vendor.phone,
          email: vendor.email,
          companyName: vendor.companyName,
          address: vendor.address,
          gstNumber: vendor.gstNumber,
          // Add any other vendor fields you want here
        } : null,
      };
    }));

    console.log("✅ Orders response for user:", userId);
    console.dir(safeOrders, { depth: null });

    return res.status(200).json({ orders: safeOrders });

  } catch (error) {
    console.error("❌ Error fetching orders:", error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});





























// ✅ Start Server
sequelize.sync({ alter: true })
  .then(async () => {
    console.log('✅ Database Synced Successfully');

    try {
      await User.sync();
      await Location.sync();
      await Order.sync();
      await Vehicle.sync();
      console.log("🚀 All models synced successfully!");

      app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
      });
    } catch (syncError) {
      console.error('❌ Error syncing models:', syncError);
    }
  })
  .catch((error) => {
    console.error('❌ Database Sync Error:', error);
  });
