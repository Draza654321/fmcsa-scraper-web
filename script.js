// Configuration
const DELAY_BETWEEN_REQUESTS = 500; // ms
const MAX_CONCURRENT_REQUESTS = 3;

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

// Functions
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
    const activeWorkers = [];
    
    while (queue.length > 0 && !stopRequested) {
        while (isPaused && !stopRequested) {
            await sleep(100);
        }
        
        if (activeWorkers.length >= MAX_CONCURRENT_REQUESTS) {
            await sleep(100);
            continue;
        }
        
        const mc = queue.shift();
        currentMc.textContent = `Current MC: ${mc}`;
        currentCompany.textContent = 'Company: -';
        
        const worker = processMcNumber(mc)
            .finally(() => {
                const index = activeWorkers.indexOf(worker);
                if (index !== -1) {
                    activeWorkers.splice(index, 1);
                }
            });
        
        activeWorkers.push(worker);
        
        await sleep(DELAY_BETWEEN_REQUESTS);
    }
    
    // Wait for all active workers to finish
    await Promise.all(activeWorkers);
    
    // Scraping complete
    if (!stopRequested) {
        scrapingComplete();
    }
}

async function processMcNumber(mc) {
    try {
        // In a real implementation, this would make an actual request to FMCSA
        // For this demo, we'll simulate the request with random results
        
        // Simulate network delay
        await sleep(Math.random() * 1000 + 500);
        
        // Randomly determine if found
        const isFound = Math.random() > 0.7;
        
        processed++;
        
        if (isFound) {
            found++;
            
            // Simulate result data
            const result = {
                mcNumber: mc,
                companyName: `Demo Company ${Math.floor(Math.random() * 1000)}`,
                phone: `(${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
                status: 'AUTHORIZED FOR Property'
            };
            
            results.push(result);
            
            // Update UI
            currentCompany.textContent = `Company: ${result.companyName}`;
            addResultToTable(result);
        }
        
        updateProgress(processed, found);
    } catch (error) {
        console.error(`Error processing MC ${mc}:`, error);
        showError(`Error processing MC ${mc}: ${error.message}`);
        processed++;
        updateProgress(processed, found);
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
    
    // Show completion message
    showError('Scraping completed successfully!', 'success');
}

function togglePause() {
    isPaused = !isPaused;
    pauseBtn.innerHTML = isPaused ? '<i class="fas fa-play"></i> Resume' : '<i class="fas fa-pause"></i> Pause';
    
    if (!isPaused) {
        processQueue();
    }
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
