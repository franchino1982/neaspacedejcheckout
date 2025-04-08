const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
const nodemailer = require('nodemailer');
const axios = require('axios');

const stripe = Stripe('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');
const TELEGRAM_TOKEN = '8176119113:AAFLpCf4Wtm3aGmcog_JWALYwEol2TjOVMQ';
const TELEGRAM_CHAT_ID = '1654425542';

const orders = {};

const app = express();
app.use(cors());
app.use(express.json());

// ✅ CREA SESSIONE STRIPE E SALVA ORDINE
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { total, orderDetails } = req.body;

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
      success_url: 'https://neaspace.com/success.html',
      cancel_url: 'https://neaspace.com/cancel.html',
    });

    orders[session.id] = {
      total,
      orderDetails,
    };

    res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Errore creazione sessione Stripe:', err.message);
    res.status(500).json({ error: 'Stripe session failed' });
  }
});

// ✅ WEBHOOK STRIPE
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = 'whsec_7J80mRaCKhUmVb9EmtY3KjFZiLfw2QFP';

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
      console.error('❌ Ordine non trovato per session ID:', session.id);
      return res.sendStatus(404);
    }

    const message = `📦 *Nuovo ordine Neaspace!*\n\n${order.orderDetails}\n💰 Total: ${order.total.toFixed(2)} €`;

    // 📩 EMAIL
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'design@francescorossi.co',
        pass: 'privilegeyard', // ← inserisci la tua app password qui
      },
    });

    const mailOptions = {
      from: 'Neaspace <design@francescorossi.co>',
      to: 'design@francescorossi.co, boulangerie@gmail.com',
      subject: '✅ Ordine confermato',
      text: message.replace(/\*/g, ''),
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Errore invio email:', error);
      } else {
        console.log('📩 Email inviata:', info.response);
      }
    });

    // 📲 TELEGRAM
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'Markdown',
    });

    // ✅ CLEANUP
    delete orders[session.id];
  }

  res.sendStatus(200);
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`✅ Backend attivo su porta ${PORT}`));
