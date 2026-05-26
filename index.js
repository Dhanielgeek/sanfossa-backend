// --- index.js ---
const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

require("./cron/publishScheduledBlogs");
const { processDueScheduledNewsletters } = require("./cron/sendScheduledNewsletters");

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
setInterval(() => {
  processDueScheduledNewsletters().catch((error) =>
    console.error("[NEWSLETTER][SCHEDULED][LOOP][ERROR]", error),
  );
}, 60 * 1000);

// 4. Middleware
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://www.sankofaseek.com",
];

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

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
const healthRoutes = require("./Routes/healthRoutes");
const subscriberGroupRoutes = require("./Routes/subscriberGroupRoutes");
const transactionRoutes = require("./Routes/transactionsRoutes");
const waitlistRoutes = require("./Routes/waitlistRoutes");
const libraryRoutes = require("./Routes/libraryRoutes");
const { sendEmail } = require("./services/emailservice");

app.use("/api/auth", authRoutes);
app.use("/api/blog", blogRoutes);
app.use("/api/book", bookRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/library", libraryRoutes);
app.use("/api", subscriberGroupRoutes);

app.use("/api/newsletter", newsletterRoutes);
app.use("/api/waitlist", waitlistRoutes);

// Public subscriber endpoints (subscribe/unsubscribe)
app.use("/api/subscribers", subscribeRoutes);

app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminDashboardRoutes);
app.use("/api/uploads", uploadRoutes);
// Health endpoints (e.g. MailerLite token validation)
app.use("/api/health", healthRoutes);

console.log("🔥 Library route import:", libraryRoutes);
//Paystack Routes

app.use("/api/transactions", transactionRoutes);

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
    `Server running in ${
      process.env.NODE_ENV || "development"
    } mode on port ${PORT}`,
  ),
);

//9. Email Service

app.get("/test-email", async (req, res) => {
  try {
    const result = await sendEmail({
      to: "dhanielknightz46@gmail.com", // use your own email
      subject: "Test Email",
      html: "<h1>It works 🎉</h1><p>Your Resend setup is correct.</p>",
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
