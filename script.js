// Global variables
let cmsData = [];
let currentSurgeryData = [];
let processedProviders = [];
let currentSurgeryType = "27447"; // Default to knee surgery
let currentRankingType = "services"; // Default to ranking by services
let currentStateCode = null; // Track current state for state page
let currentStateName = null; // Track current state name for state page

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Hide ALL content immediately to prevent any jumping
    hideAllContent();
    
    // Restore surgery type from localStorage or default to knee
    const savedSurgeryType = localStorage.getItem('selectedSurgeryType');
    if (savedSurgeryType) {
        currentSurgeryType = savedSurgeryType;
    }
    
    // Restore ranking type from localStorage or default to services
    const savedRankingType = localStorage.getItem('selectedRankingType');
    if (savedRankingType) {
        currentRankingType = savedRankingType;
    }
    
    // Set toggle states immediately to prevent flicker
    setToggleStatesImmediately();
    
    // Use requestAnimationFrame to ensure DOM is fully ready
    requestAnimationFrame(() => {
        // Restore toggle styling
        restoreSurgeryTypeSelection();
        restoreRankingTypeSelection();
        
        // Load data
        loadData();
        
        // Initialize event listeners
        initializeEventListeners();
        
        // Show content only after everything is completely ready
        requestAnimationFrame(() => {
            showAllContent();
        });
    });
});

// Set toggle states immediately to prevent flicker
function setToggleStatesImmediately() {
    // Set surgery type toggles
    const surgeryToggles = document.querySelectorAll('input[name="surgeryType"]');
    surgeryToggles.forEach(toggle => {
        if (toggle.value === currentSurgeryType) {
            toggle.checked = true;
        } else {
            toggle.checked = false;
        }
    });
    
    // Set ranking type toggles
    const rankingToggles = document.querySelectorAll('input[name="rankingType"]');
    rankingToggles.forEach(toggle => {
        if (toggle.value === currentRankingType) {
            toggle.checked = true;
        } else {
            toggle.checked = false;
        }
    });
}

// Load and process the JSON data
function loadData() {
    try {
        // Use embedded data instead of fetching from file
        cmsData = window.CMS_DATA.CMS_Data;
        
        // Filter data based on current surgery type
        filterSurgeryData();
        
        // Process providers data
        processProvidersData();
        
        // Initialize page-specific functionality
        if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
            displayTopProviders();
        }
        
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Failed to load data. Please refresh the page.');
    }
}

// Filter data based on current surgery type
function filterSurgeryData() {
    currentSurgeryData = cmsData.filter(record => record.HCPCS_Cd === currentSurgeryType);
}

// Process providers data to aggregate by provider
function processProvidersData() {
    const providerMap = new Map();
    const stateProviderMap = new Map(); // Track providers by state for state rankings
    
    currentSurgeryData.forEach(record => {
        const key = `${record.Rndrng_Prvdr_First_Name} ${record.Rndrng_Prvdr_Last_Org_Name}`;
        const state = record.State;
        
        if (providerMap.has(key)) {
            const existing = providerMap.get(key);
            existing.Tot_Srvcs += record.Tot_Srvcs;
            existing.rvu += record.rvu;
        } else {
            // Create full name with credentials
            const credentials = record.Credentials || '';
            const fullNameWithCredentials = credentials ? `${record.Rndrng_Prvdr_First_Name} ${record.Rndrng_Prvdr_Last_Org_Name}, ${credentials}` : key;
            
            const providerData = {
                firstName: record.Rndrng_Prvdr_First_Name,
                lastName: record.Rndrng_Prvdr_Last_Org_Name,
                fullName: fullNameWithCredentials,
                credentials: credentials,
                state: state,
                Tot_Srvcs: record.Tot_Srvcs,
                rvu: record.rvu,
                Avg_Sbmtd_Chrg: record.Avg_Sbmtd_Chrg,
                Avg_Mdcr_Alowd_Amt: record.Avg_Mdcr_Alowd_Amt,
                Avg_Mdcr_Pymt_Amt: record.Avg_Mdcr_Pymt_Amt,
                Avg_Mdcr_Stdzd_Amt: record.Avg_Mdcr_Stdzd_Amt
            };
            
            providerMap.set(key, providerData);
            
            // Add to state tracking
            if (!stateProviderMap.has(state)) {
                stateProviderMap.set(state, []);
            }
            stateProviderMap.get(state).push(providerData);
        }
    });
    
    // Convert to array and sort based on current ranking type
    processedProviders = Array.from(providerMap.values())
        .sort((a, b) => {
            if (currentRankingType === "payment") {
                return b.Avg_Mdcr_Pymt_Amt - a.Avg_Mdcr_Pymt_Amt;
            } else {
                return b.Tot_Srvcs - a.Tot_Srvcs;
            }
        });
    
    // Calculate national and state rankings for each provider
    processedProviders.forEach((provider, index) => {
        // Set national rank (index + 1 since array is already sorted nationally)
        provider.nationalRank = index + 1;
        
        // Calculate state rank
        const stateProviders = stateProviderMap.get(provider.state) || [];
        const sortedStateProviders = stateProviders.sort((a, b) => {
            if (currentRankingType === "payment") {
                return b.Avg_Mdcr_Pymt_Amt - a.Avg_Mdcr_Pymt_Amt;
            } else {
                return b.Tot_Srvcs - a.Tot_Srvcs;
            }
        });
        
        const stateRank = sortedStateProviders.findIndex(p => p.fullName === provider.fullName) + 1;
        provider.stateRank = stateRank;
    });
}

// Display top 10 providers on homepage
function displayTopProviders() {
    const loadingElement = document.getElementById('loading');
    const scoreboardElement = document.getElementById('scoreboard');
    
    if (!scoreboardElement) return;
    
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
    
    const top10 = processedProviders.slice(0, 10);
    
    scoreboardElement.innerHTML = top10.map((provider, index) => {
        const rank = index + 1;
        const rankClass = rank <= 3 ? `top-${rank}` : '';
        const totalPayment = provider.Tot_Srvcs * provider.Avg_Mdcr_Pymt_Amt;
        
        return `
            <div class="provider-card ${rankClass}">
                <div class="rank ${rankClass}">
                    <div class="national-rank">#${rank}</div>
                    <div class="state-rank">#${provider.stateRank || 1} in ${provider.state || 'State'}</div>
                </div>
                <div class="provider-info">
                    <div class="provider-name">${provider.fullName}</div>
                    <div class="provider-stats">
                        <div class="stat">
                            <div class="stat-label" data-label="Total Services">Total Services</div>
                            <div class="stat-value">${provider.Tot_Srvcs}</div>
                        </div>
                        <div class="stat">
                            <div class="stat-label" data-label="RVU">RVU</div>
                            <div class="stat-value">${formatNumber(provider.rvu)}</div>
                        </div>
                        <div class="stat">
                            <div class="stat-label" data-label="Avg Payment">Avg Payment</div>
                            <div class="stat-value">$${formatCurrency(provider.Avg_Mdcr_Pymt_Amt)}</div>
                        </div>
                        <div class="stat">
                            <div class="stat-label" data-label="Total Payment">Total Payment</div>
                            <div class="stat-value">$${formatCurrency(totalPayment)}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Initialize event listeners
function initializeEventListeners() {
    // Provider search form
    const searchForm = document.getElementById('providerSearchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', handleProviderSearch);
    }
    
    // Initialize Leaflet map
    initializeLeafletMap();
    
    // Close state results
    const closeBtn = document.getElementById('closeStateResults');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeStateResults);
    }
    
    // Surgery type toggle
    const surgeryToggles = document.querySelectorAll('input[name="surgeryType"]');
    surgeryToggles.forEach(toggle => {
        toggle.addEventListener('change', handleSurgeryTypeChange);
    });
    
    // Ranking type toggle
    const rankingToggles = document.querySelectorAll('input[name="rankingType"]');
    rankingToggles.forEach(toggle => {
        toggle.addEventListener('change', handleRankingTypeChange);
    });
    
    // Initialize toggle styling
    updateToggleStyling();
}

// Handle surgery type change
function handleSurgeryTypeChange(event) {
    currentSurgeryType = event.target.value;
    
    // Save selection to localStorage
    localStorage.setItem('selectedSurgeryType', currentSurgeryType);

    // Update toggle styling
    updateToggleStyling();

    // Re-filter and process data
    filterSurgeryData();
    processProvidersData();

    // Update page content based on current page
    updatePageContent();
}

// Restore surgery type selection from localStorage
function restoreSurgeryTypeSelection() {
    // Toggle states are already set in setToggleStatesImmediately()
    // Just update the styling
    updateToggleStyling();
}

// Restore ranking type selection from localStorage
function restoreRankingTypeSelection() {
    // Toggle states are already set in setToggleStatesImmediately()
    // Just update the styling
    updateToggleStyling();
}

// Handle ranking type change
function handleRankingTypeChange(event) {
    currentRankingType = event.target.value;
    
    // Save selection to localStorage
    localStorage.setItem('selectedRankingType', currentRankingType);

    // Update toggle styling
    updateToggleStyling();

    // Re-process data with new ranking
    processProvidersData();

    // Update page content based on current page
    updatePageContent();
    
    // Prevent scroll effect on state page
    if (window.location.pathname.includes('state.html')) {
        event.preventDefault();
        return false;
    }
}

// Update toggle styling for better browser compatibility
function updateToggleStyling() {
    const surgeryToggles = document.querySelectorAll('input[name="surgeryType"]');
    surgeryToggles.forEach(toggle => {
        const label = toggle.closest('.toggle-label');
        if (toggle.checked) {
            label.style.backgroundColor = '#606060';
        } else {
            label.style.backgroundColor = 'transparent';
        }
    });
    
    const rankingToggles = document.querySelectorAll('input[name="rankingType"]');
    rankingToggles.forEach(toggle => {
        const label = toggle.closest('.toggle-label');
        if (toggle.checked) {
            label.style.backgroundColor = '#606060';
        } else {
            label.style.backgroundColor = 'transparent';
        }
    });
}

// Update page content based on current surgery type
function updatePageContent() {
    // Update page title
    updatePageTitle();
    
    // Update page-specific content
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        displayTopProviders();
    }
    
    // Update provider search results if visible
    const searchResults = document.getElementById('searchResults');
    if (searchResults && searchResults.style.display !== 'none') {
        // Re-run search with current data
        const firstName = document.getElementById('firstName')?.value;
        const lastName = document.getElementById('lastName')?.value;
        if (firstName && lastName) {
            handleProviderSearch({ preventDefault: () => {} });
        }
    }
    
    // Update state results if visible
    const stateResults = document.getElementById('stateResults');
    if (stateResults && stateResults.style.display !== 'none' && currentStateCode) {
        // Re-run state search with current data
        displayStateRankings(currentStateCode, currentStateName, false);
    }
}

// Update page title based on surgery type
function updatePageTitle() {
    const pageTitle = document.querySelector('.page-title');
    if (pageTitle) {
        // Check if we're on the provider page
        if (window.location.pathname.includes('provider.html')) {
            pageTitle.textContent = "Find Your Provider Ranking";
        } else {
            // For other pages, update based on surgery type
            if (currentSurgeryType === "27447") {
                pageTitle.textContent = "Who did the most total knee surgeries?";
            } else if (currentSurgeryType === "27130") {
                pageTitle.textContent = "Who did the most total hip surgeries?";
            }
        }
    }

    // Update page subtitle if it exists
    const pageSubtitle = document.querySelector('.page-subtitle');
    if (pageSubtitle) {
        if (currentSurgeryType === "27447") {
            pageSubtitle.textContent = "Click on a state to see the top 10 providers for total knee surgeries";
        } else if (currentSurgeryType === "27130") {
            pageSubtitle.textContent = "Click on a state to see the top 10 providers for total hip surgeries";
        }
    }
}

// Handle provider search
function handleProviderSearch(event) {
    event.preventDefault();
    
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    
    if (!firstName || !lastName) {
        showError('Please enter both first and last name.');
        return;
    }
    
    const fullName = `${firstName} ${lastName}`;
    const providerIndex = processedProviders.findIndex(provider => {
        // Check both the full name with credentials and without credentials
        const nameWithoutCredentials = `${provider.firstName} ${provider.lastName}`.toLowerCase();
        return provider.fullName.toLowerCase() === fullName.toLowerCase() || 
               nameWithoutCredentials === fullName.toLowerCase();
    });
    
    const searchResults = document.getElementById('searchResults');
    const errorMessage = document.getElementById('errorMessage');
    
    // Hide previous results
    if (searchResults) {
        searchResults.style.display = 'none';
        searchResults.classList.remove('fade-in');
        
        // Remove fade-in classes from all elements
        const yourRankingTitle = document.querySelector('.searched-provider-section h3');
        const yourRankingCard = document.querySelector('.searched-provider-section .provider-card');
        const fullListTitle = document.querySelector('.search-results-header h3');
        const providerCards = document.querySelectorAll('.search-results .provider-card');
        
        if (yourRankingTitle) yourRankingTitle.classList.remove('fade-in');
        if (yourRankingCard) yourRankingCard.classList.remove('fade-in');
        if (fullListTitle) fullListTitle.classList.remove('fade-in');
        providerCards.forEach(card => card.classList.remove('fade-in'));
    }
    if (errorMessage) errorMessage.style.display = 'none';
    
    if (providerIndex === -1) {
        showError(`Provider "${fullName}" not found in the database.`);
        return;
    }
    
    displayProviderRanking(providerIndex, fullName);
}

// Display provider ranking
function displayProviderRanking(providerIndex, fullName) {
    const rankingMessage = document.getElementById('rankingMessage');
    const providerRanking = document.getElementById('providerRanking');
    const searchResults = document.getElementById('searchResults');
    
    const rank = providerIndex + 1;
    const provider = processedProviders[providerIndex];
    
    // Create ranking display
    let rankingHTML = '';
    
    // Top 3 providers
    for (let i = 0; i < Math.min(3, processedProviders.length); i++) {
        const p = processedProviders[i];
        rankingHTML += createProviderCardHTML(p, i + 1, i < 3 ? `top-${i + 1}` : '');
    }
    
    // Add separator if the searched provider is not in top 3 and not immediately after
    if (providerIndex > 3) {
        rankingHTML += '<div class="ranking-separator">...</div>';
    }
    
    // Show 1 provider before the searched provider (if not in top 3)
    if (providerIndex > 3) {
        const beforeProvider = processedProviders[providerIndex - 1];
        rankingHTML += createProviderCardHTML(beforeProvider, providerIndex, '');
    }
    
    // Show the searched provider
    rankingHTML += createProviderCardHTML(provider, rank, 'highlighted');
    
    // Show 1 provider after the searched provider (if exists)
    if (providerIndex < processedProviders.length - 1) {
        const afterProvider = processedProviders[providerIndex + 1];
        rankingHTML += createProviderCardHTML(afterProvider, providerIndex + 2, '');
    }
    
    // Add separator before last 3 places if there are more providers after
    const totalProviders = processedProviders.length;
    const last3StartIndex = Math.max(0, totalProviders - 3);
    const showLast3 = providerIndex < last3StartIndex - 1;
    
    if (showLast3) {
        rankingHTML += '<div class="ranking-separator">...</div>';
        
        // Show last 3 providers
        for (let i = last3StartIndex; i < totalProviders; i++) {
            const p = processedProviders[i];
            rankingHTML += createProviderCardHTML(p, i + 1, '');
        }
    }
    
    if (providerRanking) {
        providerRanking.innerHTML = rankingHTML;
        providerRanking.style.opacity = '1';
        providerRanking.style.visibility = 'visible';
        providerRanking.style.transform = 'translateY(0)';
    }
    
    // Show the searched provider section at the top
    const searchedProviderSection = document.getElementById('searchedProviderSection');
    const searchedProviderCard = document.getElementById('searchedProviderCard');
    
    if (searchedProviderSection && searchedProviderCard) {
        searchedProviderCard.innerHTML = createProviderCardHTML(provider, rank, 'highlighted');
        searchedProviderSection.style.display = 'block';
    }
    
    if (searchResults) {
        searchResults.style.display = 'block';
        searchResults.style.visibility = 'visible';
        searchResults.style.opacity = '1';
        searchResults.style.transform = 'translateY(0)';
        
        // Staggered fade-in effects with equal time intervals
        const elements = [
            { selector: '.searched-provider-section h3', delay: 200 },
            { selector: '.searched-provider-section .provider-card', delay: 400 },
            { selector: '.search-results-header h3', delay: 600 }
        ];
        
        // Add the main elements with equal 200ms intervals
        elements.forEach(({ selector, delay }) => {
            setTimeout(() => {
                const element = document.querySelector(selector);
                if (element) {
                    element.classList.add('fade-in');
                }
            }, delay);
        });
        
        // Add provider cards with equal 200ms intervals starting at 800ms
        setTimeout(() => {
            const providerCards = document.querySelectorAll('.search-results .provider-card');
            providerCards.forEach((card, index) => {
                setTimeout(() => {
                    card.classList.add('fade-in');
                }, index * 200); // 0ms, 200ms, 400ms, 600ms, etc. for each card
            });
        }, 800);
    }
}

// Hide ALL content to prevent jumping
function hideAllContent() {
    // Hide main content areas
    const scoreboardElement = document.getElementById('scoreboard');
    const searchResults = document.getElementById('searchResults');
    const stateResults = document.getElementById('stateResults');
    const searchContainer = document.getElementById('searchContainer');
    const mapContainer = document.getElementById('mapContainer');
    
    if (scoreboardElement) {
        scoreboardElement.style.visibility = 'hidden';
        scoreboardElement.style.opacity = '0';
        
        // Remove fade-in classes from provider cards
        const providerCards = document.querySelectorAll('.scoreboard .provider-card');
        providerCards.forEach(card => {
            card.classList.remove('fade-in');
        });
    }
    if (searchResults) {
        searchResults.style.visibility = 'hidden';
        searchResults.style.opacity = '0';
    }
    if (stateResults) {
        stateResults.style.visibility = 'hidden';
        stateResults.style.opacity = '0';
    }
    if (searchContainer) {
        searchContainer.style.visibility = 'hidden';
        searchContainer.style.opacity = '0';
    }
    if (mapContainer) {
        mapContainer.style.visibility = 'hidden';
        mapContainer.style.opacity = '0';
    }
}

// Show ALL content after everything is loaded
function showAllContent() {
    // Show main content areas
    const scoreboardElement = document.getElementById('scoreboard');
    const searchResults = document.getElementById('searchResults');
    const stateResults = document.getElementById('stateResults');
    const searchContainer = document.getElementById('searchContainer');
    const mapContainer = document.getElementById('mapContainer');
    
    if (scoreboardElement) {
        scoreboardElement.style.visibility = 'visible';
        scoreboardElement.style.opacity = '1';
        
        // Staggered fade-in effects for provider cards on Top 10 page
        setTimeout(() => {
            const providerCards = document.querySelectorAll('.scoreboard .provider-card');
            providerCards.forEach((card, index) => {
                setTimeout(() => {
                    card.classList.add('fade-in');
                }, 100 + (index * 100)); // 100ms base delay + 100ms per item
            });
        }, 50); // Small delay to ensure HTML is rendered
    }
    if (searchResults) {
        searchResults.style.visibility = 'visible';
        searchResults.style.opacity = '1';
    }
    if (stateResults) {
        stateResults.style.visibility = 'visible';
        stateResults.style.opacity = '1';
    }
    if (searchContainer) {
        searchContainer.style.visibility = 'visible';
        searchContainer.style.opacity = '1';
    }
    if (mapContainer) {
        mapContainer.style.visibility = 'visible';
        mapContainer.style.opacity = '1';
    }
}

// Format currency with commas
function formatCurrency(amount) {
    return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Format numbers with commas (for RVU values)
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Create provider card HTML
function createProviderCardHTML(provider, rank, className) {
    const totalPayment = provider.Tot_Srvcs * provider.Avg_Mdcr_Pymt_Amt;
    
    return `
        <div class="provider-card ${className}">
            <div class="rank ${className}">
                <div class="national-rank">#${rank}</div>
                <div class="state-rank">#${provider.stateRank || 1} in ${provider.state || 'State'}</div>
            </div>
            <div class="provider-info">
                <div class="provider-name">${provider.fullName}</div>
                <div class="provider-stats">
                    <div class="stat">
                        <div class="stat-label" data-label="Total Services">Total Services</div>
                        <div class="stat-value">${provider.Tot_Srvcs}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label" data-label="RVU">RVU</div>
                        <div class="stat-value">${formatNumber(provider.rvu)}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label" data-label="Avg Payment">Avg Payment</div>
                        <div class="stat-value">$${formatCurrency(provider.Avg_Mdcr_Pymt_Amt)}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label" data-label="Total Payment">Total Payment</div>
                        <div class="stat-value">$${formatCurrency(totalPayment)}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Create provider card HTML for State page (reversed ranking display)
function createStateProviderCardHTML(provider, nationalRank, className) {
    const totalPayment = provider.Tot_Srvcs * provider.Avg_Mdcr_Pymt_Amt;
    
    return `
        <div class="provider-card ${className}">
            <div class="rank ${className}">
                <div class="state-rank-large">#${provider.stateRank || 1} in ${provider.state || 'State'}</div>
                <div class="national-rank-small">#${nationalRank} Full List</div>
            </div>
            <div class="provider-info">
                <div class="provider-name">${provider.fullName}</div>
                <div class="provider-stats">
                    <div class="stat">
                        <div class="stat-label" data-label="Total Services">Total Services</div>
                        <div class="stat-value">${provider.Tot_Srvcs}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label" data-label="RVU">RVU</div>
                        <div class="stat-value">${formatNumber(provider.rvu)}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label" data-label="Avg Payment">Avg Payment</div>
                        <div class="stat-value">$${formatCurrency(provider.Avg_Mdcr_Pymt_Amt)}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label" data-label="Total Payment">Total Payment</div>
                        <div class="stat-value">$${formatCurrency(totalPayment)}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Handle state click
function handleStateClick(event) {
    let stateCode, stateName;
    
    // Check if this is a Leaflet marker click (has target.dataset.state)
    if (event.target && event.target.dataset && event.target.dataset.state) {
        stateCode = event.target.dataset.state;
        stateName = getStateName(stateCode);
    } 
    // Check if this is an SVG state element click (has currentTarget.getAttribute)
    else if (event.currentTarget && event.currentTarget.getAttribute) {
        stateCode = event.currentTarget.getAttribute('data-state');
        const titleElement = event.currentTarget.querySelector('title');
        stateName = titleElement ? titleElement.textContent : getStateName(stateCode);
    }
    // Fallback for direct state code
    else if (typeof event === 'string') {
        stateCode = event;
        stateName = getStateName(stateCode);
    }
    
    if (stateCode) {
        // Store current state for ranking updates
        currentStateCode = stateCode;
        currentStateName = stateName;
        displayStateRankings(stateCode, stateName);
    }
}

// Display state rankings (demo with random assignment)
function displayStateRankings(stateCode, stateName, shouldScroll = true) {
    const stateResults = document.getElementById('stateResults');
    const selectedStateName = document.getElementById('selectedStateName');
    const stateRanking = document.getElementById('stateRanking');
    
    if (!stateResults) return;
    
    // Update state name
    if (selectedStateName) {
        selectedStateName.textContent = `Top 10 Providers in ${stateName}`;
    }
    
    // Get real providers for the selected state
    const stateProviders = getStateProviders(stateCode);
    
    // Generate ranking HTML
    let rankingHTML = '';
    
    if (stateProviders.length === 0) {
        rankingHTML = '<div class="no-providers-message">No providers found for this state.</div>';
    } else {
        stateProviders.forEach((provider, index) => {
            const stateRank = index + 1;
            rankingHTML += createStateProviderCardHTML(provider, provider.nationalRank, stateRank <= 3 ? `top-${stateRank}` : '');
        });
    }
    
    if (stateRanking) {
        stateRanking.innerHTML = rankingHTML;
    }
    
    stateResults.style.display = 'block';
    
    // Staggered fade-in effects for state provider cards
    setTimeout(() => {
        const stateProviderCards = document.querySelectorAll('.state-ranking .provider-card');
        stateProviderCards.forEach((card, index) => {
            setTimeout(() => {
                card.classList.add('fade-in');
            }, 100 + (index * 100)); // 100ms base delay + 100ms per item
        });
    }, 50); // Small delay to ensure HTML is rendered
    
    // Scroll to results only if shouldScroll is true
    if (shouldScroll) {
        stateResults.scrollIntoView({ behavior: 'smooth' });
    }
}

// Get providers for a specific state using real data
function getStateProviders(stateCode) {
    // Filter providers by the specified state
    const stateProviders = processedProviders.filter(provider => 
        provider.state === stateCode
    );
    
    // Sort based on current ranking type
    return stateProviders.sort((a, b) => {
        if (currentRankingType === "payment") {
            return b.Avg_Mdcr_Pymt_Amt - a.Avg_Mdcr_Pymt_Amt;
        } else {
            return b.Tot_Srvcs - a.Tot_Srvcs;
        }
    });
}

// Close state results
function closeStateResults() {
    const stateResults = document.getElementById('stateResults');
    if (stateResults) {
        stateResults.style.display = 'none';
        
        // Remove fade-in classes from state provider cards
        const stateProviderCards = document.querySelectorAll('.state-ranking .provider-card');
        stateProviderCards.forEach(card => {
            card.classList.remove('fade-in');
        });
    }
}

// Show error message
function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }
}

// Utility function to format numbers
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Initialize Leaflet map
function initializeLeafletMap() {
    // Check if we're on the state page
    if (!document.getElementById('usMap')) {
        return;
    }
    
    // Initialize the map centered on the US
    const map = L.map('usMap').setView([39.8283, -98.5795], 4);
    
    // Add OpenStreetMap tiles (free)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Add US states GeoJSON layer
    // For now, we'll use a simple approach with markers for each state
    // In a real implementation, you'd load a GeoJSON file with state boundaries
    
    // State coordinates (approximate centers)
    const stateCoordinates = {
        'CA': [36.7783, -119.4179], // California
        'TX': [31.9686, -99.9018],  // Texas
        'FL': [27.7663, -82.6404],  // Florida
        'NY': [42.1657, -74.9481],  // New York
        'IL': [40.3363, -89.0022],  // Illinois
        'PA': [41.2033, -77.1945], // Pennsylvania
        'OH': [40.3888, -82.7649],  // Ohio
        'GA': [33.0406, -83.6431],  // Georgia
        'NC': [35.6301, -79.8064],  // North Carolina
        'MI': [43.3266, -84.5361],  // Michigan
        'NJ': [40.2989, -74.5210],  // New Jersey
        'VA': [37.7693, -78.1699],  // Virginia
        'WA': [47.4009, -121.4905], // Washington
        'AZ': [33.7298, -111.4312], // Arizona
        'MA': [42.2373, -71.5314],  // Massachusetts
        'TN': [35.7478, -86.6923],  // Tennessee
        'IN': [39.8494, -86.2583],  // Indiana
        'MO': [38.4561, -92.2884],  // Missouri
        'MD': [39.0639, -76.8021],  // Maryland
        'WI': [44.2685, -89.6165],  // Wisconsin
        'CO': [39.0598, -105.3111], // Colorado
        'MN': [46.7296, -94.6859],  // Minnesota
        'SC': [33.8569, -80.9450],  // South Carolina
        'AL': [32.8067, -86.7911],  // Alabama
        'LA': [31.1695, -91.8678],  // Louisiana
        'KY': [37.6681, -84.6701],  // Kentucky
        'OR': [44.5721, -122.0709], // Oregon
        'OK': [35.5653, -96.9289],  // Oklahoma
        'CT': [41.5978, -72.7554],  // Connecticut
        'UT': [40.1505, -111.8624], // Utah
        'IA': [42.0115, -93.2105],  // Iowa
        'NV': [38.3135, -117.0554], // Nevada
        'AR': [34.9697, -92.3731],  // Arkansas
        'MS': [32.3200, -89.2077],  // Mississippi
        'KS': [38.5266, -96.7265],  // Kansas
        'NM': [34.8405, -106.2485], // New Mexico
        'NE': [41.1254, -98.2681],  // Nebraska
        'WV': [38.4912, -80.9545],  // West Virginia
        'ID': [44.2405, -114.4788], // Idaho
        'NH': [43.4525, -71.5639],  // New Hampshire
        'ME': [44.6939, -69.3819],  // Maine
        'RI': [41.6809, -71.5118],  // Rhode Island
        'MT': [46.9219, -110.4544], // Montana
        'DE': [39.3185, -75.5071],  // Delaware
        'SD': [44.2998, -99.4388],  // South Dakota
        'ND': [47.5289, -99.7840],  // North Dakota
        'VT': [44.0459, -72.7107],  // Vermont
        'WY': [41.1455, -107.3025], // Wyoming
        'DC': [38.9072, -77.0369],  // District of Columbia
        'AK': [61.3707, -152.4044], // Alaska
        'HI': [21.0943, -157.4983]  // Hawaii
    };
    
    // Add markers for each state
    Object.entries(stateCoordinates).forEach(([stateCode, coordinates]) => {
        const marker = L.marker(coordinates).addTo(map);
        marker.bindPopup(`<b>${getStateName(stateCode)}</b><br>Click to view rankings`);
        marker.on('click', () => handleStateClick(stateCode));
    });
}

// Get state name from state code
function getStateName(stateCode) {
    const stateNames = {
        'CA': 'California', 'TX': 'Texas', 'FL': 'Florida', 'NY': 'New York',
        'IL': 'Illinois', 'PA': 'Pennsylvania', 'OH': 'Ohio', 'GA': 'Georgia',
        'NC': 'North Carolina', 'MI': 'Michigan', 'NJ': 'New Jersey', 'VA': 'Virginia',
        'WA': 'Washington', 'AZ': 'Arizona', 'MA': 'Massachusetts', 'TN': 'Tennessee',
        'IN': 'Indiana', 'MO': 'Missouri', 'MD': 'Maryland', 'WI': 'Wisconsin',
        'CO': 'Colorado', 'MN': 'Minnesota', 'SC': 'South Carolina', 'AL': 'Alabama',
        'LA': 'Louisiana', 'KY': 'Kentucky', 'OR': 'Oregon', 'OK': 'Oklahoma',
        'CT': 'Connecticut', 'UT': 'Utah', 'IA': 'Iowa', 'NV': 'Nevada',
        'AR': 'Arkansas', 'MS': 'Mississippi', 'KS': 'Kansas', 'NM': 'New Mexico',
        'NE': 'Nebraska', 'WV': 'West Virginia', 'ID': 'Idaho', 'NH': 'New Hampshire',
        'ME': 'Maine', 'RI': 'Rhode Island', 'MT': 'Montana', 'DE': 'Delaware',
        'SD': 'South Dakota', 'ND': 'North Dakota', 'VT': 'Vermont', 'WY': 'Wyoming',
        'DC': 'District of Columbia', 'AK': 'Alaska', 'HI': 'Hawaii'
    };
    return stateNames[stateCode] || stateCode;
}

// Add some additional CSS for highlighted provider
const additionalCSS = `
    .provider-card.highlighted {
        background-color: #E2EBFF;
        border-color: #E2EBFF;
        border-width: 2px;
    }
    
    .provider-card.highlighted .provider-name {
        color: #000000;
        font-weight: 500;
    }
    
    .provider-card.highlighted .national-rank {
        color: #000000;
    }
    
    .provider-card.highlighted .state-rank {
        color: #666666;
    }
    
    .provider-card.highlighted .stat-label {
        color: #666666;
    }
    
    .provider-card.highlighted .stat-value {
        color: #000000;
    }
    
    .searched-provider-section {
        margin-bottom: 2rem;
        padding-bottom: 2rem;
        border-bottom: 1px solid #404040;
    }
    
    .searched-provider-section h3 {
        color: #ffffff;
        font-size: 1.5rem;
        font-weight: 300;
        margin-bottom: 1rem;
        text-align: left;
    }
    
    .full-list-heading {
        color: #ffffff;
        font-size: 1.5rem;
        font-weight: 300;
        margin: 0;
        text-align: left;
    }
    
    .search-results-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
        padding-bottom: 0;
        border-bottom: none;
    }
    
    /* Dark mode styling for top 3 on provider page only */
    .search-results .provider-card.top-1,
    .search-results .provider-card.top-2,
    .search-results .provider-card.top-3 {
        background-color: #333333;
        border-color: #404040;
    }
    
    .search-results .rank.top-1 .national-rank,
    .search-results .rank.top-2 .national-rank,
    .search-results .rank.top-3 .national-rank {
        color: #b0b0b0;
    }
    
    .search-results .rank.top-1 .state-rank,
    .search-results .rank.top-2 .state-rank,
    .search-results .rank.top-3 .state-rank {
        color: #808080;
    }
    
    .no-providers-message {
        text-align: center;
        color: #808080;
        font-size: 1.2rem;
        font-weight: 300;
        padding: 2rem;
        background-color: #333333;
        border: 1px solid #404040;
        border-radius: 6px;
    }
    
    /* State page specific ranking styles */
    .state-rank-large {
        font-size: 1.2rem;
        font-weight: 400;
        color: #ffffff;
        margin-bottom: 0.2rem;
    }
    
    .national-rank-small {
        font-size: 0.8rem;
        color: #808080;
        margin-top: 0.2rem;
    }
`;

// Add the additional CSS to the page
const style = document.createElement('style');
style.textContent = additionalCSS;
document.head.appendChild(style);
