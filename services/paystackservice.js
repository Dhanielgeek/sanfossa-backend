const axios = require("axios");

const paystack = axios.create({
  baseURL: process.env.PAYSTACK_BASE_URL,
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  },
});

exports.initializePayment = async ({ email, amount, reference, callback_url }) => {
  const response = await paystack.post("/transaction/initialize", {
    email,
    amount: amount,
    reference,
    currency: "NGN",
    ...(callback_url ? { callback_url } : {}),
  });

  return response.data;
};

exports.verifyPayment = async (reference) => {
  const response = await paystack.get(`/transaction/verify/${reference}`);
  return response.data;
};
