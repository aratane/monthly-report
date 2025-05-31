
// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const csvFileInput = document.getElementById('csvFile');
const loadingIndicator = document.getElementById('loading');
const dashboard = document.getElementById('dashboard');
const emptyState = document.getElementById('emptyState');
const errorState = document.getElementById('errorState');
const chartRow = document.getElementById('chartRow');
const dataSections = document.getElementById('dataSections');
const entityRadios = document.querySelectorAll('input[name="entity"]');
const fieldOptions = document.querySelectorAll('.field-option');

// Entity configurations
const entities = {
  SPTP: {
    name: "SPTP",
    locationOptions: ["SPTP", "TTL", "IPCTPK", "TPS"],
    fields: ["Category", "Jenis Insiden", "Severity", "Findings", "Lokasi", "Status"]
  },
  Pelindo: {
    name: "Pelindo",
    locationOptions: ["HO", "Regional 1", "Regional 2", "Regional 3", "Regional 4"],
    fields: ["Category", "Jenis Insiden", "Severity", "Findings", "Lokasi", "Status"]
  }
};

// Current settings
let currentEntity = "SPTP";
let selectedFields = new Set(["Category", "Jenis Insiden", "Severity", "Findings", "Lokasi", "Status"]);
let charts = {};

// Event Listeners
uploadArea.addEventListener('click', () => csvFileInput.click());

entityRadios.forEach(radio => {
  radio.addEventListener('change', function () {
    currentEntity = this.value;
    updateFieldOptions();
  });
});

fieldOptions.forEach(option => {
  option.addEventListener('change', function () {
    if (this.checked) {
      selectedFields.add(this.value);
    } else {
      selectedFields.delete(this.value);
    }
  });
});

csvFileInput.addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;

  loadingIndicator.classList.remove('d-none');
  dashboard.classList.add('d-none');
  emptyState.classList.add('d-none');
  errorState.classList.add('d-none');

  Papa.parse(file, {
    skipEmptyLines: true,
    complete: function (results) {
      try {
        processData(results.data);
      } catch (error) {
        showError("Error processing data: " + error.message);
      } finally {
        loadingIndicator.classList.add('d-none');
      }
    },
    error: function (error) {
      showError("Error parsing CSV: " + error.message);
      loadingIndicator.classList.add('d-none');
    }
  });
});

// Update field options based on selected entity
function updateFieldOptions() {
  // For simplicity, we're using the same fields for both entities in this example
  // You could customize this based on actual entity differences
  const entityFields = entities[currentEntity].fields;

  fieldOptions.forEach(option => {
    option.checked = selectedFields.has(option.value);
  });
}

// Process CSV data
function processData(allData) {
  // Find header row
  const headerIndex = allData.findIndex(row =>
    row.some(cell => cell && cell.toString().toLowerCase().includes('incident time')) &&
    row.some(cell => cell && cell.toString().toLowerCase().includes('category'))
  );

  if (headerIndex === -1) {
    throw new Error("CSV headers not found. Required columns: 'Incident Time' and 'Category'");
  }

  const headers = allData[headerIndex].map(h => h ? h.toString().trim() : '');
  const rows = allData.slice(headerIndex + 1).filter(row => row.length > 0 && row.some(cell => cell));

  // Clear previous data
  chartRow.innerHTML = '';
  dataSections.innerHTML = '';
  Object.values(charts).forEach(chart => chart.destroy());
  charts = {};

  // Helper function to get column index
  const getColumnIndex = (key) => {
    return headers.findIndex(h => h.toLowerCase() === key.toLowerCase());
  };

  // Count values in a column (only if column exists and is selected)
  const countValues = (columnName) => {
    if (!selectedFields.has(columnName)) return null;

    const index = getColumnIndex(columnName);
    if (index === -1) return null;

    const counts = {};
    let total = 0;

    rows.forEach(row => {
      const value = row[index] ? row[index].toString().trim() : null;
      if (value) {
        counts[value] = (counts[value] || 0) + 1;
        total++;
      }
    });

    return total > 0 ? { counts, total } : null;
  };

  // Count status values
  const countStatus = () => {
    if (!selectedFields.has("Status")) return null;

    const index = getColumnIndex("Status");
    if (index === -1) return null;

    const statusCounts = { Open: 0, Closed: 0 };
    let total = 0;

    rows.forEach(row => {
      const status = row[index] ? row[index].toString().trim() : '';
      if (status.toLowerCase() === 'open') {
        statusCounts.Open++;
        total++;
      } else if (status.toLowerCase() === 'closed') {
        statusCounts.Closed++;
        total++;
      }
    });

    return total > 0 ? { counts: statusCounts, total } : null;
  };

  // Get data for all possible columns
  const availableData = {
    category: { name: "Category", icon: "tags", data: countValues("Category") },
    type: { name: "Jenis Insiden", icon: "list-alt", data: countValues("Jenis Insiden") },
    severity: { name: "Severity", icon: "exclamation-triangle", data: countValues("Severity") },
    findings: { name: "Findings", icon: "search", data: countValues("Findings") },
    location: { name: "Lokasi", icon: "map-marker-alt", data: countValues("Lokasi") },
    status: { name: "Status", icon: "tasks", data: countStatus() }
  };

  // Create charts and tables for available data
  createCharts(availableData);
  createDataSections(availableData);

  // Show dashboard if we have data
  if (Object.values(availableData).some(item => item.data)) {
    dashboard.classList.remove('d-none');
    emptyState.classList.add('d-none');
  } else {
    showError("No data available for selected fields");
  }
}

// Create charts based on available data
function createCharts(data) {
  // Severity Chart
  if (data.severity.data) {
    const severityCtx = document.createElement('canvas');
    severityCtx.id = 'severityChart';
    const container = document.createElement('div');
    container.className = 'col-md-4';
    container.innerHTML = '<div class="chart-container"></div>';
    container.querySelector('.chart-container').appendChild(severityCtx);
    chartRow.appendChild(container);

    charts.severity = new Chart(severityCtx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(data.severity.data.counts),
        datasets: [{
          data: Object.values(data.severity.data.counts),
          backgroundColor: [
            'rgba(220, 53, 69, 0.8)', // Critical/High
            'rgba(255, 193, 7, 0.8)',  // Medium
            'rgba(40, 167, 69, 0.8)',  // Low
            'rgba(108, 117, 125, 0.8)' // Others
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Severity Distribution',
            font: { size: 14 }
          },
          legend: { position: 'bottom' }
        }
      }
    });
  }

  // Status Chart
  if (data.status.data) {
    const statusCtx = document.createElement('canvas');
    statusCtx.id = 'statusChart';
    const container = document.createElement('div');
    container.className = 'col-md-4';
    container.innerHTML = '<div class="chart-container"></div>';
    container.querySelector('.chart-container').appendChild(statusCtx);
    chartRow.appendChild(container);

    charts.status = new Chart(statusCtx, {
      type: 'pie',
      data: {
        labels: Object.keys(data.status.data.counts),
        datasets: [{
          data: Object.values(data.status.data.counts),
          backgroundColor: [
            'rgba(255, 193, 7, 0.8)', // Open
            'rgba(40, 167, 69, 0.8)'  // Closed
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Status Overview',
            font: { size: 14 }
          },
          legend: { position: 'bottom' }
        }
      }
    });
  }

  // Top Categories Chart
  if (data.category.data) {
    const categoryEntries = Object.entries(data.category.data.counts).sort((a, b) => b[1] - a[1]);
    const topCategories = categoryEntries.slice(0, 5);

    const categoryCtx = document.createElement('canvas');
    categoryCtx.id = 'categoryChart';
    const container = document.createElement('div');
    container.className = 'col-md-4';
    container.innerHTML = '<div class="chart-container"></div>';
    container.querySelector('.chart-container').appendChild(categoryCtx);
    chartRow.appendChild(container);

    charts.category = new Chart(categoryCtx, {
      type: 'bar',
      data: {
        labels: topCategories.map(item => item[0]),
        datasets: [{
          label: 'Incidents',
          data: topCategories.map(item => item[1]),
          backgroundColor: 'rgba(29, 53, 87, 0.8)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Top 5 Categories',
            font: { size: 14 }
          },
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }
}

// Create data sections based on available data
function createDataSections(data) {
  // Fields that should show percentages
  const percentageFields = new Set(["Category", "Jenis Insiden", "Severity", "Status"]);

  for (const [key, section] of Object.entries(data)) {
    if (section.data) {
      const sectionDiv = document.createElement('div');
      sectionDiv.className = 'col-md-6 mb-4';

      const showPercentage = percentageFields.has(section.name);

      const cardHTML = `
            <div class="card shadow-sm h-100">
              <div class="card-header bg-primary text-white">
                <h5 class="mb-0"><i class="fas fa-${section.icon} me-2"></i>${section.name}</h5>
              </div>
              <div class="card-body p-0">
                <div class="table-responsive">
                  <table class="table table-hover mb-0" id="${key}Table">
                    <thead class="bg-light">
                      <tr>
                        <th>${section.name}</th>
                        <th>Count</th>
                        ${showPercentage ? '<th>%</th>' : ''}
                      </tr>
                    </thead>
                    <tbody></tbody>
                  </table>
                </div>
              </div>
            </div>
          `;

      sectionDiv.innerHTML = cardHTML;
      dataSections.appendChild(sectionDiv);

      // Populate the table
      renderTable(`${key}Table`, section.data, key === 'severity', showPercentage);
    }
  }
}

// Render a data table
function renderTable(tableId, data, isSeverity = false, showPercentage = true) {
  const tableBody = document.getElementById(tableId).querySelector('tbody');
  tableBody.innerHTML = '';

  const sortedEntries = Object.entries(data.counts).sort((a, b) => b[1] - a[1]);

  sortedEntries.forEach(([key, value]) => {
    const row = document.createElement('tr');

    // Apply special styling for severity and status
    if (isSeverity) {
      row.classList.add(`severity-${key.toLowerCase()}`);
    } else if (tableId.includes('status')) {
      row.classList.add(`status-${key.toLowerCase()}`);
    }

    // Calculate percentage if needed
    const percentage = showPercentage ? ((value / data.total) * 100).toFixed(1) : null;

    // Build row HTML
    let rowHTML = `
          <td>${key}</td>
          <td>${value}</td>
        `;

    if (showPercentage) {
      rowHTML += `<td>${percentage}%</td>`;
    }

    row.innerHTML = rowHTML;
    tableBody.appendChild(row);
  });
}

// Show error message
function showError(message) {
  errorState.textContent = message;
  errorState.classList.remove('d-none');
  dashboard.classList.add('d-none');
  emptyState.classList.add('d-none');
}

// Drag and drop functionality
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.style.borderColor = 'var(--soc-blue)';
  uploadArea.style.backgroundColor = 'var(--soc-light)';
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.style.borderColor = '#dee2e6';
  uploadArea.style.backgroundColor = 'white';
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.style.borderColor = '#dee2e6';
  uploadArea.style.backgroundColor = 'white';

  if (e.dataTransfer.files.length) {
    csvFileInput.files = e.dataTransfer.files;
    const event = new Event('change');
    csvFileInput.dispatchEvent(event);
  }
});
