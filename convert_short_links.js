require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function processShortLinks() {
    console.log("Loading short links...");
    const shortLinksPath = path.join(__dirname, 'short_links.json');
    
    let shortLinks = [];
    try {
        shortLinks = require('./short_links.json');
    } catch (e) {
        console.error("Could not read short_links.json. Make sure the file exists.");
        return;
    }

    const results = [];
    console.log(`Processing ${shortLinks.length} links...\n`);

    // Common User-Agent to bypass basic blocks
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    // Use for...of to process sequentially and maintain exact order
    for (let i = 0; i < shortLinks.length; i++) {
        const shortLink = shortLinks[i];
        console.log(`[${i + 1}/${shortLinks.length}] Processing: ${shortLink}`);
        
        try {
            // 1. URL Expansion: Follow redirects to get the original Shopee product page
            // We use GET instead of HEAD because Shopee sometimes redirects via JS or blocks HEAD
            const response = await fetch(shortLink, { 
                method: 'GET', 
                redirect: 'follow',
                headers 
            });
            
            const finalUrl = response.url;
            console.log(`  -> Redirected to: ${finalUrl.substring(0, 80)}...`);

            // 2. Link Cleaning: Extract shopid & itemid to build https://shopee.vn/product/{shopid}/{itemid}
            let cleanLink = finalUrl;
            let originalName = 'Unknown Product';
            
            try {
                const urlObj = new URL(finalUrl);
                
                // Extract Product Name from the pathname components (e.g., /San-Pham-Hay-i.1234.5678)
                if (urlObj.pathname.length > 1) {
                    const pathParts = urlObj.pathname.split('/');
                    if (pathParts[1] && pathParts[1] !== 'product') {
                        const rawName = decodeURIComponent(pathParts[1]);
                        // Remove the Shopee ID suffix (-i.123.456) and replace hyphens with spaces
                        originalName = rawName.replace(/-i\.(\d+)\.(\d+).*$/, '').replace(/-/g, ' ');
                    }
                }

                // Detect exact Shop ID and Item ID for perfectly clean link structure
                const regex1 = /-i\.(\d+)\.(\d+)/; // Matches format: shopee.vn/product-name-i.123.456
                const regex2 = /\/product\/(\d+)\/(\d+)/; // Matches format: shopee.vn/product/123/456
                
                let shopId, itemId;
                
                if (finalUrl.match(regex1)) {
                    [, shopId, itemId] = finalUrl.match(regex1);
                } else if (finalUrl.match(regex2)) {
                    [, shopId, itemId] = finalUrl.match(regex2);
                }

                if (shopId && itemId) {
                    cleanLink = `https://shopee.vn/product/${shopId}/${itemId}`;
                } else {
                    // Fallback to purely stripping the query strings
                    cleanLink = urlObj.origin + urlObj.pathname;
                }
            } catch (err) {
                console.warn("  -> Warning parsing URL domain, using original:", err.message);
            }

            console.log(`  -> Cleaned Link: ${cleanLink}`);

            // 2.5 Use a placeholder image — real images come from scraper.py
            const defaultImage = "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/assets/caeb6ba473e65870.png";

            // 3. Affiliate Conversion via Vercel API
            let affiliateLink = cleanLink; // Fallback
            
            const atResponse = await fetch('https://shopee-cash-back.vercel.app/api/generate-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: cleanLink })
            });

            if (atResponse.ok) {
                const data = await atResponse.json();
                if (data.link) {
                    affiliateLink = data.link;
                    console.log(`  -> Affiliate Link: ${affiliateLink}`);
                } else {
                    console.warn(`  -> No link in response: ${JSON.stringify(data)}`);
                }
            } else {
                console.error(`  -> Failed to generate AT link! Status: ${atResponse.status}`);
            }

            // 4. Get today's date for Scraping Time field
            const now = new Date();
            const dd = String(now.getDate()).padStart(2, '0');
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const scrapingTime = `${dd}-${mm} | Khung: Flash Sale`;

            // 5. Data Storage Structure matching frontend expectations
            results.push({
                "Product Name": originalName,
                "Current Price": "Flash Sale",
                "Original Price": "",
                "Percent Badge": "",
                "Amount Info": "",
                "Image": defaultImage,
                "Original Link": cleanLink,
                "Affiliate Link": affiliateLink,
                "Scraping Time": scrapingTime
            });

        } catch (error) {
            console.error(`  -> Error processing ${shortLink}:`, error.message);
            
            // Push an error object to strictly maintain array indexes!
            results.push({
                "Product Name": 'Error Processing Link',
                "Current Price": "",
                "Original Price": "",
                "Percent Badge": "",
                "Amount Info": "",
                "Image": "",
                "Original Link": shortLink,
                "Affiliate Link": shortLink,
                "Scraping Time": ""
            });
        }
        
        // Wait 300ms between requests to avoid IP bans / API rate limits from Shopee or Accesstrade
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log("\nFinished processing all links.");

    // 6. Output exactly to products_data.json properly in order
    const outputPath = path.join(__dirname, 'products_data.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 4), 'utf-8');
    
    console.log(`Saved ${results.length} mapped items to ${outputPath}`);
}

processShortLinks();
