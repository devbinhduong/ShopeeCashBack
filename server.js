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

    const apiEndpoint = 'https://api.accesstrade.vn/v1/product_link/create';
    
    try {
        // We use native fetch available in Node.js 18+
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${process.env.ACCESS_KEY}`
            },
            body: JSON.stringify({
                campaign_id: process.env.CAMPAIGN_ID,
                urls: [url]
            })
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
