const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
const nodemailer = require('nodemailer');
const axios = require('axios');

const stripe = Stripe('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');
const endpointSecret = 'whsec_7J80mRaCKhUmVb9EmtY3KjFZiLfw2QFP';

const TELEGRAM_TOKEN = '8176119113:AAFLpCf4Wtm3aGmcog_JWALYwEol2TjOVMQ';
const TELEGRAM_CHAT_ID = '1654425542';

const orders = {};

const app = express();
app.use(cors());
app.use(express.json());

// ✅ CREA SESSIONE STRIPE
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
      success_url: 'https://neaspace.com/success.html',
      cancel_url: 'https://neaspace.com/cancel.html',
    });

    orders[session.id] = { total, orderDetails };
    res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Errore creazione sessione Stripe:', err.message);
    res.status(500).json({ error: 'Errore creazione sessione Stripe' });
  }
});

// ✅ WEBHOOK STRIPE
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

    // EMAIL
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'design@francescorossi.co',
        pass: 'privilegeyard',
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
        console.log('Email inviata:', info.response);
      }
    });

    // TELEGRAM
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'Markdown',
    });

    delete orders[session.id];
  }

  res.sendStatus(200);
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`✅ Backend in ascolto su porta ${PORT}`));
