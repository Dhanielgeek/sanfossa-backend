
// --- index.js ---
const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

require("./cron/publishScheduledBlogs");

// 1. Load env
dotenv.config();

// 2. App
const app = express();

// 3. DB
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

// 4. Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// 5. Routes
const authRoutes = require("./Routes/authRoutes");
const blogRoutes = require("./Routes/blogRoutes");
const bookRoutes = require("./Routes/bookRoutes");
const orderRoutes = require("./Routes/orderRoutes");
const contactRoutes = require("./Routes/contactRoutes");
const newsletterRoutes = require("./Routes/newsletterRoutes");
const adminRoutes = require("./Routes/adminRoutes");
const adminDashboardRoutes = require("./Routes/adminDashboardRoutes");
const uploadRoutes = require("./Routes/uploadRoutes");
const subscribeRoutes = require("./Routes/subscribeRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/blog", blogRoutes);
app.use("/api/book", bookRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/contact", contactRoutes);

// ❌ Removed: app.use("/api/news", newsletterRoutes);  // duplicate/unintended
// ✅ Keep a single, clear mount for newsletter controller endpoints (create/send)
app.use("/api/newsletter", newsletterRoutes);

// Public subscriber endpoints (subscribe/unsubscribe)
app.use("/api/subscribers", subscribeRoutes);

app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminDashboardRoutes);
app.use("/api/uploads", uploadRoutes);

// 6. Health
app.get("/", (req, res) => {
  res.send("API is running...");
});

// 7. Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || "Server Error",
  });
});

// 8. Listen
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(
    `Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`
  )
);