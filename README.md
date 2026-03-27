# Shopee Cashback & Affiliate Link Generator

This repository contains a full suite of tools to generate Shopee affiliate links (via AccessTrade) and scrape products from other sites to create an affiliate product feed.

## Prerequisites

1. **Node.js**: Ensure Node.js is installed (v18+ recommended due to native `fetch`).
2. **Python**: Ensure Python 3 is installed.
3. **Environment Variables**: Create or update the `.env` file in the root directory with your AccessTrade credentials:
   ```env
   ACCESS_KEY=your_accesstrade_token_here
   CAMPAIGN_ID=your_campaign_id_here
   PORT=3000
   ```
4. **Install Dependencies**:
   - Run `npm install` to install Node.js dependencies (`express`, `cors`, `dotenv`, `playwright`).
   - Run `pip install -r requirements.txt` to install Python dependencies.
   - Run `playwright install chromium` to install the browser used by the Python scraper.

---

## 🚀 How to Run the Code

There are three main ways to use this repository depending on what you want to achieve:

### 1. Run the Local Web Server

To run the web interface for generating individual Shopee affiliate links:

```bash
node server.js
# or
npm start
```
- This will start a local Express server on `http://localhost:3000`. 
- Open `http://localhost:3000` (or `index.html`) in your browser to use the tool. It allows you to paste a Shopee link and returns an affiliate link via the AccessTrade API.
- *Note: On the frontend (`script.js`), it currently sends requests to `https://shopeecashback.onrender.com/api/generate-link`. If you want it to use your local server, change the `apiEndpoint` in `script.js` to `http://localhost:3000/api/generate-link`.*

### 2. Run the Full Automation Workflow (Scrape + Convert)

If you want to scrape products from `linhkaadz.com` and automatically update your `products_data.json` file with new affiliate links:

```bash
node run_all.js
```
- **Step 1:** It executes the Python script (`scraper.py`) to scrape products from `linhkaadz.com`.
- **Step 2:** It reads the newly generated `products_data.json`.
- **Step 3:** If `short_links.json` exists and matches the products, it expands those short links, cleans them, and generates fresh AccessTrade affiliate links.
- **Step 4:** It overwrites `products_data.json` with the updated JSON containing all your tracked affiliate products.

### 3. Convert Existing Short Links into Affiliate Links

If you have a list of short links in a `short_links.json` file and just want to convert them to `products_data.json` without scraping:

```bash
node convert_short_links.js
```
- It sequentially expands every short link found in `short_links.json`.
- It formats the Shopee URL safely and fetches the Meta Tags (Image, Title).
- It calls the AccessTrade API directly to convert them to affiliate links.
- Values are saved directly to `products_data.json` so the frontend can load them seamlessly.

---

## 🛠 File Overview

- **`server.js`**: Node.js API that serves the frontend and handles the `/api/generate-link` POST request to convert Shopee sizes into AccessTrade links.
- **`run_all.js`**: Master integration script combining the Python scraper with the Node.js link generation.
- **`convert_short_links.js`**: Standalone Node.js script to process links inside `short_links.json` and convert them individually.
- **`scraper.py`**: Python web scraper using Playwright and BeautifulSoup to extract products off a website.
- **`scraper.js`**: (Deprecated/Incomplete Node.js scraper) Similar to `scraper.py` but currently missing its internal module (`accesstrade.js`). Use `scraper.py` or `run_all.js` instead.
- **`script.js` / `index.html` / `style.css`**: Frontend client logic and UI interface. `script.js` fetches `products_data.json` to showcase a grid of your affiliate products.
