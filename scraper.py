"""
Product Scraper with Affiliate Link Conversion
----------------------------------------------

Prerequisites to run this script:
1. Install the required Python libraries:
   pip install -r requirements.txt

2. Install the necessary browsers for Playwright:
   playwright install chromium
"""

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
import pandas as pd
import random
import time
import urllib.parse

class ProductScraper:
    def __init__(self, base_url, target_selector):
        """
        Initialize the scraper with a flexible URL and target element selector.
        
        :param base_url: The URL of the website to scrape.
        :param target_selector: The CSS selector targeting individual product containers.
        """
        self.base_url = base_url
        self.target_selector = target_selector
        
        # A list of random User-Agents to help prevent blocking
        self.user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.82"
        ]

    def convert_to_affiliate(self, original_url):
        """
        Replace the original product link with an affiliate link structure using the Node.js API endpoint.
        """
        if not original_url:
            return None

        # Resolve relative URLs if necessary
        if original_url.startswith('/'):
            parsed_base = urllib.parse.urlparse(self.base_url)
            original_url = f"{parsed_base.scheme}://{parsed_base.netloc}{original_url}"

        # Step 1 & 2: Format to default link (strip query parameters)
        try:
            parsed = urllib.parse.urlparse(original_url)
            # Remove all query parameters by setting it to empty string
            formatted_url = urllib.parse.urlunparse((
                parsed.scheme, parsed.netloc, parsed.path, parsed.params, '', parsed.fragment
            ))
        except Exception as e:
            print(f"Warning: Failed to format link. Error: {e}")
            formatted_url = original_url

        # Step 3: Convert to my affiliate link
        try:
            import requests
            api_endpoint = 'https://shopeecashback.onrender.com/api/generate-link'
            response = requests.post(
                api_endpoint,
                json={'url': formatted_url},
                headers={'Content-Type': 'application/json'}
            )
            if response.status_code == 200:
                data = response.json()
                if 'link' in data:
                    return data['link']
            print(f"API Warning: Could not convert link {formatted_url} (Status: {response.status_code})")
        except Exception as e:
            print(f"Error calling affiliate API: {e}")
            
        return formatted_url

    def auto_scroll(self, page):
        """
        Automatically scroll down the page to trigger lazy-loading of products.
        """
        print("Scrolling the page to load all products...")
        previous_height = page.evaluate("document.body.scrollHeight")
        while True:
            # Scroll to the bottom of the page
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            
            # Wait for any new elements to load (adjust sleep time as needed based on the site)
            page.wait_for_timeout(2000) 
            
            # Check if the height has increased; if not, we've likely hit the bottom
            new_height = page.evaluate("document.body.scrollHeight")
            if new_height == previous_height:
                break
            previous_height = new_height
        print("Finished scrolling.")

    def run(self):
        """
        Execute the scraping process using Playwright and parse with BeautifulSoup.
        """
        scraped_data = []

        with sync_playwright() as p:
            # Launch chromium (headless=False if you want to see the browser running while debugging)
            browser = p.chromium.launch(headless=True)
            
            # Choose a random User-Agent for this session
            user_agent = random.choice(self.user_agents)
            context = browser.new_context(user_agent=user_agent)
            
            page = context.new_page()
            
            try:
                print(f"Navigating to {self.base_url}...")
                page.goto(self.base_url, wait_until="networkidle")
                
                # Scroll to ensure lazy-loaded items are populated in the DOM
                self.auto_scroll(page)
                
                # Fetch the HTML content after scrolling
                html_content = page.content()
            except Exception as e:
                print(f"Error while loading page: {e}")
                browser.close()
                return
            
            # Close browser as we have the fully loaded HTML
            browser.close()

        # Parse the HTML with BeautifulSoup
        print("Parsing HTML content...")
        soup = BeautifulSoup(html_content, "html.parser")
        
        # Extract active time from time buttons
        active_time_el = soup.select_one('.time-button-item.active') or soup.select_one('.time-buttons-container')
        scraping_time = "Unknown Time"
        if active_time_el:
            scraping_time = ' | '.join(active_time_el.stripped_strings)
            print(f"Extracted scraping time: {scraping_time}")
        
        # Find all product containers based on the provided selector
        product_elements = soup.select(self.target_selector)
        print(f"Found {len(product_elements)} product(s) matching the selector.")

        for element in product_elements:
            try:
                # Note: The specific inner selectors ('h3', '.price', 'a', 'img') 
                # will heavily depend on the target website's structure. 
                # You may need to pass these as configuration if they vary significantly.
                
                # Extract Product Name
                name_el = element.select_one('.product-name, h3, .title')
                name = name_el.get_text(strip=True) if name_el else "Unknown Name"

                # Extract Prices
                current_price_el = element.select_one('.current-price')
                original_price_el = element.select_one('.original-price')
                
                current_price = current_price_el.get_text(strip=True) if current_price_el else "Unknown Price"
                original_price = original_price_el.get_text(strip=True) if original_price_el else ""

                # Extract Discount / Badge
                badge_el = element.select_one('.percent-badge')
                badge = badge_el.get_text(strip=True) if badge_el else ""

                # Extract Amount Info
                amount_el = element.select_one('.amount-info')
                amount = amount_el.get_text(strip=True) if amount_el else ""

                # Extract Image
                img_el = element.select_one('.product-image img') or element.select_one('img')
                raw_src = img_el.get('src') or img_el.get('data-src') if img_el else ""
                image = raw_src

                # Fix next/image URLs starting with /_next/image?url=
                if image.startswith('/_next/image?url='):
                    try:
                        import urllib.parse
                        parsed_query = urllib.parse.urlparse(image).query
                        q_params = urllib.parse.parse_qs(parsed_query)
                        if 'url' in q_params:
                            image = q_params['url'][0]
                    except:
                        pass

                # Extract Link
                link_el = element.select_one('a')
                if not link_el:
                    link_el = element.parent if element.parent and element.parent.name == 'a' else None
                
                # Default to base_url if no valid link was found (to avoid sending invalid links to the API)
                original_link = link_el.get('href') if link_el and link_el.get('href') else None

                # Specifically for linhkaadz, links are often absolute or need base url prepended
                if original_link and original_link.startswith('/'):
                    import urllib.parse
                    parsed_base = urllib.parse.urlparse(self.base_url)
                    original_link = f"{parsed_base.scheme}://{parsed_base.netloc}{original_link}"
                    
                # Skip converting if original_link is just the homepage or doesn't look like a real product
                if not original_link or original_link == self.base_url or original_link == self.base_url.rstrip('/'):
                    affiliate_link = "No Link"
                else:    
                    # Convert the original link to an affiliate link
                    affiliate_link = self.convert_to_affiliate(original_link)

                scraped_data.append({
                    "Product Name": name,
                    "Current Price": current_price,
                    "Original Price": original_price,
                    "Percent Badge": badge,
                    "Amount Info": amount,
                    "Image": image,
                    "Affiliate Link": affiliate_link,
                    "Scraping Time": scraping_time
                })
            except Exception as e:
                print(f"Error parsing a product element: {e}")

        # Export the extracted data
        self.export_data(scraped_data)

    def export_data(self, data):
        """
        Save the scraped data to CSV and JSON formats using Pandas.
        """
        if not data:
            print("No data was scraped. Export aborted.")
            return

        df = pd.DataFrame(data)
        
        csv_filename = "products_data.csv"
        json_filename = "products_data.json"

        # Export to CSV
        df.to_csv(csv_filename, index=False, encoding='utf-8')
        print(f"Data successfully saved to {csv_filename}")

        # Export to JSON
        df.to_json(json_filename, orient='records', force_ascii=False, indent=4)
        print(f"Data successfully saved to {json_filename}")


if __name__ == "__main__":
    # Example usage:
    # URL to scrape
    target_url = "https://linhkaadz.com/" # Replace with the actual target URL
    
    # CSS selector that wraps the entire product item 
    # (e.g., '.product-item', '.grid-item', 'li.product')
    product_selector = ".products-container .product-card" # Replace with the actual selector
    
    scraper = ProductScraper(base_url=target_url, target_selector=product_selector)
    scraper.run()
