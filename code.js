 // Global variables
        let currentChart = null;
        let currentCountryCode = null;
        let currentCountryName = null;
        let currentChartType = "bar";
        let countriesDatabase = [];  // Will store { name, code } from API
        let isCountriesLoaded = false;

        // DOM elements
        const countrySearch = document.getElementById('countrySearch');
        const suggestionsDiv = document.getElementById('suggestions');
        const loadBtn = document.getElementById('loadBtn');
        const barBtn = document.getElementById('barBtn');
        const lineBtn = document.getElementById('lineBtn');
        const pieBtn = document.getElementById('pieBtn');
        const canvas = document.getElementById('gdpChart');
        const loadingDiv = document.getElementById('loading');
        const errorDiv = document.getElementById('errorMsg');
        const countryInfoDiv = document.getElementById('countryInfo');
        const statusBadge = document.getElementById('statusBadge');

        // --------------------------------------------------------------
        // STEP 1: Fetch all available countries from World Bank API
        // --------------------------------------------------------------
        async function fetchCountriesFromWorldBank() {
            statusBadge.textContent = '📡 Fetching country list from World Bank API...';
            statusBadge.style.display = 'block';
            
            try {
                // World Bank API returns countries in pages. Use per_page=300 to get most
                const url = 'https://api.worldbank.org/v2/country?format=json&per_page=300';
                const response = await fetch(url);
                
                if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
                
                const data = await response.json();
                
                // The countries are in data[1] array
                const countriesData = data[1];
                
                if (!countriesData || countriesData.length === 0) {
                    throw new Error('No country data received from API');
                }
                
                // Filter and transform: only include countries (not regions/aggregates)
                // World Bank API includes regions like "Africa" (iso2Code = "A9") - filter those out
                // Valid country ISO codes are 2 letters, always alphabetic
                const validCountries = countriesData.filter(item => {
                    const code = item.iso2Code;
                    // Only include items with valid 2-letter codes (A-Z, A-Z)
                    // Also exclude "1A", "1W" etc. which are aggregates
                    return code && /^[A-Z]{2}$/.test(code) && item.name !== "World";
                });
                
                // Transform to our format: { name, code }
                countriesDatabase = validCountries.map(item => ({
                    name: item.name,
                    code: item.iso2Code
                }));
                
                // Sort alphabetically by name for better UX
                countriesDatabase.sort((a, b) => a.name.localeCompare(b.name));
                
                isCountriesLoaded = true;
                statusBadge.textContent = `✅ Loaded ${countriesDatabase.length} countries from World Bank API`;
                
                // Hide status after 3 seconds
                setTimeout(() => {
                    statusBadge.style.display = 'none';
                }, 3000);
                
                return countriesDatabase;
                
            } catch (error) {
                console.error('Error fetching countries:', error);
                statusBadge.textContent = '⚠️ Could not load country list. Using fallback search.';
                statusBadge.style.color = '#ff6b6b';
                
                // Return empty array - search won't work but at least we tried
                return [];
            }
        }

        // Filter countries based on search input
        function filterCountries(searchTerm, maxResults = 15) {
            if (!searchTerm || searchTerm.length < 2) return [];
            
            const term = searchTerm.toLowerCase();
            const matches = countriesDatabase.filter(country => 
                country.name.toLowerCase().includes(term)
            );
            
            return matches.slice(0, maxResults);
        }

        // Show suggestions dropdown
        function showSuggestions() {
            const searchTerm = countrySearch.value;
            if (searchTerm.length < 2 || !isCountriesLoaded) {
                suggestionsDiv.style.display = 'none';
                return;
            }

            const matches = filterCountries(searchTerm);
            if (matches.length === 0) {
                suggestionsDiv.style.display = 'none';
                return;
            }

            suggestionsDiv.innerHTML = '';
            matches.forEach(match => {
                const div = document.createElement('div');
                div.textContent = `${match.name} (${match.code})`;
                div.onclick = () => {
                    countrySearch.value = match.name;
                    currentCountryCode = match.code;
                    currentCountryName = match.name;
                    suggestionsDiv.style.display = 'none';
                };
                suggestionsDiv.appendChild(div);
            });
            suggestionsDiv.style.display = 'block';
        }

        // Fetch GDP data from World Bank API for a specific country
        async function fetchGDPData(countryCode) {
            const url = `https://api.worldbank.org/v2/country/${countryCode}/indicator/NY.GDP.MKTP.CD?format=json`;
            
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
                const data = await response.json();
                if (!data[1] || data[1].length === 0) throw new Error('No GDP data found');
                
                // Filter out null values and get last 10 years
                const validData = data[1].filter(item => item.value !== null).slice(0, 10);
                if (validData.length === 0) throw new Error('No valid GDP data available');
                
                // Reverse so oldest years come first (better chart display)
                const years = validData.map(item => item.date).reverse();
                const gdpValues = validData.map(item => parseFloat(item.value)).reverse();
                
                return { years, gdpValues };
            } catch (error) {
                console.error('Fetch error:', error);
                throw error;
            }
        }

        // Create or update chart
        function createChart(years, gdpValues, countryName, chartType) {
            if (currentChart) {
                currentChart.destroy();
                currentChart = null;
            }

            const ctx = canvas.getContext('2d');
            const gdpBillions = gdpValues.map(v => v / 1000000000);

            // Color palette for pie/doughnut
            const colors = [
                'rgba(54, 162, 235, 0.8)',
                'rgba(255, 99, 132, 0.8)',
                'rgba(255, 206, 86, 0.8)',
                'rgba(75, 192, 192, 0.8)',
                'rgba(153, 102, 255, 0.8)',
                'rgba(255, 159, 64, 0.8)',
                'rgba(199, 199, 199, 0.8)',
                'rgba(83, 102, 255, 0.8)',
                'rgba(255, 99, 255, 0.8)',
                'rgba(99, 255, 132, 0.8)'
            ];

            // For pie chart, we need labels in a readable format
            const isPie = chartType === 'pie';
            const ispolar = chartType === "polarArea";
            const isdoughnut = chartType === "doughnut";
            const isradar = chartType === "radar";
            
            let chartConfig = {
                type: chartType,
                data: {
                    labels: isPie ? years.map(y => `Year ${y}`) : years,
                    datasets: [{
                        label: `${countryName} GDP (Billions USD)`,
                        data: gdpBillions,
                        backgroundColor: isPie ? colors : 'rgba(54, 162, 235, 0.7)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1,
                        borderRadius: isPie ? 0 : 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const value = context.raw;
                                    if (chartType === 'pie') {
                                        return `${context.label}: $${value.toFixed(1)} Billion USD`;
                                    }
                                    return `$${value.toFixed(1)} Billion USD`;
                                }
                            }
                        },
                        legend: {
                            position: isPie ? 'right' : 'top',
                        }
                    }
                }
            };
            
            // Only add scales if not a pie chart
            if (!isPie) {
                chartConfig.options.scales = {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'USD (Billions)' }
                    },
                    x: {
                        title: { display: true, text: 'Year' }
                    }
                };
            }

            currentChart = new Chart(ctx, chartConfig);
        }

        // Main function to load and display chart
        async function loadAndDisplayChart() {
            const searchValue = countrySearch.value;
            
            if (!searchValue) {
                errorDiv.style.display = 'block';
                errorDiv.textContent = 'Please search and select a country first.';
                setTimeout(() => errorDiv.style.display = 'none', 3000);
                return;
            }
            
            // If we don't have a country code set from selection, try to find it
            if (!currentCountryCode || currentCountryName !== searchValue) {
                const foundCountry = countriesDatabase.find(c => 
                    c.name.toLowerCase() === searchValue.toLowerCase()
                );
                
                if (foundCountry) {
                    currentCountryCode = foundCountry.code;
                    currentCountryName = foundCountry.name;
                    countrySearch.value = foundCountry.name;
                } else {
                    errorDiv.style.display = 'block';
                    errorDiv.textContent = `"${searchValue}" not found in World Bank database. Please select from suggestions.`;
                    setTimeout(() => errorDiv.style.display = 'none', 4000);
                    return;
                }
            }

            loadingDiv.style.display = 'block';
            errorDiv.style.display = 'none';
            canvas.style.opacity = '0.5';
            loadBtn.disabled = true;

            try {
                const { years, gdpValues } = await fetchGDPData(currentCountryCode);
                createChart(years, gdpValues, currentCountryName, currentChartType);
                countryInfoDiv.innerHTML = `📊 Last 10 years of GDP data for ${currentCountryName} (Current US$) — World Bank`;
                loadingDiv.style.display = 'none';
                canvas.style.opacity = '1';
            } catch (error) {
                loadingDiv.style.display = 'none';
                canvas.style.opacity = '1';
                errorDiv.style.display = 'block';
                errorDiv.textContent = `Error: Could not load GDP data for ${currentCountryName}. Some countries may have limited data.`;
                console.error(error);
            } finally {
                loadBtn.disabled = false;
            }
        }

        // Change chart type
        function setChartType(type) {
            currentChartType = type;
            
            // Update button active states
            barBtn.classList.remove('active');
            lineBtn.classList.remove('active');
            pieBtn.classList.remove('active');
            if (type === 'bar') barBtn.classList.add('active');
            if (type === 'line') lineBtn.classList.add('active');
            if (type === 'pie') pieBtn.classList.add('active');
            
            // If we have existing data, redraw the chart
            if (currentCountryCode) {
                // Reload and redraw with new chart type
                loadAndDisplayChart();
            }
        }

        // Initialize the app
        async function init() {
            // Show loading state for countries
            countrySearch.placeholder = "Loading country list from World Bank...";
            countrySearch.disabled = true;
            
            // Fetch countries from World Bank API
            await fetchCountriesFromWorldBank();
            
            // Enable search after countries loaded
            countrySearch.disabled = false;
            countrySearch.placeholder = "Start typing a country name (e.g., Pakistan, Brazil)";
            
            // Add event listeners
            countrySearch.addEventListener('input', showSuggestions);
            loadBtn.addEventListener('click', loadAndDisplayChart);
            barBtn.addEventListener('click', () => setChartType('bar'));
            lineBtn.addEventListener('click', () => setChartType('line'));
            pieBtn.addEventListener('click', () => setChartType('pie'));
            
            // Hide suggestions when clicking outside
            document.addEventListener('click', (e) => {
                if (!countrySearch.contains(e.target) && !suggestionsDiv.contains(e.target)) {
                    suggestionsDiv.style.display = 'none';
                }
            });
            
            // Enter key to load
            countrySearch.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    loadAndDisplayChart();
                }
            });
            
            // Load default country on page load
            const defaultCountry = countriesDatabase.find(c => c.code === 'PK');
            if (defaultCountry) {
                countrySearch.value = defaultCountry.name;
                currentCountryCode = defaultCountry.code;
                currentCountryName = defaultCountry.name;
                loadAndDisplayChart();
            } else if (countriesDatabase.length > 0) {
                countrySearch.value = countriesDatabase[0].name;
                currentCountryCode = countriesDatabase[0].code;
                currentCountryName = countriesDatabase[0].name;
                loadAndDisplayChart();
            }
        }
        
        // Start the app
        init();