const express = require('express');
const router = express.Router();
const db = require('../db');
const { sendTelegramNotification } = require('../telegram');
const humopay = require('../services/humopayClient');

/**
 * POST /api/humopay/create
 * Create a payment order via HumoPay API.
 * 
 * Body: { telegram_id, amount }
 * Returns: { success, data: { order_id, card_number, card_owner, amount, expires_in } }
 */
router.post('/create', async (req, res) => {
  try {
    const { telegram_id, amount } = req.body;

    if (!telegram_id || !amount) {
      return res.status(422).json({ success: false, error: 'telegram_id and amount required' });
    }

    const amountInt = parseInt(amount);
    if (amountInt < 1000 || amountInt > 10000000) {
      return res.status(422).json({
        success: false,
        error: 'Amount must be between 1000 and 10000000',
      });
    }

    console.log(`[HumoPay] Creating order: telegram_id=${telegram_id}, amount=${amountInt}`);

    const humoResult = await humopay.createOrder(amountInt);

    if (!humoResult.success) {
      console.error(`[HumoPay] Create failed:`, humoResult.error);
      return res.status(400).json({ success: false, error: humoResult.error || 'HumoPay error' });
    }

    const actualAmount = humoResult.amount || amountInt;
    const orderId = humoResult.order_id;

    console.log(`[HumoPay] Order created: ${orderId}, amount=${actualAmount}`);

    await db.query(
      `INSERT INTO orders (telegram_id, external_id, product_type, amount, status, created_at)
       VALUES ($1, $2, 'topup', $3, 'pending', NOW())`,
      [telegram_id, orderId, actualAmount]
    );

    res.json({
      success: true,
      data: {
        order_id: orderId,
        amount: actualAmount,
        card_number: humopay.CARD_NUMBER,
        card_owner: humopay.CARD_OWNER,
        expires_in: 300,
      },
    });

  } catch (err) {
    console.error('[HumoPay] Create error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/humopay/check/:order_id
 * Check payment status via HumoPay API.
 * If paid — credits user balance automatically.
 */
router.get('/check/:order_id', async (req, res) => {
  try {
    const { order_id } = req.params;

    console.log(`[HumoPay] Check request: order=${order_id}`);

    const humoResult = await humopay.checkOrder(order_id);

    console.log(`[HumoPay] Check result:`, JSON.stringify(humoResult));

    if (!humoResult.paid) {
      return res.json({
        success: true,
        data: {
          order_id,
          status: humoResult.status || 'pending',
          paid: false,
        },
      });
    }

    const order = await db.getOrderByExternalId(order_id);

    if (!order) {
      console.log(`[HumoPay] Order ${order_id} not found in local DB`);
      return res.json({
        success: true,
        data: { order_id, status: 'paid', paid: true },
      });
    }

    if (order.status === 'completed') {
      return res.json({
        success: true,
        data: { order_id, status: 'paid', paid: true, already_credited: true },
      });
    }

    const user_id = order.telegram_id;
    const rawAmount = humoResult.amount || Number(order.amount) || 0;
    const amount = Math.round(parseFloat(String(rawAmount)));

    const newBalance = await db.addBalance(user_id, amount);
    await db.updateOrderStatus(order_id, 'completed');

    await db.recordPayment(
      order_id,
      user_id,
      amount,
      'paid',
      JSON.stringify({ source: 'humopay_check', checked_at: new Date().toISOString() })
    );

    await sendTelegramNotification(user_id, amount, newBalance);

    console.log(`[HumoPay] Payment confirmed: order=${order_id} user=${user_id} amount=${amount}`);

    res.json({
      success: true,
      data: {
        order_id,
        status: 'paid',
        paid: true,
        amount,
        new_balance: newBalance,
      },
    });

  } catch (err) {
    console.error('[HumoPay] Check error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/humopay/pending
 * Returns all pending payments (for bot recovery on restart)
 */
router.get('/pending', async (req, res) => {
  try {
    const orders = await db.getPendingOrders();
    const payments = orders.map(o => ({
      provider_transaction_id: o.external_id,
      telegram_id: o.telegram_id,
      amount_uzs: o.amount,
      created_at: o.created_at,
    }));

    res.json({ success: true, data: payments });
  } catch (err) {
    console.error('[HumoPay] Pending error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
