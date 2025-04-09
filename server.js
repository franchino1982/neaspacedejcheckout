const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
const nodemailer = require('nodemailer');
const axios = require('axios');

const stripe = Stripe('sk_live_...');
const endpointSecret = 'whsec_...';

const TELEGRAM_TOKEN = '...';
const TELEGRAM_CHAT_ID = '...';
const orders = {};

const app = express();

// ✅ 1. Route webhook PRIMA di express.json
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('⚠️ Verifica webhook fallita:', err.message);
    return res.sendStatus(400);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const order = orders[session.id];

    if (!order) {
      console.error('Ordine non trovato per session:', session.id);
      return res.sendStatus(404);
    }

    const message = `📦 *Nuovo ordine Neaspace!*\n\n${order.orderDetails}\n\n💰 Total: ${order.total.toFixed(2)} €`;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'design@francescorossi.co',
        pass: 'privilegeyard',
      },
    });

    transporter.sendMail({
      from: 'Neaspace <design@francescorossi.co>',
      to: 'design@francescorossi.co, boulangerie@gmail.com',
      subject: '✅ Ordine confermato',
      text: message.replace(/\*/g, ''),
    });

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'Markdown',
    });

    delete orders[session.id];
  }

  res.sendStatus(200);
});

// ✅ 2. Poi il resto del middleware
app.use(cors());
app.use(express.json());

// ✅ 3. Create Checkout Session
app.post('/create-checkout-session', async (req, res) => {
  const { total, orderDetails } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Petit-déjeuner Neaspace',
          },
          unit_amount: Math.round(total * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: 'https://francescorossi.co/success.html',
      cancel_url: 'https://francescorossi.co/cancel.html',
    });

    orders[session.id] = { total, orderDetails };
    res.json({ url: session.url });

  } catch (err) {
    console.error('❌ Errore creazione sessione Stripe:', err.message);
    res.status(500).json({ error: 'Errore creazione sessione Stripe' });
  }
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`✅ Server attivo su porta ${PORT}`));
