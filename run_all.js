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

    // 3. Process the Links strictly from the product payload to prevent misalignment
    for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const targetLink = product["Original Link"];
        
        let affiliateLink = targetLink || "No Link";
        
        // Only convert valid links
        if (targetLink && targetLink !== "No Link" && targetLink !== "Pending") {
            console.log(`[${i + 1}/${products.length}] 🔗 Converting Link: ${targetLink}`);
            
            try {
                // Hand off to our ultra-fast Vercel Backend that handles expansion & AT logic!
                const apiEndpoint = 'https://shopee-cash-back.vercel.app/api/generate-link';
                const response = await fetch(apiEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: targetLink })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.link) {
                        affiliateLink = data.link;
                        processedCount++;
                        console.log(`   ✅ Merged Affiliate Link: ${affiliateLink}`);
                    }
                } else {
                    const text = await response.text();
                    console.error(`   ❌ Vercel API Error: ${text}`);
                }
            } catch (err) {
                console.error(`   ❌ Failed processing shortlink: ${err.message}`);
            }
            
            // Wait 200ms to avoid AccessTrade rate limits
            await new Promise(resolve => setTimeout(resolve, 200));
        } else {
            console.log(`[${i + 1}/${products.length}] ➖ Skip: No link to convert for ${product["Product Name"]}`);
            affiliateLink = "No Link";
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
