require('dotenv').config();
const express = require('express');
const finnhub = require('finnhub');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public'))); // Serve frontend
app.use(express.json()); // Allows JSON body parsing

const api_key = finnhub.ApiClient.instance.authentications['api_key'];
api_key.apiKey = process.env.API_KEY;
const finnhubClient = new finnhub.DefaultApi();

const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY;
const CRYPTO_API_URL = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest';

// 🔹 Temporary In-Memory Dashboard Storage (Resets on Server Restart)
let dashboardData = [];

// 📌 Fetch Stock Prices (returns current price)
app.get('/stock/:symbol', (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    
    finnhubClient.quote(symbol, (error, data) => {
        if (error || !data || !data.c) {
            return res.status(500).json({ error: 'Stock price data fetch error' });
        }
        res.json(data);
    });
});

// 📌 Fetch Stock Metadata (Company Name)
app.get('/stock/info/:symbol', (req, res) => {
    const symbol = req.params.symbol.toUpperCase();

    finnhubClient.companyProfile2({ symbol }, (error, data) => {
        if (error || !data || !data.name) {
            return res.status(500).json({ error: 'Stock name fetch error' });
        }
        res.json({ name: data.name, symbol: data.ticker });
    });
});

// 📌 Fetch Crypto Prices (returns current price)
app.get('/crypto/:symbol', async (req, res) => {
    try {
        const symbol = req.params.symbol.toUpperCase();
        const response = await axios.get(CRYPTO_API_URL, {
            headers: { 'X-CMC_PRO_API_KEY': COINMARKETCAP_API_KEY },
            params: { symbol, convert: 'USD' }
        });

        res.json(response.data.data[symbol]);
    } catch (error) {
        res.status(500).json({ error: 'Crypto data fetch error' });
    }
});

// 📌 API to Add Items to Dashboard (Server Memory)
app.post('/dashboard/add', (req, res) => {
    const { type, symbol } = req.body;
    if (!type || !symbol) {
        return res.status(400).json({ error: "Invalid data" });
    }

    // Avoid duplicates
    if (!dashboardData.some(item => item.symbol === symbol && item.type === type)) {
        dashboardData.push({ type, symbol });
    }

    res.json({ message: "Added to dashboard" });
});

// 📌 API to Fetch Dashboard Data (Resets When Server Restarts)
app.get('/dashboard', async (req, res) => {
    let updatedDashboard = [];

    for (let item of dashboardData) {
        try {
            let price;
            if (item.type === 'stock') {
                const response = await fetchStockPrice(item.symbol);
                price = response ? response.toFixed(2) : "N/A";
            } else {
                const response = await fetchCryptoPrice(item.symbol);
                price = response ? response.toFixed(2) : "N/A";
            }

            updatedDashboard.push({
                type: item.type,
                symbol: item.symbol,
                price
            });
        } catch (error) {
            updatedDashboard.push({
                type: item.type,
                symbol: item.symbol,
                price: "Error fetching price"
            });
        }
    }

    res.json(updatedDashboard);
});

// 📌 Helper Functions for Stock & Crypto Prices
async function fetchStockPrice(symbol) {
    return new Promise((resolve, reject) => {
        finnhubClient.quote(symbol, (error, data) => {
            if (error || !data || !data.c) reject("Stock fetch error");
            else resolve(data.c);
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
    } catch (error) {
        return null;
    }
}

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
