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

            // 2.5 Extract Meta Tags natively
            let defaultImage = "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/assets/caeb6ba473e65870.png";
            try {
                // Fetch the cleanLink page to parse the HTML Title and OG:Image
                // We use a Facebook Crawler user-agent because Shopee eagerly pre-renders OG tags for it!
                const htmlResponse = await fetch(cleanLink, {
                    headers: { 'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' }
                });
                const html = await htmlResponse.text();
                
                // Extract Title
                const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
                if (titleMatch && titleMatch[1]) {
                    const fullTitle = titleMatch[1];
                    const cleanedTitle = fullTitle.replace(/\s*\|\s*Shopee[^]*$/i, '').trim();
                    if (cleanedTitle && cleanedTitle !== 'Shopee Việt Nam') {
                        originalName = cleanedTitle;
                    }
                }

                // Extract Image
                const imgMatch = html.match(/<meta[^>]*?property=["']og:image["'][^>]*?content=["']([^"']+)["']/i) || 
                                 html.match(/<meta[^>]*?content=["']([^"']+)["'][^>]*?property=["']og:image["']/i) ||
                                 html.match(/<meta[^>]*?name=["']twitter:image["'][^>]*?content=["']([^"']+)["']/i);
                if (imgMatch && imgMatch[1]) {
                    defaultImage = imgMatch[1];
                }
            } catch (err) {
                console.warn("  -> Warning fetching HTML for meta tags:", err.message);
            }

            // 3. Affiliate Conversion: Same logic as your backend
            let affiliateLink = cleanLink; // Fallback
            const apiEndpoint = 'https://api.accesstrade.vn/v1/product_link/create';
            
            const atResponse = await fetch(apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${process.env.ACCESS_KEY}`
                },
                body: JSON.stringify({
                    campaign_id: process.env.CAMPAIGN_ID,
                    urls: [cleanLink]
                })
            });

            if (atResponse.ok) {
                const data = await atResponse.json();
                
                // Accesstrade response mapping logic (from server.js)
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
            } else {
                console.error(`  -> Failed to generate AT link! Status: ${atResponse.status}`);
            }

            // 4. Data Storage Structure: Match exactly what was requested for the DOM (Plus fallback compat fields)
            results.push({
                original_name: originalName,
                clean_link: cleanLink,
                my_affiliate_link: affiliateLink,
                original_short_link: shortLink,
                
                // Include these so older UI rendering code doesn't entirely break if used
                "Product Name": originalName,
                "Image": defaultImage,
                "Current Price": "Liên hệ",
                "Original Price": "",
                "Discount": "",
                "Affiliate Link": affiliateLink
            });

        } catch (error) {
            console.error(`  -> Error processing ${shortLink}:`, error.message);
            
            // Push an error object to strictly maintain array indexes!
            results.push({
                original_name: 'Error Processing Link',
                clean_link: 'Error',
                my_affiliate_link: shortLink,
                original_short_link: shortLink
            });
        }
        
        // Wait 300ms between requests to avoid IP bans / API rate limits from Shopee or Accesstrade
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log("\nFinished processing all links.");

    // 5. Output exactly to products_data.json properly in order
    const outputPath = path.join(__dirname, 'products_data.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 4), 'utf-8');
    
    console.log(`Saved ${results.length} mapped items to ${outputPath}`);
}

processShortLinks();
