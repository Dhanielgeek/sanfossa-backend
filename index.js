// --- index.js ---
require("dotenv").config();
const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const morgan = require("morgan");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const sanitizeRequest = require("./middleware/sanitize");

require("./cron/publishScheduledBlogs");
const {
  processDueScheduledNewsletters,
} = require("./cron/sendScheduledNewsletters");

// Some SDKs (e.g. @blockbee/api's constructor) fire promises without a
// .catch. On Node >= 15 an unhandled rejection exits the process, which
// would take the whole API down when a third-party call fails. Log instead.
process.on("unhandledRejection", (reason) => {
  console.error("[UNHANDLED REJECTION]", reason);
});

// 2. App
const app = express();

// 3. DB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected:${conn.connection.host}`);
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
  "https://sankofaseek.com",
];

app.set("trust proxy", 1);

app.use(
  helmet({
    // Cross-Origin-Resource-Policy would block the frontend (a different
    // origin) from loading images/PDFs served from /uploads.
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser requests (curl, server-to-server, BlockBee IPN)
      // which send no Origin header at all.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

// Never write secrets that travel in URLs (stream tokens, BlockBee
// callback tokens) to the request log.
morgan.token("url", (req) =>
  String(req.originalUrl || req.url)
    .replace(/([?&]token=)[^&]+/gi, "$1[redacted]")
    .replace(/(\/api\/crypto\/callback\/)[^/?]+/i, "$1[redacted]"),
);
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(sanitizeRequest);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const isMediaStream = (req) => /^\/book\/[^/]+\/stream\//.test(req.path);

// General API rate limit. Media streams have their own limiter below
// because audio/video seeking issues many range requests.
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: isMediaStream,
  }),
);

app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1500,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => !isMediaStream(req),
  }),
);

// Stricter limits on sensitive/abuse-prone routes.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many attempts, please try again later." },
  // Session refresh is authenticated and infrequent; don't count it
  // against the login/registration budget.
  skip: (req) => req.path === "/refresh",
});

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many payment requests, please try again later." },
});

// BlockBee's IPN can call back multiple times per transaction (pending ->
// confirmed) from its own servers, so this needs a much higher ceiling
// than user-initiated payment requests.
const cryptoCallbackLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

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
const pdfRoutes = require("./Routes/pdf.routes");
const subscribeRoutes = require("./Routes/subscribeRoutes");
const healthRoutes = require("./Routes/healthRoutes");
const subscriberGroupRoutes = require("./Routes/subscriberGroupRoutes");
const transactionRoutes = require("./Routes/transactionsRoutes");
const waitlistRoutes = require("./Routes/waitlistRoutes");
const libraryRoutes = require("./Routes/libraryRoutes");
const mediaRoutes = require("./Routes/mediaRoutes");
const { sendEmail } = require("./services/emailservice");
const userdashboardRoutes = require("./Routes/userDashboardRoutes");
const reflectionNoteRoutes = require("./Routes/reflectionNoteRoutes");
const {
  router: cryptoPaymentRoutes,
  callbackRouter: cryptoCallbackRoutes,
} = require("./Routes/cryptoPaymentRoutes");

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/admin/login", authLimiter);
app.use("/api/blog", blogRoutes);
app.use("/api/book", bookRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/library", libraryRoutes);
app.use("/api", subscriberGroupRoutes);
app.use("/api/reflection-notes", reflectionNoteRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/waitlist", waitlistRoutes);

// Public subscriber endpoints (subscribe/unsubscribe)
app.use("/api/subscribers", subscribeRoutes);

app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminDashboardRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/pdfs", pdfRoutes);
app.use("/api/media", mediaRoutes);
// Health endpoints (e.g. MailerLite token validation)
app.use("/api/health", healthRoutes);

//Paystack Routes

app.use("/api/transactions", paymentLimiter, transactionRoutes);

// Crypto payments (BlockBee)
app.use("/api/crypto/callback", cryptoCallbackLimiter, cryptoCallbackRoutes);
app.use("/api/crypto", paymentLimiter, cryptoPaymentRoutes);

app.use("/api/dashboard", userdashboardRoutes);

// 6. Health
app.get("/", (req, res) => {
  res.send("API is running...");
});

// 7. Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    // Don't leak internals (stack/DB messages) on unexpected errors.
    error: status < 500 ? err.message : "Server Error",
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

// Development-only manual mail smoke test. Disabled unless explicitly enabled.
if (process.env.ENABLE_EMAIL_TEST_ROUTE === "true") {

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
}
