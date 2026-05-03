
let currentChart = null;
        
        // Get DOM elements
        const countrySelect = document.getElementById('countrySelect');
        const changeformat = document.querySelector("#change-format")
        const loadBtn = document.getElementById('loadBtn');
        const canvas = document.getElementById('gdpChart');
        const loadingDiv = document.getElementById('loading');
        const errorDiv = document.getElementById('errorMsg');
        
        // Function to fetch GDP data for a country
        async function fetchGDPData(countryCode) {
            const url = `https://api.worldbank.org/v2/country/${countryCode}/indicator/NY.GDP.MKTP.CD?format=json`;
            
            try {
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`HTTP error: ${response.status}`);
                }
                
                const data = await response.json();
                
                // Check if data exists
                if (!data[1] || data[1].length === 0) {
                    throw new Error('No GDP data found for this country');
                }
                
                // Filter out null values and get last 10 years
                const validData = data[1].filter(item => item.value !== null).slice(0, 10);
                
                if (validData.length === 0) {
                    throw new Error('No valid GDP data available');
                }
                
                // Extract years and GDP values (reverse so oldest to newest)
                const years = validData.map(item => item.date).reverse();
                const gdpValues = validData.map(item => parseFloat(item.value)).reverse();
                
                return { years, gdpValues, countryCode };
                
            } catch (error) {
                console.error('Fetch error:', error);
                throw error;
            }
        }
        
        // Function to create or update the chart
        function createChart(years, gdpValues, countryCode) {
            // Destroy existing chart if it exists
            if (currentChart) {
                currentChart.destroy();
                currentChart = null;
            }
            
            // Get country name from select dropdown
            const countryName = countrySelect.options[countrySelect.selectedIndex].text;
            const formatselect = changeformat.options[changeformat.selectedIndex].text;

            // Create new chart
            const ctx = canvas.getContext('2d');
            currentChart = new Chart(ctx, {
                type: `${formatselect}`,
                data: {
                    labels: years,
                    datasets: [{
                        label: `${countryName} GDP (Billions USD)`,
                        data: gdpValues.map(v => v / 1000000000),
                        backgroundColor: 'rgba(54, 162, 235, 0.7)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1,
                        borderRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `$${context.raw.toFixed(1)} Billion USD`;
                                }
                            }
                        },
                        legend: {
                            position: 'top',
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'USD (Billions)'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Year'
                            }
                        }
                    }
                }
            });
        }
        
        // Main function to load data and update chart
        async function loadAndDisplayChart() {
            const countryCode = countrySelect.value;
            
            // Show loading, hide error
            loadingDiv.style.display = 'block';
            errorDiv.style.display = 'none';
            canvas.style.opacity = '0.5';
            
            try {
                // Fetch data
                const { years, gdpValues } = await fetchGDPData(countryCode);
                
                // Create or update chart
                createChart(years, gdpValues, countryCode);
                
                // Hide loading
                loadingDiv.style.display = 'none';
                canvas.style.opacity = '1';
                
            } catch (error) {
                // Show error message
                loadingDiv.style.display = 'none';
                canvas.style.opacity = '1';
                errorDiv.style.display = 'block';
                errorDiv.textContent = `Error: ${error.message}. Please try another country.`;
                console.error(error);
            }
        }
        
        // Load data when button is clicked
        loadBtn.addEventListener('click', loadAndDisplayChart);
        
        // Also load when dropdown changes (optional)
        countrySelect.addEventListener('change', loadAndDisplayChart);
        
        // Load default country (Pakistan) when page loads
        loadAndDisplayChart();