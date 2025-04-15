require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');
const cors = require('cors');
const finnhub = require('finnhub');
const axios = require('axios');

const app = express();
const PORT = 3000;

// 🧠 In-memory dashboard (clears on restart)
let dashboardData = [];

app.use(cors());
app.use(express.json());

// 🟩 Show login.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 🟩 Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// 🟩 Session setup
app.use(session({
  secret: 'mysecretkey',
  resave: false,
  saveUninitialized: false
}));

// 🟩 Passport setup
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback'
}, (accessToken, refreshToken, profile, done) => {
  return done(null, profile);
}));

passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((user, done) => {
  done(null, user);
});

// 🔐 Auth routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login.html' }),
  (req, res) => {
    res.redirect('/index.html'); // redirect to main page
  }
);

app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

// 🔐 Middleware to protect pages
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login.html');
}

// 🔒 Protect dashboard
app.get('/dashboard.html', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// 📈 Finnhub setup
const api_key = finnhub.ApiClient.instance.authentications['api_key'];
api_key.apiKey = process.env.API_KEY;
const finnhubClient = new finnhub.DefaultApi();

// 💰 CoinMarketCap setup
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY;
const CRYPTO_API_URL = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest';

// 📊 Get stock quote
app.get('/stock/:symbol', (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  finnhubClient.quote(symbol, (error, data) => {
    if (error || !data) return res.status(500).json({ error: 'Stock fetch failed' });
    res.json(data);
  });
});

// 🏢 Get stock metadata
app.get('/stock/info/:symbol', (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  finnhubClient.companyProfile2({ symbol }, (error, data) => {
    if (error || !data?.name) return res.status(500).json({ error: 'Company fetch failed' });
    res.json({ name: data.name, symbol: data.ticker });
  });
});

// 🪙 Get crypto quote
app.get('/crypto/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const response = await axios.get(CRYPTO_API_URL, {
      headers: { 'X-CMC_PRO_API_KEY': COINMARKETCAP_API_KEY },
      params: { symbol, convert: 'USD' }
    });
    res.json(response.data.data[symbol]);
  } catch {
    res.status(500).json({ error: 'Crypto fetch failed' });
  }
});

// ➕ Add item to dashboard
app.post('/dashboard/add', (req, res) => {
  const { type, symbol } = req.body;
  if (!type || !symbol) return res.status(400).json({ error: 'Invalid data' });

  const exists = dashboardData.some(item => item.symbol === symbol && item.type === type);
  if (!exists) dashboardData.push({ type, symbol });

  res.json({ message: 'Added to dashboard' });
});

// 📥 Get dashboard items with prices
app.get('/dashboard', async (req, res) => {
  const result = [];

  for (const item of dashboardData) {
    try {
      const price = item.type === 'stock'
        ? await fetchStockPrice(item.symbol)
        : await fetchCryptoPrice(item.symbol);
      result.push({ ...item, price: price.toFixed(2) });
    } catch {
      result.push({ ...item, price: 'Error' });
    }
  }

  res.json(result);
});

// 🔧 Helper: stock price
async function fetchStockPrice(symbol) {
  return new Promise((resolve, reject) => {
    finnhubClient.quote(symbol, (error, data) => {
      if (error || !data?.c) reject('Stock fetch error');
      else resolve(data.c);
    });
  });
}

// 🔧 Helper: crypto price
async function fetchCryptoPrice(symbol) {
  try {
    const response = await axios.get(CRYPTO_API_URL, {
      headers: { 'X-CMC_PRO_API_KEY': COINMARKETCAP_API_KEY },
      params: { symbol, convert: 'USD' }
    });
    return response.data.data[symbol].quote.USD.price;
  } catch {
    throw new Error('Crypto fetch error');
  }
}

// 🚀 Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
