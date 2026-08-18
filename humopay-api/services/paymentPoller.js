const db = require('../db');
const humopay = require('./humopayClient');
const { sendTelegramNotification } = require('../telegram');

const POLL_INTERVAL_MS = 15000;

let intervalHandle = null;
let isProcessing = false;

function start() {
  if (intervalHandle) {
    console.log('[Poller] Already running');
    return;
  }

  console.log(`[Poller] Starting — checking payments every ${POLL_INTERVAL_MS / 1000}s`);
  intervalHandle = setInterval(pollPendingOrders, POLL_INTERVAL_MS);
  setImmediate(pollPendingOrders);
}

function stop() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[Poller] Stopped');
  }
}

async function pollPendingOrders() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const orders = await db.getPendingOrders();
    if (orders.length === 0) return;

    for (const order of orders) {
      try {
        await processOrder(order);
      } catch (err) {
        console.error(`[Poller] Error processing order ${order.external_id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[Poller] Error fetching pending orders:', err.message);
  } finally {
    isProcessing = false;
  }
}

async function processOrder(order) {
  const externalId = order.external_id;
  if (!externalId) return;

  const result = await humopay.checkOrder(externalId);
  if (!result.paid) return;

  const rawAmount = result.amount || Number(order.amount) || 0;
  const amount = Math.round(parseFloat(String(rawAmount)));
  const telegramId = order.telegram_id;

  const newBalance = await db.addBalance(telegramId, amount);
  await db.updateOrderStatus(externalId, 'completed');

  await db.recordPayment(
    externalId,
    telegramId,
    amount,
    'paid',
    JSON.stringify({ source: 'poller', polled_at: new Date().toISOString() })
  );

  await sendTelegramNotification(telegramId, amount, newBalance);
  console.log(`[Poller] Auto-credited: user=${telegramId}, amount=${amount}, new_balance=${newBalance}`);
}

module.exports = { start, stop };
