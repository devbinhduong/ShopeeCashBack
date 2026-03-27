class ShopeeLinkGenerator {
    constructor() {
        this.allProducts = [];
        this.countdownInterval = null;
        this.initializeElements();
        if (this.validateElements()) {
            this.bindEvents();
        } else {
            console.error('ShopeeLinkGenerator: Required DOM elements are missing.');
        }
    }

    initializeElements() {
        this.generateBtn = document.getElementById('generateBtn');
        this.shopeeUrlInput = document.getElementById('shopeeUrl');
        this.errorMsg = document.getElementById('errorMsg');
        this.resultBox = document.getElementById('resultBox');
        this.resultLink = document.getElementById('resultLink');
        this.copyIcon = document.getElementById('copyIcon');
        this.btnText = document.getElementById('btnText');
        this.btnLink = document.getElementById('productLink');
        this.loader = document.getElementById('loader');
        this.pasteBtn = document.getElementById('pasteBtn');
        this.clearBtn = document.getElementById('clearBtn');
        
        // New UI elements
        this.searchInput = document.getElementById('searchInput');
        this.sortSelect = document.getElementById('sortSelect');
        this.productsContainer = document.getElementById('productsContainer');
    }

    validateElements() {
        // copyBtn, clearBtn, pasteBtn are optional or might not be present
        return !!(this.generateBtn && this.shopeeUrlInput && this.errorMsg && 
                  this.resultBox && this.resultLink && this.copyIcon && 
                  this.btnText && this.btnLink && this.loader);
    }

    bindEvents() {
        this.generateBtn.addEventListener('click', () => this.handleGenerate());
        this.copyIcon.addEventListener('click', () => this.handleCopy());
        this.shopeeUrlInput.addEventListener('keypress', (e) => this.handleKeyPress(e));
        this.shopeeUrlInput.addEventListener('input', () => this.handleInput());
        
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => this.handleClear());
        }
        
        if (this.pasteBtn) {
            this.pasteBtn.addEventListener('click', () => this.handlePaste());
        }

        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => this.filterAndSortProducts());
        }
        
        if (this.sortSelect) {
            this.sortSelect.addEventListener('change', () => this.filterAndSortProducts());
        }
    }

    isValidShopeeUrl(url) {
        try {
            const parsedUrl = new URL(url);
            return parsedUrl.hostname.includes('shopee') || 
                   parsedUrl.hostname.includes('shope.ee') || 
                   parsedUrl.hostname.includes('shp.ee');
        } catch (e) {
            return false;
        }
    }

    async createAffiliateLink(url) {
        const apiEndpoint = 'https://shopeecashback.onrender.com/api/generate-link';
        
        try {
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url: url })
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || `API Error (${response.status})`);
            }

            const data = await response.json();
            return data.link;

        } catch (error) {
            console.error("Link generation failed:", error);
            throw error;
        }
    }

    setLoadingState(isLoading) {
        if (isLoading) {
            this.btnText.style.display = 'none';
            this.loader.style.display = 'block';
            this.generateBtn.disabled = true;
            this.resultBox.classList.remove('active');
        } else {
            this.btnText.style.display = 'block';
            this.loader.style.display = 'none';
            this.generateBtn.disabled = false;
        }
    }

    async handleGenerate() {
        const url = this.shopeeUrlInput.value.trim();
        
        // Client-side validation
        if (!url || !this.isValidShopeeUrl(url)) {
            this.errorMsg.classList.add('active');
            return;
        }
        this.errorMsg.classList.remove('active');

        this.setLoadingState(true);

        try {
            const affiliateLink = await this.createAffiliateLink(url);
            
            // Display result
            this.resultLink.textContent = affiliateLink;
            this.btnLink.href = affiliateLink;
            this.resultBox.classList.add('active');
        } catch (error) {
            alert("Không thể tạo liên kết. Nếu lỗi vẫn tiếp diễn, có thể do sự cố CORS hoặc thông tin xác thực không hợp lệ.\n\nLỗi: " + error.message);
        } finally {
            this.setLoadingState(false);
        }
    }

    handleCopy() {
        const linkToCopy = this.resultLink.textContent;
        
        navigator.clipboard.writeText(linkToCopy).then(() => {
            const floatingText = this.copyIcon.querySelector('.copy-floating-text');
            floatingText.classList.add('show');
            
            setTimeout(() => {
                floatingText.classList.remove('show');
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            alert("Không thể sao chép văn bản vào khay nhớ tạm.");
        });
    }

    handleKeyPress(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.handleGenerate();
        }
    }

    handleInput() {
        if (this.shopeeUrlInput.value.length > 0) {
            if (this.clearBtn) this.clearBtn.classList.remove('hidden');
            if (this.pasteBtn) this.pasteBtn.style.display = 'none';
        } else {
            if (this.clearBtn) this.clearBtn.classList.add('hidden');
            if (this.pasteBtn) this.pasteBtn.style.display = 'block';
        }
    }

    handleClear() {
        this.shopeeUrlInput.value = '';
        this.handleInput(); 
        this.shopeeUrlInput.focus();
    }

    async handlePaste() {
        try {
            const text = await navigator.clipboard.readText();
            this.shopeeUrlInput.value = text;
            this.handleInput(); 
        } catch (err) {
            console.error('Failed to read clipboard contents: ', err);
            alert("Không thể đọc từ khay nhớ tạm. Vui lòng kiểm tra quyền truy cập của trình duyệt.");
        }
    }

    parsePrice(priceStr) {
        if (!priceStr) return 0;
        const normalized = priceStr.replace(/\D/g, '');
        return parseInt(normalized, 10) || 0;
    }

    filterAndSortProducts() {
        if (!this.allProducts.length) return;

        const searchTerm = (this.searchInput?.value || '').toLowerCase().trim();
        const sortValue = this.sortSelect?.value || 'default';

        // Filter
        let filtered = this.allProducts.filter(product => {
            const name = (product['Product Name'] || '').toLowerCase();
            return name.includes(searchTerm);
        });

        // Sort
        filtered.sort((a, b) => {
            if (sortValue === 'price-asc') {
                return this.parsePrice(a['Current Price']) - this.parsePrice(b['Current Price']);
            } else if (sortValue === 'price-desc') {
                return this.parsePrice(b['Current Price']) - this.parsePrice(a['Current Price']);
            } else if (sortValue === 'name-asc') {
                return (a['Product Name'] || '').localeCompare(b['Product Name'] || '');
            } else if (sortValue === 'name-desc') {
                return (b['Product Name'] || '').localeCompare(a['Product Name'] || '');
            }
            return 0; // default
        });

        this.renderProducts(filtered);
    }

    setupTimeDisplay(timeStr) {
        if (!timeStr || timeStr === "Unknown Time") return;

        const parts = timeStr.split('|').map(p => p.trim());
        if (parts.length >= 3) {
            const dateStr = parts[0]; // e.g., "28-03"
            const frameStr = parts[1]; // e.g., "KHUNG: 02:00" or "Khung: 02:00"
            const stateStr = parts[2]; // e.g., "Đã kết thúc" or "Đang diễn ra"

            const container = document.getElementById('timeStatusContainer');
            if (container) container.classList.remove('hidden');

            const dateEl = document.getElementById('timeDate');
            const frameEl = document.getElementById('timeFrame');
            const stateEl = document.getElementById('timeState');

            if (dateEl) dateEl.textContent = dateStr;
            if (frameEl) frameEl.textContent = frameStr;
            if (stateEl) {
                stateEl.textContent = stateStr;
                if (stateStr.toLowerCase().includes('kết thúc')) {
                    stateEl.classList.add('ended');
                } else {
                    stateEl.classList.remove('ended');
                }
            }

            // Countdown logic if it's currently active or upcoming
            const frameMatch = frameStr.match(/\d{1,2}:\d{2}/);
            const isEnded = stateStr.toLowerCase().includes('kết thúc');

            if (frameMatch && !isEnded) {
                // Determine target time
                const timeOnly = frameMatch[0]; // "02:00"
                const [hours, minutes] = timeOnly.split(':').map(Number);
                
                // Assuming the frame is today for simplicity; real logic might parse dateStr
                let targetDate = new Date();
                targetDate.setHours(hours, minutes, 0, 0);

                // If target time is already past but state is not "kết thúc", maybe it spans a few hours. Let's just create a generic +2 hours countdown for demo if needed, or point to the end of the frame.
                // Assuming frame lasts 2 hours normally
                targetDate.setHours(targetDate.getHours() + 2);

                if (targetDate > new Date()) {
                    this.startCountdown(targetDate);
                }
            } else {
                this.stopCountdown();
            }
        }
    }

    startCountdown(targetDate) {
        const countdownBox = document.getElementById('countdownBox');
        const timerEl = document.getElementById('countdownTimer');
        
        if (!countdownBox || !timerEl) return;
        
        countdownBox.classList.remove('hidden');
        if (this.countdownInterval) clearInterval(this.countdownInterval);

        this.countdownInterval = setInterval(() => {
            const now = new Date();
            const diff = targetDate - now;

            if (diff <= 0) {
                this.stopCountdown();
                timerEl.textContent = "00:00:00";
                return;
            }

            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);

            timerEl.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }, 1000);
    }

    stopCountdown() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        const countdownBox = document.getElementById('countdownBox');
        if (countdownBox) countdownBox.classList.add('hidden');
    }

    renderProducts(productsToRender) {
        if (!this.productsContainer) return;

        this.productsContainer.innerHTML = ''; // Clear previous

        if (productsToRender.length === 0) {
            this.productsContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #888;">Không tìm thấy sản phẩm nào.</p>';
            return;
        }

        productsToRender.forEach(product => {
            const card = document.createElement('a');
            card.className = 'product-card';
            card.href = product['Affiliate Link'] && product['Affiliate Link'] !== "No Link" ? product['Affiliate Link'] : '#';
            card.target = '_blank';

            const badgeHtml = product['Percent Badge'] 
                ? `<div class="percent-badge">${product['Percent Badge']}</div>` 
                : '';

            const originalPriceHtml = product['Original Price'] 
                ? `<div class="original-price">${product['Original Price']}</div>` 
                : '';

            const amountHtml = product['Amount Info'] 
                ? `<div class="amount-info">${product['Amount Info']}</div>` 
                : '';

            card.innerHTML = `
                <div class="product-image">
                    <img src="${product['Image'] || ''}" alt="${product['Product Name'] || 'Product Image'}" loading="lazy">
                    ${badgeHtml}
                </div>
                <div class="product-info">
                    <h3 class="product-name">${product['Product Name'] || 'Sản phẩm'}</h3>
                    <div class="price-container">
                        <div class="current-price">${product['Current Price'] || 'Liên hệ'}</div>
                        ${originalPriceHtml}
                    </div>
                </div>
                ${amountHtml}
            `;
            
            this.productsContainer.appendChild(card);
        });
    }

    async loadProducts() {
        if (!this.productsContainer) return;

        try {
            const response = await fetch('products_data.json?' + new Date().getTime());
            if (!response.ok) {
                console.info('No product data found to render yet (products_data.json not found).');
                return;
            }
            
            const products = await response.json();
            if (!Array.isArray(products) || products.length === 0) {
                this.productsContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #888;">Chưa có dữ liệu sản phẩm.</p>';
                return;
            }

            this.allProducts = products;

            // Setup Time Display if available on first product
            if (this.allProducts.length > 0 && this.allProducts[0]['Scraping Time']) {
                this.setupTimeDisplay(this.allProducts[0]['Scraping Time']);
            }

            // Initial render
            this.filterAndSortProducts();

        } catch (error) {
            console.error('Failed to load products:', error);
            this.productsContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--error);">Lỗi tải dữ liệu sản phẩm.</p>';
        }
    }
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new ShopeeLinkGenerator();
    app.loadProducts(); // Fetch and render products on start
});
