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

// 🔹 In-memory dashboard data (resets when server restarts)
let dashboardData = [];

app.use(cors());
app.use(express.json());

// ✅ Redirect to login.html by default
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ✅ Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// 🔐 Session setup
app.use(session({
  secret: 'mysecretkey',
  resave: false,
  saveUninitialized: false
}));

// 🔐 Passport setup
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
    res.redirect('/index.html'); // ✅ Redirect to index.html after login
  }
);

app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

// 🔒 Middleware to protect routes
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login.html');
}

// ✅ Optional: protect dashboard.html
app.get('/dashboard.html', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// 🧠 In-memory dashboard routes
app.post('/dashboard/add', (req, res) => {
  const { type, symbol } = req.body;
  if (!type || !symbol) return res.status(400).json({ error: 'Invalid data' });

  if (!dashboardData.some(item => item.symbol === symbol && item.type === type)) {
    dashboardData.push({ type, symbol });
  }

  res.json({ message: 'Added to dashboard' });
});

app.get('/dashboard', async (req, res) => {
  const updatedData = [];

  for (let item of dashboardData) {
    try {
      let price;
      if (item.type === 'stock') {
        const stock = await fetchStockPrice(item.symbol);
        price = stock ? stock.toFixed(2) : "N/A";
      } else {
        const crypto = await fetchCryptoPrice(item.symbol);
        price = crypto ? crypto.toFixed(2) : "N/A";
      }
      updatedData.push({ ...item, price });
    } catch {
      updatedData.push({ ...item, price: "Error" });
    }
  }

  res.json(updatedData);
});

// ✅ Finnhub and CoinMarketCap APIs
const api_key = finnhub.ApiClient.instance.authentications['api_key'];
api_key.apiKey = process.env.API_KEY;
const finnhubClient = new finnhub.DefaultApi();
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY;
const CRYPTO_API_URL = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest';

app.get('/stock/:symbol', (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  finnhubClient.quote(symbol, (error, data) => {
    if (error || !data) return res.status(500).json({ error: 'Stock fetch failed' });
    res.json(data);
  });
});

app.get('/stock/info/:symbol', (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  finnhubClient.companyProfile2({ symbol }, (error, data) => {
    if (error || !data?.name) return res.status(500).json({ error: 'Company name fetch failed' });
    res.json({ name: data.name, symbol: data.ticker });
  });
});

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

// 🔧 Price fetch helpers
async function fetchStockPrice(symbol) {
  return new Promise((resolve, reject) => {
    finnhubClient.quote(symbol, (err, data) => {
      if (err || !data?.c) return reject();
      resolve(data.c);
    });
  });
}

async function fetchCryptoPrice(symbol) {
  try {
    const response = await axios.get(CRYPTO_API_URL, {
      headers: { 'X-CMC_PRO_API_KEY': COINMARKETCAP_API_KEY },
      params: { symbol, convert: 'USD' }
    });
    return response.data.data[symbol].quote.USD.price;
  } catch {
    return null;
  }
}

// ✅ Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
