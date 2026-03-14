const generateBtn = document.getElementById('generateBtn');
const shopeeUrlInput = document.getElementById('shopeeUrl');
const errorMsg = document.getElementById('errorMsg');
const resultBox = document.getElementById('resultBox');
const resultLink = document.getElementById('resultLink');
const copyBtn = document.getElementById('copyBtn');
const copyIcon = document.getElementById('copyIcon');
const btnText = document.getElementById('btnText');
const btnLink = document.getElementById('productLink');
const loader = document.getElementById('loader');

// Simple check to ensure it's a valid URL and contains shopee
function isValidShopeeUrl(url) {
    try {
        const parsedUrl = new URL(url);
        return parsedUrl.hostname.includes('shopee') || parsedUrl.hostname.includes('shope.ee');
    } catch (e) {
        return false;
    }
}

async function createAffiliateLink(url) {
    const apiEndpoint = '/api/generate-link'; // Uses our new secure backend
    
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

generateBtn.addEventListener('click', async () => {
    const url = shopeeUrlInput.value.trim();
    
    // Client-side validation
    if (!url || !isValidShopeeUrl(url)) {
        errorMsg.classList.add('active');
        return;
    }
    errorMsg.classList.remove('active');

    // Set loading state
    btnText.style.display = 'none';
    loader.style.display = 'block';
    generateBtn.disabled = true;
    resultBox.classList.remove('active');

    try {
        const affiliateLink = await createAffiliateLink(url);
        
        // Display result
        resultLink.textContent = affiliateLink;
        btnLink.href = affiliateLink;
        resultBox.classList.add('active');
    } catch (error) {
        alert("Failed to generate link. If this persists, it could be a CORS issue or invalid credentials.\n\nError: " + error.message);
    } finally {
        // Reset loading state
        btnText.style.display = 'block';
        loader.style.display = 'none';
        generateBtn.disabled = false;
    }
});

copyIcon.addEventListener('click', () => {
    const linkToCopy = resultLink.textContent;
    
    navigator.clipboard.writeText(linkToCopy).then(() => {
        const floatingText = copyIcon.querySelector('.copy-floating-text');
        floatingText.classList.add('show');
        
        setTimeout(() => {
            floatingText.classList.remove('show');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
        alert("Failed to copy text to clipboard.");
    });
});

// Enter key to submit
shopeeUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        generateBtn.click();
    }
});
