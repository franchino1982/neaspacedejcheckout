const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
const nodemailer = require('nodemailer');
const axios = require('axios');

const stripe = Stripe('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');
const TELEGRAM_TOKEN = '8176119113:AAFLpCf4Wtm3aGmcog_JWALYwEol2TjOVMQ';
const TELEGRAM_CHAT_ID = '1654425542';

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Endpoint per creare la sessione di pagamento
app.post('/create-checkout-session', async (req, res) => {
  const { total } = req.body;

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

  res.json({ url: session.url });
});

// ✅ Webhook per Stripe
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = 'whsec_7J80mRaCKhUmVb9EmtY3KjFZiLfw2QFP';

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('⚠️ Webhook signature verification failed.', err.message);
    return res.sendStatus(400);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // ✉️ Email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'design@francescorossi.co',
        pass: 'TUA_PASSWORD_O_APP_PASSWORD', // ← sostituiscila nel passo successivo
      },
    });

    const mailOptions = {
      from: 'Neaspace <design@francescorossi.co>',
      to: 'design@francescorossi.co, boulangerie@gmail.com',
      subject: '✅ Nuovo ordine colazione confermato!',
      text: `Hai ricevuto un nuovo ordine da Neaspace.\n\nSession ID: ${session.id}\nTotale: ${session.amount_total / 100} EUR`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Errore invio email:', error);
      } else {
        console.log('Email inviata:', info.response);
      }
    });

    // 📲 Telegram
    const message = `📦 Nuovo ordine confermato!\nTotale: ${session.amount_total / 100}€\nID: ${session.id}`;
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
    });
  }

  res.sendStatus(200);
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`✅ Server attivo su porta ${PORT}`));
