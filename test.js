const ACCESS_KEY = 'novkwOG-hgYa8qIC3wk9XiJw-B7XKzjh';
const CAMPAIGN_ID = '4751584435713464237';
const url = 'https://shopee.vn/Tai-Nghe-Bluetooth-P2961-P47-Y08';

async function test() {
    const apiEndpoint = 'https://api.accesstrade.vn/v1/product_link/create';
    try {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${ACCESS_KEY}`
            },
            body: JSON.stringify({
                campaign_id: CAMPAIGN_ID,
                urls: [url]
            })
        });
        const text = await response.text();
        console.log("Status:", response.status);
        console.log("Body:", text);
    } catch (e) {
        console.error(e);
    }
}
test();
