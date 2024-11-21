// this is the start of the map 
var map = L.map('mapid').setView([49.2827, -123.1207], 10); // center on Vancouver city coz we here
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
}).addTo(map);

// Array to store emergency reports
let reports = [];
let mapMarkers = []

// Form submission
document.getElementById("emergencyForm").addEventListener("submit", function(event) {
  event.preventDefault();
  const locationName = document.getElementById("location").value;
  // Get form data
  let report = {
    name: document.getElementById("reporterName").value,
    phone: document.getElementById("reporterPhone").value,
    type: document.getElementById("emergencyType").value,
    location: locationName,
    pictureLink: document.getElementById("pictureLink").value,
    comments: document.getElementById("comments").value,
    time: new Date().toLocaleString(),
    status: "OPEN"  // Will make the deletion of markers when status is "CLOSED" is created in other words the code for changing the status is complted.
  };
  creating_long_lat(locationName,report.type);
  // Save report
  reports.push(report);
  displayReports();
});

  function creating_long_lat(locationName,type){ // Using the location from the fucking form to create a long and lat value using nominatim which is a part of openstreetmap.
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}`)
  .then(response => response.json())
  .then(data => {
    if (data.length > 0) {
      const latitude = data[0].lat;
      const longitude = data[0].lon;

      let marker = L.marker([latitude, longitude]).addTo(map)
      .bindPopup(`<strong>${locationName}</strong> <br> Type: ${type}`)
      .openPopup();

      mapMarkers.push(marker);
    } else {
      alert("Mc Dont know the correct spelling madharchod. Correct it and try again asshole.");
    }
  })
  .catch( error => {
    console.error('Error fetching geocoding data (nominatim):', error);
  });
}

// Function to display reports in list and map
function displayReports() {
  let reportList = document.getElementById("reports");
  reportList.innerHTML = '';

  reports.forEach((report, index) => {
    let listItem = document.createElement("li");
    listItem.innerText = `${report.time} - ${report.type} at ${report.location}`;
    listItem.onclick = () => { showReportDetails(report); };
    reportList.appendChild(listItem);
  });
}
