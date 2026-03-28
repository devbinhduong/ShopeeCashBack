require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function runMasterIntegration() {
    console.log("=========================================");
    console.log("🚀 Step 1: Running Python Web Scraper...");
    console.log("=========================================");
    
    // 1. Run Python Scraper synchronously to ensure products_data.json is freshly generated
    try {
        // We use "py" for Windows, fallback to "python" if needed depending on environment
        execSync("py scraper.py", { stdio: 'inherit', cwd: __dirname });
    } catch (err) {
        console.error("❌ Python scraper failed to execute. Did it crash?", err.message);
        return;
    }

    console.log("\n=========================================");
    console.log("🔄 Step 2: Merging Output & Converting Links");
    console.log("=========================================");

    const dataPath = path.join(__dirname, 'products_data.json');
    let products = [];
    
    // 2. Read the rich metadata generated completely by Python (.json)
    try {
        products = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } catch (e) {
        console.error("❌ Node Error: Could not read products_data.json directly after python script.");
        return;
    }

    console.log(`✅ Loaded ${products.length} products with complete layout metadata from Python.\n`);

    // Common User-Agent to bypass basic blocks
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
    
    let processedCount = 0;

    // 3. Process the Links strictly from short_links.json by array index
    let shortLinks = [];
    try {
        shortLinks = JSON.parse(fs.readFileSync(path.join(__dirname, 'short_links.json'), 'utf8'));
    } catch(e) {
        console.warn("⚠️  Could not read short_links.json, products will have no affiliate links.");
    }


    for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const shortLink = shortLinks[i];

        let affiliateLink = "No Link";

        if (shortLink) {
            console.log(`[${i + 1}/${products.length}] 🔗 Processing: ${shortLink}`);
            try {
                // Step 1: Expand the short link to get the real Shopee product URL
                const expandRes = await fetch(shortLink, {
                    method: 'GET',
                    redirect: 'follow',
                    headers
                });
                const finalUrl = expandRes.url;

                // Step 2: Clean the URL (extract shopId/itemId)
                let cleanLink = finalUrl;
                try {
                    const regex1 = /-i\.(\d+)\.(\d+)/;
                    const regex2 = /\/product\/(\d+)\/(\d+)/;
                    if (finalUrl.match(regex1)) {
                        const [, shopId, itemId] = finalUrl.match(regex1);
                        cleanLink = `https://shopee.vn/product/${shopId}/${itemId}`;
                    } else if (finalUrl.match(regex2)) {
                        const [, shopId, itemId] = finalUrl.match(regex2);
                        cleanLink = `https://shopee.vn/product/${shopId}/${itemId}`;
                    } else {
                        const urlObj = new URL(finalUrl);
                        cleanLink = urlObj.origin + urlObj.pathname;
                    }
                } catch (err) {}

                console.log(`   -> Clean: ${cleanLink}`);

                // Step 3: Convert to AccessTrade affiliate link via Vercel API
                const atRes = await fetch('https://shopee-cash-back.vercel.app/api/generate-link', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: cleanLink })
                });

                if (atRes.ok) {
                    const data = await atRes.json();
                    if (data.link) {
                        affiliateLink = data.link;
                        processedCount++;
                        console.log(`   ✅ Affiliate Link: ${affiliateLink}`);
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

            // Wait 200ms to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 200));
        } else {
            console.log(`[${i + 1}/${products.length}] ➖ No short link for index ${i} (${product["Product Name"]?.substring(0, 40)})`);
        }

        products[i]["Affiliate Link"] = affiliateLink;
    }

    console.log("\n=========================================");
    console.log("💾 Step 3: Saving Merged Data");
    console.log("=========================================");

    // Overwrite the original payload directly so frontend loads it perfectly natively
    fs.writeFileSync(dataPath, JSON.stringify(products, null, 4), 'utf-8');
    
    console.log(`🎉 Master Script Complete! Successfully merged ${processedCount} generated AccessTrade links onto the raw UI Payload.`);
}

runMasterIntegration();
