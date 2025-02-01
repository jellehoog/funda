const puppeteer = require('puppeteer');

(async () => {
    console.log("⏳ Puppeteer wordt gestart...");
    try {
        const browser = await puppeteer.launch({
            headless: false, // Zet op false zodat je kunt zien wat er gebeurt
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        console.log("✅ Browser gestart!");
        const page = await browser.newPage();

        // Voorkom dat Puppeteer als bot wordt gedetecteerd
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        // Simuleer een echte gebruiker
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

        let pageNumber = 1;
        let allResults = [];

        while (true) {
            const url = `https://www.funda.nl/zoeken/koop?selected_area=[%22ulvenhout-gem-breda,50km%22]&object_type=[%22house%22,%22apartment%22]&publication_date=%2230%22&availability=[%22available%22]&search_result=${pageNumber}&sort=%22date_up%22`;

            console.log(`🌍 Laden van pagina ${pageNumber}: ${url}`);
            await page.goto(url, { waitUntil: 'networkidle2' });

            // Check en accepteer cookies
            try {
                await page.waitForSelector('#didomi-notice-agree-button', { timeout: 5000 });
                await page.click('#didomi-notice-agree-button');
                console.log("✅ Cookies geaccepteerd!");
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error) {
                console.log("⚠️ Geen cookie-popup gevonden, doorgaan...");
            }

            console.log("🔍 Controleren of er nog woningen zijn met 'Sinds 4 weken'...");

            const isValid = await page.evaluate(() => {
                return document.body.innerText.includes("Sinds 4 weken");
            });

            if (!isValid) {
                console.log("🚨 Geen woningen meer met 'Sinds 4 weken'. Scraping stoppen!");
                break;
            }

            console.log("📌 Scrapen van woningen op pagina...");
            const results = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('.border-b.pb-3')).map(el => ({
                    status: el.querySelector('.bg-red-70')?.innerText.trim() || 'Beschikbaar',
                    title: el.querySelector('[data-testid="listingDetailsAddress"] div:first-child span')?.innerText.trim() || 'Geen titel',
                    address: el.querySelector('[data-testid="listingDetailsAddress"] div:last-child')?.innerText.trim() || 'Geen adres',
                    price: el.querySelector('.font-semibold.mt-2.mb-0 div')?.innerText.trim() || 'Geen prijs',
                    area: el.querySelector('li:nth-child(1) span')?.innerText.trim() || 'Geen oppervlakte',
                    plotSize: el.querySelector('li:nth-child(2) span')?.innerText.trim() || 'Geen perceelgrootte',
                    rooms: el.querySelector('li:nth-child(3) span')?.innerText.trim() || 'Geen kamers',
                    energyLabel: el.querySelector('li:nth-child(4) span')?.innerText.trim() || 'Geen energielabel',
                    agent: el.querySelector('a[href^="https://www.funda.nl/makelaar"] span')?.innerText.trim() || 'Geen makelaar',
                    link: 'https://www.funda.nl' + (el.querySelector('[data-testid="listingDetailsAddress"]')?.getAttribute('href') || '#'),
                    image: el.querySelector('img')?.getAttribute('src') || 'Geen afbeelding'
                }));
            });

            if (results.length === 0) {
                console.log("⚠️ Geen data gevonden op deze pagina. Controleer 'funda_debug.png'.");
                await page.screenshot({ path: 'funda_debug.png', fullPage: true });
                console.log("📸 Screenshot opgeslagen als funda_debug.png");
                break;
            } else {
                console.log(`🎯 Gegevens opgehaald (${results.length} woningen op deze pagina).`);
                allResults = allResults.concat(results);
            }

            pageNumber++;
        }

        console.log("✅ Alle woninggegevens verzameld!");
        console.log(JSON.stringify(allResults, null, 2));

        await browser.close();
        console.log("🚀 Puppeteer afgesloten.");
    } catch (error) {
        console.error("❌ Er is een fout opgetreden:", error);
    }
})();
