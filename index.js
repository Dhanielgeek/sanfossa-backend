// --- index.js ---
const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path"); // Core Node module for path manipulation

// --- 1. Load Environment Variables ---
dotenv.config();

// --- 2. Initialize App ---
const app = express();

// --- 3. Database Connection Routine ---
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};
connectDB();

// --- 4. Middleware Setup ---

// a. Enable CORS (Cross-Origin Resource Sharing)
app.use(cors());

// b. Body Parser (Accepts JSON data from requests)
app.use(express.json());

// c. Static Folder Setup (Crucial for serving uploaded images)
// This makes files in the 'uploads' directory accessible via the '/uploads' URL path
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- 5. Route Mounting ---

// Import all required route files
const authRoutes = require("./Routes/authRoutes");
const blogRoutes = require("./Routes/blogRoutes");
const bookRoutes = require("./Routes/bookRoutes");
const orderRoutes = require("./Routes/orderRoutes");
const contactRoutes = require("./Routes/contactRoutes");
const newsletterRoutes = require("./Routes/newsletterRoutes");
const adminRoutes = require("./Routes/adminRoutes");

// Mount the routes to their respective API endpoints
app.use("/api/auth", authRoutes); // Authentication, Login, Register, Profile
app.use("/api/blog", blogRoutes); // Blog CRUD & Image Upload
app.use("/api/book", bookRoutes); // Book Inventory Management
app.use("/api/order", orderRoutes); // Sales Transactions
app.use("/api/contact", contactRoutes); // Contact Form Submission
app.use("/api/news", newsletterRoutes); // Newsletter Subscription
app.use("/api/admin", adminRoutes);

// --- 6. Basic Health Check Route ---
app.get("/", (req, res) => {
  res.send("API is running...");
});

// --- 7. Error Handling Middleware (Recommended for production apps) ---
// This should be the last piece of middleware before the server listener.
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || "Server Error",
  });
});

// --- 8. Start Server Listener ---
const PORT = process.env.PORT || 5000;

app.listen(PORT, () =>
  console.log(
    `Server running in ${
      process.env.NODE_ENV || "development"
    } mode on port ${PORT}`
  )
);
