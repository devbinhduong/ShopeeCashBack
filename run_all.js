require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function runMasterIntegration() {
    console.log("=========================================");
    console.log("🚀 Step 1: Fetching products from linhkaadz API...");
    console.log("=========================================");

    // 1. Fetch ALL products from linhkaadz API (handles pagination)
    let allApiProducts = [];
    let page = 1;
    const limit = 20;

    while (true) {
        const url = `https://linhkaadz.com/api/aff-shopee/products?page=${page}&limit=${limit}`;
        console.log(`  -> Fetching page ${page}: ${url}`);
        
        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            if (!res.ok) {
                console.error(`  -> API error: ${res.status}`);
                break;
            }
            const json = await res.json();
            const items = json.data || [];
            allApiProducts.push(...items);
            console.log(`  -> Got ${items.length} products. Total so far: ${allApiProducts.length}`);
            
            if (!json.hasMore || items.length === 0) {
                break; // No more pages
            }
            page++;
        } catch (err) {
            console.error(`  -> Failed to fetch page ${page}:`, err.message);
            break;
        }
        
        // Small delay between pages
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`\n✅ Total products fetched: ${allApiProducts.length}`);

    if (allApiProducts.length === 0) {
        console.error("❌ No products fetched. Aborting.");
        return;
    }

    console.log("\n=========================================");
    console.log("🔄 Step 2: Converting Shopee links to AccessTrade affiliate links...");
    console.log("=========================================\n");

    // Common User-Agent
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    let processedCount = 0;
    const products = [];

    for (let i = 0; i < allApiProducts.length; i++) {
        const item = allApiProducts[i];
        const shortLink = item.link; // e.g. https://s.shopee.vn/...
        
        // Build product with data from API
        const product = {
            "Product Name": item.title || 'Sản phẩm',
            "Current Price": item.price ? `${Number(item.price).toLocaleString('vi-VN')} ₫` : 'Liên hệ',
            "Original Price": item.original_price ? `${Number(item.original_price).toLocaleString('vi-VN')} ₫` : '',
            "Percent Badge": item.percent || '',
            "Amount Info": item.amount ? `Số lượng: ${item.amount}` : '',
            "Image": item.img || '',
            "Original Link": shortLink || 'No Link',
            "Affiliate Link": "No Link",
            "Scraping Time": item.time ? `${item.time} | Sắp diễn ra` : ''
        };

        if (shortLink && shortLink !== 'No Link') {
            console.log(`[${i + 1}/${allApiProducts.length}] 🔗 Processing: ${shortLink}`);

            try {
                // Step 1: Expand short link to real Shopee URL
                const expandRes = await fetch(shortLink, {
                    method: 'GET',
                    redirect: 'follow',
                    headers
                });
                const finalUrl = expandRes.url;

                // Step 2: Clean URL
                let cleanLink = finalUrl;
                try {
                    const regex1 = /-i\.(\d+)\.(\d+)/;
                    const regex2 = /\/product\/(\d+)\/(\d+)/;
                    const regex3 = /\/(\d+)\/(\d+)/; // opaanlp/shopId/itemId
                    if (finalUrl.match(regex1)) {
                        const [, shopId, itemId] = finalUrl.match(regex1);
                        cleanLink = `https://shopee.vn/product/${shopId}/${itemId}`;
                    } else if (finalUrl.match(regex2)) {
                        const [, shopId, itemId] = finalUrl.match(regex2);
                        cleanLink = `https://shopee.vn/product/${shopId}/${itemId}`;
                    } else if (finalUrl.match(regex3)) {
                        const [, shopId, itemId] = finalUrl.match(regex3);
                        cleanLink = `https://shopee.vn/product/${shopId}/${itemId}`;
                    } else {
                        const urlObj = new URL(finalUrl);
                        cleanLink = urlObj.origin + urlObj.pathname;
                    }
                } catch (err) {}

                console.log(`   -> Clean: ${cleanLink}`);

                // Step 3: Convert to AccessTrade affiliate via Vercel API
                const atRes = await fetch('https://shopee-cash-back.vercel.app/api/generate-link', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: cleanLink })
                });

                if (atRes.ok) {
                    const data = await atRes.json();
                    if (data.link) {
                        product["Affiliate Link"] = data.link;
                        processedCount++;
                        console.log(`   ✅ Affiliate: ${data.link}`);
                    } else {
                        console.warn(`   ⚠️  No link in response: ${JSON.stringify(data)}`);
                    }
                } else {
                    const text = await atRes.text();
                    console.error(`   ❌ API Error: ${text}`);
                }
            } catch (err) {
                console.error(`   ❌ Failed: ${err.message}`);
            }

            // Wait 200ms between requests
            await new Promise(resolve => setTimeout(resolve, 200));
        } else {
            console.log(`[${i + 1}/${allApiProducts.length}] ➖ No link for: ${product["Product Name"].substring(0, 40)}`);
        }

        products.push(product);
    }

    console.log("\n=========================================");
    console.log("💾 Step 3: Saving Data");
    console.log("=========================================");

    const outputPath = path.join(__dirname, 'products_data.json');
    fs.writeFileSync(outputPath, JSON.stringify(products, null, 4), 'utf-8');

    console.log(`🎉 Done! Fetched ${allApiProducts.length} products, converted ${processedCount} affiliate links.`);
    console.log(`📁 Saved to: ${outputPath}`);
    console.log(`\n➡️  Next: git add products_data.json && git commit -m "update products" && git push`);
}

runMasterIntegration();
