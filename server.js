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

// 📁 Middleware Setup
app.use(cors());
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  });
  
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.use(session({
  secret: 'mysecretkey',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// 🔐 Google OAuth Strategy
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

// 🌐 Serve login.html as the landing page instead of index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 🔐 Auth Routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login.html' }),
  (req, res) => {
    res.redirect('/index.html');
  }
);

app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/');
  });
});

// 🔐 Middleware to Protect Routes
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login.html');
}

// 🔒 Protected dashboard route
app.get('/dashboard.html', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// 📊 Finnhub Stock API Setup
const api_key = finnhub.ApiClient.instance.authentications['api_key'];
api_key.apiKey = process.env.API_KEY;
const finnhubClient = new finnhub.DefaultApi();

// 💱 CoinMarketCap API Setup
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY;
const CRYPTO_API_URL = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest';

// 📈 Stock Routes
app.get('/stock/:symbol', (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  finnhubClient.quote(symbol, (error, data) => {
    if (error || !data) return res.status(500).json({ error: 'Stock data fetch failed' });
    res.json(data);
  });
});

app.get('/stock/info/:symbol', (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  finnhubClient.companyProfile2({ symbol }, (error, data) => {
    if (error || !data || !data.name) return res.status(500).json({ error: 'Company profile fetch failed' });
    res.json({ name: data.name, symbol: data.ticker });
  });
});

// 🪙 Crypto Route
app.get('/crypto/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const response = await axios.get(CRYPTO_API_URL, {
      headers: { 'X-CMC_PRO_API_KEY': COINMARKETCAP_API_KEY },
      params: { symbol, convert: 'USD' }
    });
    res.json(response.data.data[symbol]);
  } catch (error) {
    res.status(500).json({ error: 'Crypto data fetch failed' });
  }
});

// ✅ Start the Server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
