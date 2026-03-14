const { chromium } = require('playwright');
const { generateAffiliateLink } = require('./accesstrade');

async function scrapeDeals() {
    let browser;
    try {
        browser = await chromium.launch();
        const page = await browser.newPage();
        
        console.log("Navigating to linhkaadz.com...");
        await page.goto('https://linhkaadz.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Extract raw deals using user's selectors
        const deals = await page.$$eval('.product-item', elements => {
            return elements.map(el => {
                const titleEl = el.querySelector('.title') || el.querySelector('h3');
                const linkEl = el.querySelector('a');
                const priceEl = el.querySelector('.price');
                const imgEl = el.querySelector('img');

                return {
                    title: titleEl ? titleEl.innerText.trim() : 'Unknown Product',
                    link: linkEl ? linkEl.href : null,
                    price: priceEl ? priceEl.innerText.trim() : 'Contact for price',
                    image: imgEl ? imgEl.src : ''
                };
            }).filter(deal => deal.link);
        });

        console.log(`Scraped ${deals.length} deals. Processing affiliate links...`);
        
        const affiliateDeals = [];
        // Limit to 12 deals to prevent timeouts and rate limiting
        const dealsToProcess = deals.slice(0, 12);
        
        for (const deal of dealsToProcess) {
            try {
                // Wait briefly to avoid hitting the API too fast
                await new Promise(r => setTimeout(r, 500));
                
                const affiliateLink = await generateAffiliateLink(deal.link);
                affiliateDeals.push({
                    ...deal,
                    affiliateLink
                });
            } catch (err) {
                console.error(`Failed to generate link for ${deal.title}:`, err.message);
                affiliateDeals.push({
                    ...deal,
                    affiliateLink: deal.link // Fallback to original
                });
            }
        }

        return affiliateDeals;
    } catch (error) {
        console.error("Scraping failed:", error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

module.exports = { scrapeDeals };
