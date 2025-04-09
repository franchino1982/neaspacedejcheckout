const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
const nodemailer = require('nodemailer');
const axios = require('axios');

// ✅ Chiavi Stripe
const stripe = Stripe('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');
const endpointSecret = 'whsec_7J80mRaCKhUmVb9EmtY3KjFZiLfw2QFP';

// ✅ Telegram
const TELEGRAM_TOKEN = '8176119113:AAFLpCf4Wtm3aGmcog_JWALYwEol2TjOVMQ';
const TELEGRAM_CHAT_ID = '1654425542';

const app = express();
app.use(cors());

// ✅ Webhook Stripe (solo raw!)
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

    // ✅ Recupera dai metadata
    const orderDetails = session.metadata?.orderDetails || '⚠️ Nessun dettaglio ordine';
    const total = session.metadata?.total || '0.00';

    const message = `📦 *Nuovo ordine Neaspace!*\n\n${orderDetails}`;

    // ✅ Invia Email (con await + try/catch per evitare crash)
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: '19rueneuve@gmail.com',
          pass: 'mgbxsluutamptoqw' // Password per app Gmail
        }
      });

      const mailOptions = {
        from: 'Neaspace <design@francescorossi.co>',
        to: 'design@francescorossi.co, boulangerie@gmail.com',
        subject: '✅ Ordine confermato',
        text: message.replace(/\*/g, '')
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('📧 Email inviata:', info.response);
    } catch (error) {
      console.error('❌ Errore invio email:', error.message);
    }

    // ✅ Invia Telegram
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

// ✅ Parser JSON dopo il webhook
app.use(express.json());

// ✅ Crea sessione Stripe
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
      success_url: 'https://franchino1982.github.io/neaspacedejcheckout/success.html',
      cancel_url: 'https://franchino1982.github.io/neaspacedejcheckout/cancel.html',
      metadata: {
        orderDetails,
        total: total.toFixed(2)
      }
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Errore creazione sessione Stripe:', err.message);
    res.status(500).json({ error: 'Errore creazione sessione Stripe' });
  }
});

// ✅ Avvio server
const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`🚀 Server attivo su http://localhost:${PORT}`));
