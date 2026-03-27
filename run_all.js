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

    // 3. Process the Links Array completely sequentially without modifying ANY other keys
    for (let i = 0; i < products.length; i++) {
        const product = products[i];
        
        let affiliateLink = "No Link";
        
        // If Python already mapped a link OR we have it mapped via short links arrays 
        // (Assuming the user intends mapping order from short_links.json to the UI products)
        let shortLinks = [];
        try {
            shortLinks = require('./short_links.json');
        } catch(e) {}

        const shortLink = shortLinks[i]; 
        
        // 4. Follow redirects if the index matches a provided shortlink
        if (shortLink) {
            console.log(`[${i + 1}/${products.length}] 🔗 Processing Shortlink: ${shortLink}`);
            
            try {
                // Expanding URL
                const response = await fetch(shortLink, { 
                    method: 'GET', 
                    redirect: 'follow',
                    headers 
                });
                const finalUrl = response.url;
                
                // Link Cleaning Structure
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

                // Affiliate Conversion
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
                    if (data.data && data.data.success_link && Array.isArray(data.data.success_link) && data.data.success_link.length > 0) {
                        affiliateLink = data.data.success_link[0].short_link || data.data.success_link[0].aff_link || data.data.success_link[0].url;
                    } else if (data.data && Array.isArray(data.data) && data.data.length > 0) {
                        affiliateLink = data.data[0].short_link || data.data[0].product_link || data.data[0].url;
                    } else if (data.short_link) affiliateLink = data.short_link;
                    else if (data.product_link) affiliateLink = data.product_link;
                    else if (data.url) affiliateLink = data.url;
                    else if (Array.isArray(data) && data.length > 0) {
                        affiliateLink = data[0].short_link || data[0].product_link || data[0].url;
                    }
                }
                
                processedCount++;
                console.log(`   ✅ Merged Affiliate Link: ${affiliateLink}`);
            } catch (err) {
                console.error(`   ❌ Failed processing shortlink: ${err.message}`);
            }
            // Wait 300ms 
            await new Promise(resolve => setTimeout(resolve, 300));
        } else {
            console.log(`[${i + 1}/${products.length}] ➖ No Shortlink mapped for ${product["Product Name"]}, keeping existing fields.`);
            affiliateLink = product["Affiliate Link"]; // Retain Python logic completely if none mapped
        }

        // Only explicitly overwrite the 'Affiliate Link' object string.
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
