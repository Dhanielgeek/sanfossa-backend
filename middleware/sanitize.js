/**
 * Strips Mongo operator keys ($gt, $where, etc.) and dotted paths from
 * user-supplied objects to prevent NoSQL query/operator injection.
 *
 * Written in-house because express-mongo-sanitize mutates req.query in
 * place, which Express 5 made a read-only getter (breaks every GET route
 * with a query string). This sanitizes req.body/req.params directly and
 * rebuilds req.query onto the request instead of mutating it.
 */
const isPlainObject = (value) =>
  Object.prototype.toString.call(value) === "[object Object]";

function sanitizeValue(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (isPlainObject(value)) {
    const clean = {};
    for (const [key, val] of Object.entries(value)) {
      if (key.startsWith("$") || key.includes(".")) {
        continue;
      }
      clean[key] = sanitizeValue(val);
    }
    return clean;
  }

  return value;
}

module.exports = function sanitizeRequest(req, res, next) {
  if (req.body) {
    req.body = sanitizeValue(req.body);
  }

  if (req.params) {
    req.params = sanitizeValue(req.params);
  }

  if (req.query && Object.keys(req.query).length > 0) {
    const cleanQuery = sanitizeValue(req.query);
    Object.defineProperty(req, "query", {
      value: cleanQuery,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }

  next();
};
