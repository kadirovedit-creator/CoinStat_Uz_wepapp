/**
 * HumoPay API Client
 * 
 * HumoPay — платёжный сервис для автоматического детектирования переводов на карту.
 */
const axios = require('axios');

const API_URL = process.env.HUMOPAY_API_URL || process.env.ELDERPAY_API_URL || '';
const SHOP_ID = process.env.HUMOPAY_SHOP_ID || process.env.SHOP_ID || '';
const SHOP_KEY = process.env.HUMOPAY_SHOP_KEY || process.env.SHOP_KEY || '';
const CARD_NUMBER = process.env.CARD_NUMBER || '';
const CARD_OWNER = process.env.CARD_OWNER || '';

/**
 * Create a payment order via HumoPay.
 * 
 * @param {number} amount - Amount in UZS
 * @param {number} [over=10] - Overpayment tolerance percentage
 * @returns {Promise<{success: boolean, order_id?: string, error?: string}>}
 */
async function createOrder(amount, over = 10) {
  console.log(`[HumoPay] Creating order: amount=${amount}, over=${over}`);
  console.log(`[HumoPay] API_URL=${API_URL}, SHOP_ID=${SHOP_ID}`);

  let result = await _callHumoPay({
    method: 'create',
    shop_id: SHOP_ID,
    shop_key: SHOP_KEY,
    amount: amount,
    over: over,
  });

  if (result.status === 'error') {
    console.log(`[HumoPay] Initial create failed, starting retry...`);
    let retryAmount = amount + 1;
    let retryResult;

    for (let i = 0; i < 200; i++) {
      retryResult = await _callHumoPay({
        method: 'create',
        shop_id: SHOP_ID,
        shop_key: SHOP_KEY,
        amount: retryAmount,
        over: over,
      });

      console.log(`[HumoPay] Retry ${i + 1}: amount=${retryAmount}, status=${retryResult.status}`);

      if (retryResult.status !== 'error') {
        console.log(`[HumoPay] Retry succeeded at attempt ${i + 1}`);
        return {
          success: true,
          order_id: retryResult.order,
          amount: retryAmount,
        };
      }
      retryAmount++;
    }

    console.error(`[HumoPay] All retries failed`);
    return { success: false, error: retryResult?.message || 'HumoPay create failed after retries' };
  }

  if (!result.order) {
    console.error(`[HumoPay] No order_id in response:`, JSON.stringify(result));
    return { success: false, error: 'No order_id returned' };
  }

  console.log(`[HumoPay] Order created: ${result.order}, amount=${amount}`);
  return {
    success: true,
    order_id: result.order,
    amount: amount,
  };
}

/**
 * Check payment status via HumoPay.
 * 
 * @param {string} orderId - HumoPay order ID
 * @returns {Promise<{status: string, amount?: number, paid: boolean}>}
 */
async function checkOrder(orderId) {
  console.log(`[HumoPay] Checking order: ${orderId}`);

  const result = await _callHumoPay({
    method: 'check',
    order: orderId,
    shop_id: SHOP_ID,
    shop_key: SHOP_KEY,
  });

  console.log(`[HumoPay] Check response:`, JSON.stringify(result));

  if (!result || result.status === 'error') {
    return { status: 'pending', paid: false };
  }

  const orderData = result.data || result;
  const status = orderData.status || 'pending';

  const rawAmount = orderData.amount || result.amount || 0;
  const parsedAmount = Math.round(parseFloat(String(rawAmount)));

  return {
    status: status,
    amount: parsedAmount || null,
    paid: status === 'paid',
  };
}

/**
 * Low-level call to HumoPay API.
 */
async function _callHumoPay(params) {
  try {
    const response = await axios.post(API_URL, new URLSearchParams(params), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    });
    return response.data;
  } catch (err) {
    return err.response?.data || { status: 'error', message: err.message };
  }
}

module.exports = {
  createOrder,
  checkOrder,
  CARD_NUMBER,
  CARD_OWNER,
};
