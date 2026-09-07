const BlockBee = require("@blockbee/api");
const crypto = require("crypto");

const API_KEY = process.env.BLOCKBEE_API_KEY;
const CALLBACK_BASE_URL =
  process.env.BLOCKBEE_CALLBACK_BASE_URL || process.env.FRONTEND_URL;

// NGN is not settleable on-chain, so crypto checkout is priced in USD.
// Adjust here if the business later supports more settlement currencies.
const FIAT_CURRENCY = "USD";

if (!API_KEY) {
  console.warn(
    "[BLOCKBEE] BLOCKBEE_API_KEY is not set — crypto payments will fail.",
  );
}

/**
 * BlockBee's /create endpoint does not return a fiat->crypto conversion
 * even with convert=1, so the actual coin quantity to display/expect has
 * to come from the dedicated /convert endpoint.
 */
async function convertFiatToCoin({ coin, fiatValue }) {
  const url = new URL(`https://api.blockbee.io/${coin.replace("_", "/")}/convert/`);
  url.searchParams.append("value", fiatValue);
  url.searchParams.append("from", FIAT_CURRENCY);
  url.searchParams.append("apikey", API_KEY);

  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== "success") {
    throw new Error(data.error || "BlockBee conversion failed");
  }

  return Number(data.value_coin);
}

/**
 * Generates the opaque per-transaction token embedded in the BlockBee
 * callback URL. BlockBee does not sign callbacks, so this unguessable
 * token is what proves a callback hit actually corresponds to a
 * transaction we created (see cryptoPaymentController for verification).
 */
function generateCallbackToken() {
  return crypto.randomBytes(24).toString("hex");
}

/**
 * Creates a unique deposit address for the given coin/token and wires up
 * the callback URL that BlockBee will ping as the payment is detected and
 * confirmed on-chain.
 *
 * @param {Object} params
 * @param {string} params.coin - BlockBee coin/token ticker, e.g. "btc", "eth", "trx_usdt"
 * @param {number} params.fiatValue - amount denominated in FIAT_CURRENCY
 * @param {string} params.callbackToken - opaque token identifying this transaction
 */
async function createPaymentAddress({ coin, fiatValue, callbackToken }) {
  if (!API_KEY) {
    throw new Error("BlockBee API key is not configured");
  }

  const callbackUrl = `${CALLBACK_BASE_URL}/api/crypto/callback/${callbackToken}`;

  const bb = new BlockBee(
    coin,
    null,
    callbackUrl,
    {},
    {
      convert: 1,
      value: fiatValue,
      currency: FIAT_CURRENCY,
      confirmations: 1,
    },
    API_KEY,
  );

  const address = await bb.getAddress();

  if (!address) {
    throw new Error("BlockBee did not return a payment address");
  }

  const coinAmount = await convertFiatToCoin({ coin, fiatValue }).catch(
    (error) => {
      console.error("[BLOCKBEE] fiat->coin conversion failed:", error.message);
      return null;
    },
  );

  const qr = await bb
    .getQrcode(coinAmount || undefined)
    .catch(() => null);

  return {
    address,
    coinAmount,
    qrCodeDataUri:
      qr && qr.qr_code ? `data:image/png;base64,${qr.qr_code}` : null,
    fiatCurrency: FIAT_CURRENCY,
  };
}

async function getSupportedCoins() {
  if (!API_KEY) {
    throw new Error("BlockBee API key is not configured");
  }
  return BlockBee.getSupportedCoins(API_KEY);
}

module.exports = {
  FIAT_CURRENCY,
  generateCallbackToken,
  createPaymentAddress,
  getSupportedCoins,
};
