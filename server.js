// server.js (VERSIONE MODIFICATA)
const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
const nodemailer = require('nodemailer');
const axios = require('axios');
const fetch = require('node-fetch');
const csv = require('csvtojson');

const stripe = Stripe('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');
const endpointSecret = 'whsec_7J80mRaCKhUmVb9EmtY3KjFZiLfw2QFP';

const TELEGRAM_TOKEN = '8176119113:AAFLpCf4Wtm3aGmcog_JWALYwEol2TjOVMQ';
const TELEGRAM_CHAT_ID = '1654425542';

const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRCXe8mIKXQycY1M7awc49gemXG8vY8tSdqzrWOqx4hGJ7Aq6hg7CFyW72MHXsZkbaX9SlV0DRRNgXt/pub?output=csv';

async function isDateOpen(dateStr) {
  const response = await fetch(sheetUrl);
  const csvData = await response.text();
  const rows = await csv().fromString(csvData);

  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  const formattedDate = new Date(dateStr).toLocaleDateString('en-GB', options).replace(/,/g, '');

  const match = rows.find(r => r.Date.trim() === formattedDate.trim());
  return !match || match.Status.toLowerCase() === 'open';
}

const app = express();
app.use(cors());

app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log('✅ Webhook ricevuto:', event.type);
  } catch (err) {
    console.error('❌ Webhook verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderDetails = session.metadata?.orderDetails || '⚠️ Nessun dettaglio ordine';
    const total = session.metadata?.total || '0.00';

    const message = `📦 *Nuovo ordine Neaspace!*\n\n${orderDetails}`;

    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: '19rueneuve@gmail.com',
          pass: 'mgbxsluutamptoqw'
        }
      });

      const mailOptions = {
        from: 'Neaspace <design@francescorossi.co>',
        to: 'design@francescorossi.co, dominika@zielinska.fr',
        subject: '✅ Ordine confermato',
        text: message.replace(/\*/g, '')
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('📧 Email inviata:', info.response);
    } catch (error) {
      console.error('❌ Errore invio email:', error.message);
    }

    try {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      });
    } catch (err) {
      console.error('❌ Errore invio Telegram:', err.message);
    }
  }

  res.sendStatus(200);
});

app.use(express.json());

app.post('/create-checkout-session', async (req, res) => {
  const { total, orderDetails, delivery_date } = req.body;

  const available = await isDateOpen(delivery_date);
  if (!available) {
    return res.status(400).json({
      error: "❌ Désolé, mais le fournil est fermé le jour sélectionné. Merci de choisir une autre date."
    });
  }

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
      success_url: 'https://franchino1982.github.io/neaspacedejcheckout/success.html',
      cancel_url: 'https://franchino1982.github.io/neaspacedejcheckout/cancel.html',
      metadata: {
        orderDetails,
        total: total.toFixed(2),
        delivery_date
      }
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Errore creazione sessione Stripe:', err.message);
    res.status(500).json({ error: 'Errore creazione sessione Stripe' });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server attivo su http://localhost:${PORT}`);
});
