// Configuration
const DELAY_BETWEEN_REQUESTS = 2000; // 2s delay to avoid rate limiting
const CORS_PROXY = "https://cors-anywhere.herokuapp.com/"; // Free proxy service
const FMCSA_URL = "https://safer.fmcsa.dot.gov/CompanySnapshot.aspx";

// DOM Elements
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const stopBtn = document.getElementById('stop-btn');
const downloadBtn = document.getElementById('download-btn');
const mcNumbersTextarea = document.getElementById('mc-numbers');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const processedCount = document.getElementById('processed-count');
const foundCount = document.getElementById('found-count');
const elapsedTime = document.getElementById('elapsed-time');
const currentMc = document.getElementById('current-mc');
const currentCompany = document.getElementById('current-company');
const errorMessage = document.getElementById('error-message');
const resultsContainer = document.getElementById('results-container');
const resultsTable = document.getElementById('results-table').querySelector('tbody');
const formatRadios = document.querySelectorAll('input[name="format"]');

// State
let isRunning = false;
let isPaused = false;
let stopRequested = false;
let startTime;
let timerInterval;
let results = [];
let processed = 0;
let found = 0;
let total = 0;
let queue = [];

// Event Listeners
startBtn.addEventListener('click', startScraping);
pauseBtn.addEventListener('click', togglePause);
stopBtn.addEventListener('click', stopScraping);
downloadBtn.addEventListener('click', downloadResults);

// Main Functions
function startScraping() {
    // Reset state
    isRunning = true;
    isPaused = false;
    stopRequested = false;
    processed = 0;
    found = 0;
    results = [];
    resultsTable.innerHTML = '';
    errorMessage.style.display = 'none';
    
    // Parse MC numbers
    const mcNumbersInput = mcNumbersTextarea.value.trim();
    if (!mcNumbersInput) {
        showError('Please enter at least one MC number');
        return;
    }
    
    // Split by commas or newlines, trim, and filter empty
    queue = mcNumbersInput.split(/[\n,]/)
        .map(mc => mc.trim())
        .filter(mc => mc !== '');
    
    total = queue.length;
    
    if (total === 0) {
        showError('No valid MC numbers found');
        return;
    }
    
    // Update UI
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    stopBtn.disabled = false;
    downloadBtn.disabled = true;
    resultsContainer.style.display = 'none';
    
    updateProgress(0, 0);
    startTimer();
    
    // Start processing
    processQueue();
}

async function processQueue() {
    while (queue.length > 0 && !stopRequested) {
        while (isPaused && !stopRequested) {
            await sleep(100);
        }
        
        if (stopRequested) break;
        
        const mc = queue.shift();
        await processMcNumber(mc);
        await sleep(DELAY_BETWEEN_REQUESTS);
    }
    
    if (!stopRequested) {
        scrapingComplete();
    }
}

async function processMcNumber(mc) {
    try {
        currentMc.textContent = `Current MC: ${mc}`;
        currentCompany.textContent = "Loading...";

        // Fetch the page through CORS proxy
        const response = await fetch(`${CORS_PROXY}${FMCSA_URL}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                '2': 'on',  // MC Number radio button
                '4': mc,    // MC Number value
                'search': 'search' // Form submission
            })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Check if record exists
        const notFound = doc.evaluate(
            "//td[contains(text(), 'Record Not Found')]",
            doc,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        ).singleNodeValue;
        
        if (notFound) {
            updateProgress(++processed, found);
            currentCompany.textContent = "Company: Not Found";
            return;
        }

        // Extract company data using XPath (more reliable than CSS selectors)
        const companyName = getXPathResult(doc, "//tr[contains(th/text(), 'Legal Name')]/td[2]");
        const phone = getXPathResult(doc, "//tr[contains(th/text(), 'Telephone')]/td[2]");
        const status = getXPathResult(doc, "//tr[contains(th/text(), 'Carrier Status')]/td[2]");

        // Only save authorized carriers
        if (status && status.includes("AUTHORIZED FOR Property")) {
            found++;
            const result = {
                mcNumber: mc,
                companyName: companyName || "N/A",
                phone: phone || "N/A",
                status: status || "N/A"
            };
            results.push(result);
            addResultToTable(result);
            currentCompany.textContent = `Company: ${(companyName || '').substring(0, 30)}...`;
        }

        updateProgress(++processed, found);
        
    } catch (error) {
        console.error(`Error processing MC ${mc}:`, error);
        showError(`Error processing MC ${mc}: ${error.message}`);
        updateProgress(++processed, found);
    }
}

// Helper Functions
function getXPathResult(doc, xpath) {
    try {
        const result = doc.evaluate(
            xpath,
            doc,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        ).singleNodeValue;
        return result ? result.textContent.trim() : null;
    } catch {
        return null;
    }
}

function updateProgress(current, foundCountValue) {
    const percent = Math.round((current / total) * 100);
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `${percent}%`;
    processedCount.textContent = current;
    foundCount.textContent = foundCountValue;
}

function addResultToTable(result) {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${result.mcNumber}</td>
        <td>${result.companyName}</td>
        <td>${result.phone}</td>
        <td>${result.status}</td>
    `;
    resultsTable.appendChild(row);
}

function scrapingComplete() {
    isRunning = false;
    stopTimer();
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    stopBtn.disabled = true;
    downloadBtn.disabled = false;
    currentMc.textContent = 'Current MC: -';
    currentCompany.textContent = 'Company: -';
    
    if (results.length > 0) {
        resultsContainer.style.display = 'block';
    }
    showError('Scraping completed successfully!', 'success');
}

function togglePause() {
    isPaused = !isPaused;
    pauseBtn.innerHTML = isPaused ? '<i class="fas fa-play"></i> Resume' : '<i class="fas fa-pause"></i> Pause';
}

function stopScraping() {
    stopRequested = true;
    isRunning = false;
    isPaused = false;
    stopTimer();
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    stopBtn.disabled = true;
    currentMc.textContent = 'Current MC: -';
    currentCompany.textContent = 'Company: -';
    showError('Scraping stopped by user');
}

function startTimer() {
    startTime = new Date();
    timerInterval = setInterval(updateTimer, 1000);
    updateTimer();
}

function updateTimer() {
    const now = new Date();
    const diff = Math.floor((now - startTime) / 1000);
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    elapsedTime.textContent = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function stopTimer() {
    clearInterval(timerInterval);
}

function pad(num) {
    return num.toString().padStart(2, '0');
}

function showError(message, type = 'error') {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    errorMessage.style.color = type === 'error' ? '#f44336' : '#4CAF50';
}

function downloadResults() {
    if (results.length === 0) {
        showError('No results to download');
        return;
    }
    
    const selectedFormat = document.querySelector('input[name="format"]:checked').value;
    let content, mimeType, extension;
    
    if (selectedFormat === 'csv') {
        // Convert to CSV
        const headers = ['MC Number', 'Company Name', 'Phone', 'Status'];
        const rows = results.map(r => [r.mcNumber, r.companyName, r.phone, r.status]);
        content = [headers, ...rows]
            .map(row => row.map(field => `"${field.replace(/"/g, '""')}"`).join(','))
            .join('\n');
        mimeType = 'text/csv';
        extension = 'csv';
    } else {
        // Convert to JSON
        content = JSON.stringify(results, null, 2);
        mimeType = 'application/json';
        extension = 'json';
    }
    
    // Create download link
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fmcsa-results-${new Date().toISOString().slice(0, 10)}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
