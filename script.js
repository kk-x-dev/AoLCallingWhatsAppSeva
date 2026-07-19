// Call Status Dashboard Logic
// Optimized for mobile interactions and offline-ready local storage integration

// Sub-statuses configuration matching requirement categories
const SUB_STATUS_OPTIONS = {
    "Not Called": [],
    "Interested": [
        "Interested in course",
        "Not sure now",
        "Need to check with family/boss/parents"
    ],
    "HP": [
        "Happiness course / OMBW not done"
    ],
    "Not Interested": [
        "Not Interested with SS / AOL",
        "Invalid Number",
        "Number does not Exist",
        "International Number"
    ],
    "Future Lead": [
        "Dates not suitable",
        "Location not suitable",
        "Exam / no leaves",
        "Phone not picked / disconnected / not reachable (after multiple tries)",
        "Said just OK / no response"
    ]
};

// State Variables
let callList = []; // Holds items like { id, phone, mainStatus, subStatus }
let activeFilter = 'all';
let searchQuery = '';

// DOM Elements
const elements = {
    currentDate: document.getElementById('current-date'),
    phoneInput: document.getElementById('phone-numbers-input'),
    btnLoadNumbers: document.getElementById('btn-load-numbers'),
    inputContainer: document.getElementById('input-container'),
    searchInput: document.getElementById('search-input'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    filterChips: document.getElementById('filter-chips'),
    cardsContainer: document.getElementById('cards-container'),
    emptyState: document.getElementById('empty-state'),
    visibleCardsCount: document.getElementById('visible-cards-count'),
    
    // Header Stats
    headerTotal: document.getElementById('header-total'),
    headerCompleted: document.getElementById('header-completed'),
    headerRemaining: document.getElementById('header-remaining'),
    
    // Bottom Stats Bar
    stickyStatsBar: document.getElementById('sticky-stats-bar'),
    btnToggleStats: document.getElementById('btn-toggle-stats'),
    statsExpandedGrid: document.getElementById('stats-expanded-grid'),
    stripTotal: document.getElementById('strip-total'),
    stripCompleted: document.getElementById('strip-completed'),
    stripRemaining: document.getElementById('strip-remaining'),
    
    // Expandable Stats details
    statNotCalled: document.getElementById('stat-not-called'),
    statInterested: document.getElementById('stat-interested'),
    statHP: document.getElementById('stat-hp'),
    statFuture: document.getElementById('stat-future'),
    statNotInterested: document.getElementById('stat-not-interested'),
    
    // Action Buttons
    utilityActions: document.getElementById('utility-actions'),
    btnReset: document.getElementById('btn-reset'),
    btnExport: document.getElementById('btn-export'),
    btnImportAgain: document.getElementById('btn-import-again'),
    
    // Floating Share Action
    btnFloatingShare: document.getElementById('btn-floating-share'),
    
    // Modal Dialogue
    shareModal: document.getElementById('share-modal'),
    reportPreview: document.getElementById('report-preview'),
    btnCopyReport: document.getElementById('btn-copy-report'),
    btnShareNative: document.getElementById('btn-share-native'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnModalCloseTimes: document.getElementById('btn-modal-close-times')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // 1. Display Current Date formatted like "19 July 2026"
    displayFormattedDate();

    // 2. Load numbers from Local Storage if available
    const savedData = localStorage.getItem('aol_call_dashboard_data');
    if (savedData) {
        try {
            callList = JSON.parse(savedData);
            if (callList.length > 0) {
                hideInputSection();
                elements.utilityActions.style.display = 'block';
                elements.btnFloatingShare.style.display = 'flex';
                elements.stickyStatsBar.style.display = 'block';
            }
        } catch (e) {
            console.error("Failed to parse local storage data", e);
            callList = [];
        }
    }

    // 3. Register Event Listeners
    elements.btnLoadNumbers.addEventListener('click', handleLoadNumbers);
    elements.searchInput.addEventListener('input', handleSearch);
    elements.btnClearSearch.addEventListener('click', handleClearSearch);
    
    // Filter chip clicks
    elements.filterChips.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            elements.filterChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            activeFilter = e.target.dataset.filter;
            render();
        });
    });

    // Share report triggers
    elements.btnFloatingShare.addEventListener('click', openShareModal);
    elements.btnCloseModal.addEventListener('click', closeShareModal);
    elements.btnModalCloseTimes.addEventListener('click', closeShareModal);
    elements.btnCopyReport.addEventListener('click', handleCopyReport);
    elements.btnShareNative.addEventListener('click', handleNativeShare);
    elements.btnExport.addEventListener('click', handleExportReport);
    elements.btnReset.addEventListener('click', handleResetApp);
    elements.btnImportAgain.addEventListener('click', showInputSection);
    
    // Toggle Stats details
    elements.btnToggleStats.addEventListener('click', toggleStatsExpansion);

    // Initial render
    render();
}

// Display Formatted Date
function displayFormattedDate() {
    const months = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
    ];
    // Create Date matching local timezone
    const now = new Date();
    const day = now.getDate();
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    
    elements.currentDate.textContent = `${day} ${month} ${year}`;
}

// Show/Hide Input Area for importing
function showInputSection() {
    elements.inputContainer.style.display = 'block';
    elements.btnImportAgain.style.display = 'none';
    elements.inputContainer.scrollIntoView({ behavior: 'smooth' });
}

function hideInputSection() {
    elements.inputContainer.style.display = 'none';
    elements.btnImportAgain.style.display = 'inline-block';
}

// Handle Loading raw numbers
function handleLoadNumbers() {
    const rawText = elements.phoneInput.value.trim();
    if (!rawText) {
        alert("Please paste some phone numbers first.");
        return;
    }

    // Split text by lines, spaces, commas, or semicolons
    const numbersArray = rawText
        .split(/[\n,; ]+/)
        .map(num => num.replace(/[^+\d]/g, '').trim()) // clean formatting, keep + and digits
        .filter(num => num.length >= 7); // simple validation for phone digits length

    if (numbersArray.length === 0) {
        alert("No valid phone numbers found in the pasted text.");
        return;
    }

    let appendMode = false;
    if (callList.length > 0) {
        appendMode = confirm(`You already have ${callList.length} numbers loaded. Do you want to APPEND the new numbers? (Click Cancel to OVERWRITE instead)`);
    }

    const newCalls = numbersArray.map(phone => ({
        id: 'call_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now(),
        phone: phone,
        mainStatus: 'Not Called',
        subStatus: ''
    }));

    if (appendMode) {
        // filter duplicates already in callList
        const existingPhones = new Set(callList.map(c => c.phone));
        const filteredNewCalls = newCalls.filter(c => !existingPhones.has(c.phone));
        callList = [...callList, ...filteredNewCalls];
        alert(`Added ${filteredNewCalls.length} new numbers (ignored ${newCalls.length - filteredNewCalls.length} duplicates).`);
    } else {
        callList = newCalls;
    }

    elements.phoneInput.value = '';
    saveToStorage();
    hideInputSection();
    
    // Display relevant panels
    elements.utilityActions.style.display = 'block';
    elements.btnFloatingShare.style.display = 'flex';
    elements.stickyStatsBar.style.display = 'block';

    render();
}

// Save state to localStorage
function saveToStorage() {
    localStorage.setItem('aol_call_dashboard_data', JSON.stringify(callList));
}

// Update live counts and statistics
function updateStats() {
    const total = callList.length;
    const notCalled = callList.filter(c => c.mainStatus === 'Not Called').length;
    const completed = total - notCalled;
    
    const interested = callList.filter(c => c.mainStatus === 'Interested').length;
    const hp = callList.filter(c => c.mainStatus === 'HP').length;
    const future = callList.filter(c => c.mainStatus === 'Future Lead').length;
    const notInterested = callList.filter(c => c.mainStatus === 'Not Interested').length;

    // Header updates
    elements.headerTotal.textContent = total;
    elements.headerCompleted.textContent = completed;
    elements.headerRemaining.textContent = notCalled;

    // Bottom strip updates
    elements.stripTotal.textContent = total;
    elements.stripCompleted.textContent = completed;
    elements.stripRemaining.textContent = notCalled;

    // Expanded details updates
    elements.statNotCalled.textContent = notCalled;
    elements.statInterested.textContent = interested;
    elements.statHP.textContent = hp;
    elements.statFuture.textContent = future;
    elements.statNotInterested.textContent = notInterested;
}

// Dynamic Filter & Search UI
function handleSearch(e) {
    searchQuery = e.target.value.trim().toLowerCase();
    if (searchQuery) {
        elements.btnClearSearch.style.display = 'block';
    } else {
        elements.btnClearSearch.style.display = 'none';
    }
    render();
}

function handleClearSearch() {
    elements.searchInput.value = '';
    searchQuery = '';
    elements.btnClearSearch.style.display = 'none';
    render();
}

// Render dynamic card items to cards container
function render() {
    // Clear list
    elements.cardsContainer.innerHTML = '';

    // Apply Filter and Search
    const filteredList = callList.filter(call => {
        const matchesSearch = call.phone.toLowerCase().includes(searchQuery);
        const matchesFilter = activeFilter === 'all' || call.mainStatus === activeFilter;
        return matchesSearch && matchesFilter;
    });

    elements.visibleCardsCount.textContent = filteredList.length;

    if (callList.length === 0) {
        elements.emptyState.style.display = 'flex';
        elements.cardsContainer.style.display = 'none';
        elements.utilityActions.style.display = 'none';
        elements.btnFloatingShare.style.display = 'none';
        elements.stickyStatsBar.style.display = 'none';
        return;
    } else {
        elements.emptyState.style.display = 'none';
        elements.cardsContainer.style.display = 'grid';
    }

    filteredList.forEach(call => {
        const cardElement = createCardElement(call);
        elements.cardsContainer.appendChild(cardElement);
    });

    updateStats();
}

// Create individual card elements
function createCardElement(call) {
    const card = document.createElement('div');
    card.className = `number-card state-${getCardStateClass(call.mainStatus)}`;
    card.id = call.id;

    // Build sub options markup
    const subStatuses = SUB_STATUS_OPTIONS[call.mainStatus] || [];
    const showSubDropdown = subStatuses.length > 0;

    card.innerHTML = `
        <div class="card-header-info">
            <div class="card-phone">
                <span>${call.phone}</span>
                <a href="tel:${call.phone}" class="btn-call-direct" title="Call directly">📞</a>
            </div>
            <div class="card-status-badge">
                ${call.mainStatus === 'Not Called' ? '🔘' : '✓'} ${call.mainStatus}
            </div>
        </div>
        
        <div class="card-controls">
            <div class="control-group">
                <label for="main-status-${call.id}">Main Status</label>
                <div class="select-wrapper">
                    <select id="main-status-${call.id}" class="select-control main-status-select">
                        <option value="Not Called" ${call.mainStatus === 'Not Called' ? 'selected' : ''}>Not Called</option>
                        <option value="Interested" ${call.mainStatus === 'Interested' ? 'selected' : ''}>Interested</option>
                        <option value="HP" ${call.mainStatus === 'HP' ? 'selected' : ''}>HP</option>
                        <option value="Future Lead" ${call.mainStatus === 'Future Lead' ? 'selected' : ''}>Future Lead</option>
                        <option value="Not Interested" ${call.mainStatus === 'Not Interested' ? 'selected' : ''}>Not Interested</option>
                    </select>
                </div>
            </div>
            
            <div class="control-group sub-status-group" style="display: ${showSubDropdown ? 'flex' : 'none'}">
                <label for="sub-status-${call.id}">Sub Status</label>
                <div class="select-wrapper">
                    <select id="sub-status-${call.id}" class="select-control sub-status-select">
                        ${subStatuses.map(sub => `<option value="${sub}" ${call.subStatus === sub ? 'selected' : ''}>${sub}</option>`).join('')}
                    </select>
                </div>
            </div>
        </div>
        
        <div class="card-actions">
            <button class="btn-card-action btn-delete-card">🗑️ Remove</button>
        </div>
    `;

    // Dropdown change listeners
    const mainSelect = card.querySelector('.main-status-select');
    const subSelect = card.querySelector('.sub-status-select');
    const subGroup = card.querySelector('.sub-status-group');

    mainSelect.addEventListener('change', (e) => {
        const newMain = e.target.value;
        let newSub = '';
        
        // Dynamically update sub-status dropdown options
        const subs = SUB_STATUS_OPTIONS[newMain] || [];
        if (subs.length > 0) {
            newSub = subs[0]; // select first by default
            subSelect.innerHTML = subs.map(sub => `<option value="${sub}">${sub}</option>`).join('');
            subGroup.style.display = 'flex';
        } else {
            subSelect.innerHTML = '';
            subGroup.style.display = 'none';
        }

        updateCallState(call.id, newMain, newSub);
    });

    if (showSubDropdown) {
        subSelect.addEventListener('change', (e) => {
            updateCallState(call.id, call.mainStatus, e.target.value);
        });
    }

    // Delete card trigger
    card.querySelector('.btn-delete-card').addEventListener('click', () => {
        if (confirm(`Remove phone number ${call.phone} from the list?`)) {
            callList = callList.filter(c => c.id !== call.id);
            saveToStorage();
            render();
        }
    });

    return card;
}

// Map Main Status to Card Style Class
function getCardStateClass(mainStatus) {
    switch (mainStatus) {
        case 'Interested': return 'interested';
        case 'HP': return 'hp';
        case 'Future Lead': return 'future';
        case 'Not Interested': return 'notinterested';
        default: return 'notcalled';
    }
}

// Update Call Object State
function updateCallState(id, mainStatus, subStatus) {
    const callIndex = callList.findIndex(c => c.id === id);
    if (callIndex !== -1) {
        callList[callIndex].mainStatus = mainStatus;
        callList[callIndex].subStatus = subStatus;
        saveToStorage();
        
        // Update statistics and classes dynamically on the DOM without drawing everything again
        const cardNode = document.getElementById(id);
        if (cardNode) {
            // update classes
            cardNode.className = `number-card state-${getCardStateClass(mainStatus)}`;
            
            // update badge
            const badge = cardNode.querySelector('.card-status-badge');
            if (badge) {
                badge.innerHTML = `${mainStatus === 'Not Called' ? '🔘' : '✓'} ${mainStatus}`;
            }
        }
        
        updateStats();
    }
}

// Toggle stats expansion panel on sticky bar
function toggleStatsExpansion() {
    const isExpanded = elements.statsExpandedGrid.style.display === 'grid';
    if (isExpanded) {
        elements.statsExpandedGrid.style.display = 'none';
        elements.btnToggleStats.textContent = '📊 Details';
    } else {
        elements.statsExpandedGrid.style.display = 'grid';
        elements.btnToggleStats.textContent = '▲ Collapse';
    }
}

// Generate Compiled Text Report
function generateReportText() {
    const months = [
        "January", "February", "March", "April", "May", "June", 
        "July", "August", "September", "October", "November", "December"
    ];
    const now = new Date();
    const dateStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

    const total = callList.length;
    const remainingCount = callList.filter(c => c.mainStatus === 'Not Called').length;
    const completedCount = total - remainingCount;

    let report = `Date:\n${dateStr}\n\nTotal Numbers: ${total}\nCompleted: ${completedCount}\nRemaining: ${remainingCount}\n\n`;

    // Group functions helper
    const buildCategorySection = (categoryTitle, matchStatus) => {
        const filtered = callList.filter(c => c.mainStatus === matchStatus);
        if (filtered.length === 0) return '';
        
        let section = `--- ${categoryTitle} (${filtered.length})\n\n`;
        filtered.forEach(call => {
            section += `${call.phone}\n${call.subStatus || ''}\n\n`;
        });
        return section;
    };

    // 1. Interested
    report += buildCategorySection("Interested", "Interested");
    
    // 2. HP
    report += buildCategorySection("HP", "HP");

    // 3. Future Lead
    report += buildCategorySection("Future Lead", "Future Lead");

    // 4. Not Interested
    report += buildCategorySection("Not Interested", "Not Interested");

    // 5. Remaining (Not Called)
    const remaining = callList.filter(c => c.mainStatus === 'Not Called');
    if (remaining.length > 0) {
        report += `--- Remaining (Not Called) (${remaining.length})\n\n`;
        remaining.forEach(call => {
            report += `${call.phone}\n\n`;
        });
    }

    return report.trim();
}

// Share Modal handling
function openShareModal() {
    const reportText = generateReportText();
    elements.reportPreview.value = reportText;
    elements.shareModal.style.display = 'flex';
}

function closeShareModal() {
    elements.shareModal.style.display = 'none';
}

// Handle Copying Report
function handleCopyReport() {
    const reportText = elements.reportPreview.value;
    navigator.clipboard.writeText(reportText).then(() => {
        const origText = elements.btnCopyReport.innerHTML;
        elements.btnCopyReport.innerHTML = "✅ Copied!";
        setTimeout(() => {
            elements.btnCopyReport.innerHTML = origText;
        }, 2000);
    }).catch(err => {
        console.error("Failed to copy", err);
        alert("Failed to copy automatically. Please select text and copy manually.");
    });
}

// Handle Web Share Native API (fallback to copy)
function handleNativeShare() {
    const reportText = elements.reportPreview.value;
    
    if (navigator.share) {
        navigator.share({
            title: 'Call Status Report',
            text: reportText
        }).then(() => {
            console.log("Shared successfully");
        }).catch(err => {
            console.log("Share failed or cancelled", err);
        });
    } else {
        // Fallback: Copy to clipboard and alert
        navigator.clipboard.writeText(reportText).then(() => {
            alert("Native sharing is not supported on this browser/device. The report has been copied to your clipboard so you can paste it in WhatsApp or elsewhere.");
        }).catch(() => {
            alert("Sharing not supported. Please copy the text from the preview area.");
        });
    }
}

// Export Report as TXT File
function handleExportReport() {
    const reportText = generateReportText();
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const now = new Date();
    const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `call_report_${dateStamp}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Reset Entire Workspace
function handleResetApp() {
    const confirmation = confirm("Are you sure you want to RESET the dashboard? This will remove all loaded phone numbers and current status logs. This action cannot be undone.");
    if (confirmation) {
        callList = [];
        localStorage.removeItem('aol_call_dashboard_data');
        handleClearSearch();
        showInputSection();
        render();
    }
}
