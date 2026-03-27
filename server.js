require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// Serve static files (HTML, CSS, JS) from the current directory
app.use(express.static(__dirname));

app.post('/api/generate-link', async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    let cleanLink = url;
    
    try {
        // Simple User-Agent to prevent 403 on redirects
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };

        // 1. Expand the URL to follow redirects (e.g., shp.ee -> shopee.vn)
        const expandRes = await fetch(url, { method: 'GET', redirect: 'follow', headers });
        const finalUrl = expandRes.url;
        
        // 2. Clean URL to just domain and base path or product ids
        const urlObj = new URL(finalUrl);
        const regex1 = /-i\.(\d+)\.(\d+)/;
        const regex2 = /\/product\/(\d+)\/(\d+)/;
        
        if (finalUrl.match(regex1)) {
            const [, shopId, itemId] = finalUrl.match(regex1);
            cleanLink = `https://shopee.vn/product/${shopId}/${itemId}`;
        } else if (finalUrl.match(regex2)) {
            const [, shopId, itemId] = finalUrl.match(regex2);
            cleanLink = `https://shopee.vn/product/${shopId}/${itemId}`;
        } else {
            cleanLink = urlObj.origin + urlObj.pathname;
        }
    } catch (e) {
        console.warn("Could not pre-process URL, using original:", e.message);
    }

    let apiEndpoint = 'https://api.accesstrade.vn/v1/product_link/create';
    let bodyData = {
        campaign_id: process.env.CAMPAIGN_ID,
        urls: [cleanLink]
    };
    
    if (cleanLink.includes('tiktok.com')) {
        apiEndpoint = 'https://api.accesstrade.vn/v2/tiktokshop_product_feeds/create_link';
        bodyData = {
            product_url: cleanLink
            // AccessTrade TikTok API v2 doesn't require campaign_id in body for feeds link
        };
    }
    
    try {
        // We use native fetch available in Node.js 18+
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${process.env.ACCESS_KEY}`
            },
            body: JSON.stringify(bodyData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        
        let affiliateLink = null;
        
        if (data.data && data.data.success_link && Array.isArray(data.data.success_link) && data.data.success_link.length > 0) {
            const linkObj = data.data.success_link[0];
            affiliateLink = linkObj.short_link || linkObj.aff_link || linkObj.url;
        } else if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            const linkObj = data.data[0];
            affiliateLink = linkObj.short_link || linkObj.product_link || linkObj.url;
        } else if (data.short_link) {
            affiliateLink = data.short_link;
        } else if (data.product_link) {
            affiliateLink = data.product_link;
        } else if (data.url) {
            affiliateLink = data.url;
        } else if (Array.isArray(data) && data.length > 0) {
            affiliateLink = data[0].short_link || data[0].product_link || data[0].url;
        }

        if (affiliateLink) {
            res.json({ link: affiliateLink });
        } else {
            res.status(500).json({ error: 'Could not find the generated link in the API response.' });
        }
    } catch (error) {
        console.error("Link generation failed:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
