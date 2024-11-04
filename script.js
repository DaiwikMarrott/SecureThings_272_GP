// Initialize map
var map = L.map('mapid').setView([49.2827, -123.1207], 10); // Center on Vancouver
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
}).addTo(map);

// Array to store emergency reports
let reports = [];

// Form submission
document.getElementById("emergencyForm").addEventListener("submit", function(event) {
  event.preventDefault();

  // Get form data
  let report = {
    name: document.getElementById("reporterName").value,
    phone: document.getElementById("reporterPhone").value,
    type: document.getElementById("emergencyType").value,
    location: document.getElementById("location").value,
    pictureLink: document.getElementById("pictureLink").value,
    comments: document.getElementById("comments").value,
    time: new Date().toLocaleString(),
    status: "OPEN"
  };

  // Save report
  reports.push(report);
  displayReports();
});

// Function to display reports in list and map
function displayReports() {
  let reportList = document.getElementById("reports");
  reportList.innerHTML = '';

  reports.forEach((report, index) => {
    let listItem = document.createElement("li");
    listItem.innerText = `${report.time} - ${report.type} at ${report.location}`;
    listItem.onclick = () => { showReportDetails(report); };
    reportList.appendChild(listItem);

    // Add marker to map
    L.marker([49.2827, -123.1207]).addTo(map) // Example coordinates, update with geolocation logic if needed
      .bindPopup(`${report.type} at ${report.location}`)
      .on('click', () => { showReportDetails(report); });
  });
}

// Show report details
function showReportDetails(report) {
  alert(`Emergency Details:\n\nType: ${report.type}\nLocation: ${report.location}\nComments: ${report.comments}`);
}

// Placeholder for passcode management and DOM Storage API logic
// Team members can add functionality for editing, deleting, and password protection
