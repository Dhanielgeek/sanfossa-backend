const axios = require("axios");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Book = require("../Models/BooksModel");
const Library = require("../Models/LibraryModel");

/**
 * Read-only access to story media.
 *
 * Raw storage URLs (UploadThing / Cloudinary) are never sent to the browser.
 * Instead an entitled user gets a short-lived stream token from
 * GET /api/book/:id/access, and the media bytes are proxied through
 * GET /api/book/:id/stream/:kind so the file can only be read on the platform.
 */

const MEDIA_KINDS = ["pdf", "audio", "video"];
const STREAM_TOKEN_TTL = process.env.STREAM_TOKEN_TTL || "2h";
const UPSTREAM_TIMEOUT_MS = 30 * 1000;

// Navigations (typing the URL, "open in new tab") and embedding in
// frames/objects are refused so the stream can't be opened as a plain file.
const BLOCKED_FETCH_DESTINATIONS = new Set([
  "document",
  "iframe",
  "frame",
  "embed",
  "object",
]);

const DEFAULT_CONTENT_TYPES = {
  pdf: "application/pdf",
  audio: "audio/mpeg",
  video: "video/mp4",
};

const AUDIO_EXTENSIONS = /\.(mp3|wav|m4a|aac|ogg|oga|flac)(?:[?#].*)?$/i;
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|mkv|3gp|mpeg|mpg)(?:[?#].*)?$/i;

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const isValidId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));

/**
 * Resolve the storage URL for one kind of media on a book.
 */
const resolveMediaUrl = (book, kind) => {
  if (!book) return null;

  if (kind === "pdf") {
    return book.pdfFile || null;
  }

  if (kind === "audio") {
    if (book.audioFile || book.audioUrl) return book.audioFile || book.audioUrl;
    if (book.mediaUrl && AUDIO_EXTENSIONS.test(book.mediaUrl)) {
      return book.mediaUrl;
    }
    return null;
  }

  if (kind === "video") {
    if (book.videoFile || book.videoUrl) return book.videoFile || book.videoUrl;
    if (book.mediaUrl && VIDEO_EXTENSIONS.test(book.mediaUrl)) {
      return book.mediaUrl;
    }
    return null;
  }

  return null;
};

const availableMedia = (book) =>
  MEDIA_KINDS.filter((kind) => Boolean(resolveMediaUrl(book, kind)));

/**
 * Strip every field that would let a client fetch the file directly.
 * Used for all public/user-facing book payloads.
 */
const toPublicBook = (book, { includeContent = false } = {}) => {
  if (!book) return book;

  const data = typeof book.toObject === "function" ? book.toObject() : { ...book };
  const media = availableMedia(data);

  delete data.pdfFile;
  delete data.pdfPublicId;
  delete data.audioFile;
  delete data.audioUrl;
  delete data.videoFile;
  delete data.videoUrl;
  delete data.mediaUrl;
  delete data.createdBy;

  if (!includeContent) {
    delete data.content;
  }

  data.media = media;
  data.hasPdf = media.includes("pdf");
  data.hasAudio = media.includes("audio");
  data.hasVideo = media.includes("video");

  return data;
};

const userOwnsBook = async (user, bookId) => {
  if (!user) return false;

  const owners = [{ userId: user._id }];
  const email = normalizeEmail(user.email);
  if (email) owners.push({ email });

  const owned = await Library.exists({
    schemaVersion: 2,
    "books.bookId": bookId,
    $or: owners,
  });

  return Boolean(owned);
};

/**
 * Returns the book the user is allowed to read, or null.
 * - Free published books: any signed-in user.
 * - Paid books: only users with the book in their library (even if the book
 *   was later unpublished, purchasers keep access).
 */
const findReadableBook = async (user, bookId) => {
  if (!isValidId(bookId)) return { book: null, owned: false };

  const book = await Book.findById(bookId);
  if (!book) return { book: null, owned: false };

  const owned = await userOwnsBook(user, book._id);
  const isPublishedFree = book.status === "published" && !(book.price > 0);

  if (owned || isPublishedFree) {
    return { book, owned };
  }

  return { book: book.status === "published" ? book : null, owned: false, locked: true };
};

const signStreamToken = (user, book) =>
  jwt.sign(
    {
      type: "stream",
      sub: String(user._id),
      bookId: String(book._id),
    },
    process.env.JWT_SECRET,
    { expiresIn: STREAM_TOKEN_TTL, algorithm: "HS256" },
  );

/**
 * GET /api/book/:id/access   (protect)
 */
exports.getBookAccess = async (req, res) => {
  try {
    const { book, owned, locked } = await findReadableBook(req.user, req.params.id);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    if (locked) {
      return res.status(200).json({
        success: true,
        data: {
          canRead: false,
          isFree: false,
          owned: false,
          book: toPublicBook(book),
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        canRead: true,
        isFree: !(book.price > 0),
        owned,
        book: toPublicBook(book, { includeContent: true }),
        streamToken: signStreamToken(req.user, book),
      },
    });
  } catch (error) {
    console.error("[BOOK][ACCESS] error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to check access",
    });
  }
};

const readStreamToken = (req) => {
  const headerToken = req.get("x-stream-token");
  if (headerToken) return headerToken;

  const queryToken = req.query && req.query.token;
  return typeof queryToken === "string" ? queryToken : null;
};

/**
 * GET /api/book/:id/stream/:kind
 * Auth: stream token from /access, sent as X-Stream-Token header
 * (PDF reader) or ?token= (audio/video elements can't set headers).
 */
exports.streamBookMedia = async (req, res) => {
  const { id, kind } = req.params;

  if (!MEDIA_KINDS.includes(kind) || !isValidId(id)) {
    return res.status(404).json({ success: false, message: "Not found" });
  }

  const fetchDest = String(req.get("sec-fetch-dest") || "").toLowerCase();
  if (BLOCKED_FETCH_DESTINATIONS.has(fetchDest)) {
    return res.status(403).json({
      success: false,
      message: "This content can only be read on SankofaSeek.",
    });
  }

  const token = readStreamToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: "Not authorized" });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    return res.status(401).json({
      success: false,
      message: "Reading session expired. Please reopen the book.",
    });
  }

  if (payload.type !== "stream" || payload.bookId !== String(id)) {
    return res.status(403).json({ success: false, message: "Not authorized" });
  }

  try {
    const book = await Book.findById(id).select(
      "pdfFile audioFile audioUrl videoFile videoUrl mediaUrl",
    );
    const sourceUrl = resolveMediaUrl(book, kind);

    if (!sourceUrl || !/^https:\/\//i.test(sourceUrl)) {
      return res.status(404).json({ success: false, message: "Media not found" });
    }

    // PDFs are sent in one response (the reader would otherwise fire
    // hundreds of small range requests); audio/video keep byte ranges so
    // seeking works.
    const supportsRange = kind !== "pdf";
    const upstreamHeaders = {};
    const range = req.get("range");
    if (supportsRange && range && /^bytes=\d*-\d*$/.test(range)) {
      upstreamHeaders.Range = range;
    }

    const upstream = await axios.get(sourceUrl, {
      responseType: "stream",
      headers: upstreamHeaders,
      timeout: UPSTREAM_TIMEOUT_MS,
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
    });

    if (upstream.status >= 400 && upstream.status !== 416) {
      upstream.data.destroy();
      console.error("[BOOK][STREAM] upstream error:", upstream.status);
      return res.status(502).json({ success: false, message: "Media unavailable" });
    }

    const contentType = String(upstream.headers["content-type"] || "");
    res.status(upstream.status);
    res.set({
      "Content-Type":
        contentType && !contentType.startsWith("application/octet-stream")
          ? contentType
          : DEFAULT_CONTENT_TYPES[kind],
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Cross-Origin-Resource-Policy": "same-site",
      "Accept-Ranges": supportsRange
        ? upstream.headers["accept-ranges"] || "bytes"
        : "none",
    });

    for (const header of supportsRange
      ? ["content-length", "content-range"]
      : ["content-length"]) {
      if (upstream.headers[header]) res.set(header, upstream.headers[header]);
    }

    req.on("close", () => upstream.data.destroy());
    upstream.data.on("error", (error) => {
      console.error("[BOOK][STREAM] pipe error:", error.message);
      res.destroy(error);
    });
    upstream.data.pipe(res);
  } catch (error) {
    console.error("[BOOK][STREAM] error:", error.message);
    if (!res.headersSent) {
      return res.status(502).json({ success: false, message: "Media unavailable" });
    }
    res.destroy(error);
  }
};

exports.toPublicBook = toPublicBook;
exports.MEDIA_KINDS = MEDIA_KINDS;
