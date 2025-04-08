const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');

const stripe = Stripe('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'); // <-- sostituiscila!

const app = express();
app.use(cors());
app.use(express.json());

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
    success_url: 'https://neaspace.com/success',
    cancel_url: 'https://neaspace.com/cancel',
  });

  res.json({ url: session.url });
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
