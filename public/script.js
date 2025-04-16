function goHome() {
    window.location.href = "index.html";
}

async function addToDashboard(type) {
    let symbol = type === 'stock' ? document.getElementById('stockSymbol').value.toUpperCase() :
        document.getElementById('cryptoSymbol').value.toUpperCase();

    if (!symbol) {
        alert("Please search for a valid stock/crypto before adding to the dashboard!");
        return;
    }

    // Send to server
    await fetch('/dashboard/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, symbol })
    });

    window.location.href = "dashboard.html";
}

async function loadDashboard() {
    let response = await fetch('/dashboard');
    let dashboardItems = await response.json();
  
    if (dashboardItems.length === 0) {
      document.getElementById('dashboardContent').innerHTML = "<p>No items added to the dashboard yet.</p>";
      return;
    }
  
    let content = `<h3>Added to Dashboard</h3><table>`;
    content += "<tr><th>Type</th><th>Symbol</th><th>Price</th><th>Action</th></tr>";
  
    dashboardItems.forEach(item => {
      content += `<tr>
        <td>${item.type}</td>
        <td>${item.symbol}</td>
        <td>${item.price}</td>
        <td><button onclick="removeFromDashboard('${item.type}', '${item.symbol}')">Remove</button></td>
      </tr>`;
    });
  
    content += "</table>";
    document.getElementById('dashboardContent').innerHTML = content;
  }

  async function removeFromDashboard(type, symbol) {
    await fetch('/dashboard/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, symbol })
    });
  
    loadDashboard(); // Refresh
  }
  

async function fetchPrice(type, symbol) {
    if (type === 'stock') {
        let response = await fetch(`/stock/${symbol}`);
        let data = await response.json();
        return data.c ? data.c.toFixed(2) : null;
    } else {
        let response = await fetch(`/crypto/${symbol}`);
        let data = await response.json();
        return data.quote && data.quote.USD.price ? data.quote.USD.price.toFixed(2) : null;
    }
}


function fetchStockPrice() {
    const symbol = document.getElementById('stockSymbol').value.toUpperCase();
    if (!symbol) {
        document.getElementById('stockOutput').innerHTML = "<p style='color: red;'>Enter a stock symbol!</p>";
        return;
    }

    fetch(`/stock/info/${symbol}`)
        .then(response => response.json())
        .then(nameData => {
            if (nameData.error) throw new Error("Stock name not found");

            return fetch(`/stock/${symbol}`)
                .then(response => response.json())
                .then(priceData => {
                    if (!priceData.o) throw new Error("Stock price data not available");

                    document.getElementById('stockOutput').innerHTML = `
                        <h3>Stock Data for ${nameData.name} (${symbol})</h3>
                        <table>
                            <tr><th>Open</th><td>${priceData.o}</td></tr>
                            <tr><th>High</th><td>${priceData.h}</td></tr>
                            <tr><th>Low</th><td>${priceData.l}</td></tr>
                            <tr><th>Current</th><td>${priceData.c}</td></tr>
                            <tr><th>Previous Close</th><td>${priceData.pc}</td></tr>
                            <tr><th>Change</th><td>${priceData.d}</td></tr>
                            <tr><th>Percentage Change</th><td>${priceData.dp}%</td></tr>
                        </table>
                    `;

                    document.getElementById('addStockButton').style.display = "block";
                    document.getElementById('aiAssistantStock').style.display = "block";

                });
        })
        .catch(error => console.error('Error fetching stock data:', error));
}
function goToAI(type) {
    const symbol = type === 'stock'
        ? document.getElementById('stockSymbol').value.toUpperCase()
        : document.getElementById('cryptoSymbol').value.toUpperCase();

    
    const baseUrl = "https://huggingface.co/spaces/JishnuD/stockapp"; 

        window.open(`${baseUrl}?symbol=${symbol}&type=${type}`, '_blank');
}


function fetchCryptoPrice() {
    const symbol = document.getElementById('cryptoSymbol').value.toUpperCase();
    if (!symbol) {
        document.getElementById('cryptoOutput').innerHTML = "<p style='color: red;'>Enter a crypto symbol!</p>";
        return;
    }

    fetch(`/crypto/${symbol}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('cryptoOutput').innerHTML = `
                <h3>Crypto Data for ${data.name} (${data.symbol})</h3>
                <table>
                    <tr><th>Price</th><td>$${data.quote.USD.price.toFixed(2)}</td></tr>
                    <tr><th>24h Change</th><td>${data.quote.USD.percent_change_24h.toFixed(2)}%</td></tr>
                    <tr><th>Market Cap</th><td>$${data.quote.USD.market_cap.toLocaleString()}</td></tr>
                </table>
            `;

            document.getElementById('addCryptoButton').style.display = "block";
            document.getElementById('aiAssistantCrypto').style.display = "block";

        })
        .catch(error => console.error('Error fetching crypto data:', error));
}


