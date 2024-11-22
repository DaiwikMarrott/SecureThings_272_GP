// Initialize the map
var map = L.map("mapid").setView([49.2827, -123.1207], 10); // center on Vancouver
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
}).addTo(map);

// Array to store emergency reports and map markers
let reports = [];
let mapMarkers = [];
let crossSymbol = "&#x274C;";

// Enabling Local Storage so that content does not vanish on page reload
function saveReportsToLocalStorage() {
  const reportsToSave = reports.map((report) => {
    const { marker, ...reportWithoutMarker } = report;
    return {
      ...reportWithoutMarker,
      markerPosition: marker ? marker.getLatLng() : null,
    };
  });
  localStorage.setItem("emergencyReports", JSON.stringify(reportsToSave));
}

async function loadReportsFromLocalStorage() {
  const storedReports = localStorage.getItem("emergencyReports");
  if (storedReports) {
    const parsedReports = JSON.parse(storedReports);
    reports = [];
    for (let report of parsedReports) {
      if (report.markerPosition) {
        const newReport = { ...report, marker: null };
        reports.push(newReport);
        await creating_long_lat(
          report.location,
          report.type,
          reports.length - 1
        );
      } else {
        reports.push(report);
      }
    }
    displayReports();
  }
}

// Formatting Date Time
function formatDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";

  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  hours = String(hours).padStart(2, "0");

  return `${year}-${month}-${day} (${hours}:${minutes} ${ampm})`;
}

// Form submission handler
async function handleFormSubmission(event) {
  event.preventDefault();

  const locationName = document.getElementById("location").value;

  // Create report object
  const report = {
    name: document.getElementById("reporterName").value,
    phone: document.getElementById("reporterPhone").value,
    type: document.getElementById("emergencyType").value,
    location: locationName,
    pictureLink: document.getElementById("pictureLink").value,
    comments: document.getElementById("comments").value,
    time: formatDateTime(new Date()),
    status: "OPEN",
    moreInfo: false,
    delete: false,
    marker: null,
  };

  // Process the report
  reports.push(report);
  try {
    await creating_long_lat(locationName, report.type, reports.length - 1);
    displayReports();
    saveReportsToLocalStorage();
  } catch (error) {
    console.error("Error processing report:", error);
    reports.pop(); // Remove the report if there was an error
  }

  // Reset form
  event.target.reset();

  return report;
}

// Attach the event listener
document
  .getElementById("emergencyForm")
  .addEventListener("submit", handleFormSubmission);

function creating_long_lat(locationName, type, reportIndex) {
  return new Promise((resolve, reject) => {
    const storedPosition = reports[reportIndex].markerPosition;
    if (storedPosition) {
      let geoMarker = L.marker([storedPosition.lat, storedPosition.lng])
        .addTo(map)
        .bindPopup(`<strong>${locationName}</strong> <br> Type: ${type}`)
        .openPopup();
      reports[reportIndex].marker = geoMarker;
      resolve();
    } else {
      fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          locationName
        )}&countrycodes=ca`
      )
        .then((response) => response.json())
        .then((data) => {
          if (data.length > 0) {
            console.log(data);
            const latitude = parseFloat(data[0].lat);
            const longitude = parseFloat(data[0].lon);
            const locationNameFromAPI = data[0].name;
            let geoMarker = L.marker([latitude, longitude])
              .addTo(map)
              .bindPopup(
                `<strong>${locationNameFromAPI}</strong> <br> Type: ${type}`
              )
              .openPopup();

            reports[reportIndex].marker = geoMarker;
            reports[reportIndex].location = locationNameFromAPI;
            reports[reportIndex].markerPosition = geoMarker.getLatLng();
            resolve();
          } else {
            alert(
              "Location not found. Please check the spelling and try again."
            );
            reject("Location not found");
          }
        })
        .catch((error) => {
          console.error("Error fetching geocoding data:", error);
          reject(error);
        });
    }
  });
}

function initTable(headers) {
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headers.forEach((key) => {
    const th = document.createElement("th");
    th.scope = "col";
    if (key === "moreInfo" || key === "delete") {
      th.textContent = "";
    } else if (key !== "marker") {
      th.textContent = key.charAt(0).toUpperCase() + key.slice(1);
    }
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  return thead;
}

function displayReports() {
  const reportList = document.getElementById("reports");
  reportList.innerHTML = ""; // Clear previous content
  const tableHeaders = [
    "location",
    "type",
    "time",
    "status",
    "moreInfo",
    "delete",
  ];
  if (reports.length > 0) {
    // const table = document.createElement("table");
    reportList.appendChild(initTable(tableHeaders));

    const tbody = document.createElement("tbody");
    reports.forEach((report, index) => {
      const reportDisplay = {
        location: report.location,
        type: report.type,
        time: report.time,
        status: report.status,
        moreInfo: report.moreInfo,
        delete: report.delete,
      };
      console.log("Location:", reportDisplay.location);
      const row = document.createElement("tr");
      Object.entries(reportDisplay).forEach(([key, value]) => {
        const td = document.createElement("td");
        if (key === "delete" && reportDisplay.delete === false) {
          td.innerHTML = crossSymbol;
          td.style.cursor = "pointer";
          td.onclick = function () {
            deleteRow(index);
          };
        } else if (key === "moreInfo" && reportDisplay.moreInfo === false) {
          const a = document.createElement("a");
          a.className = "badge badge-light";
          a.href = "#";
          a.textContent = "MORE INFO";
          a.onclick = function (e) {
            e.preventDefault();
            tooltip(report);
          };
          td.appendChild(a);
        } else {
          td.textContent = value;
        }
        row.appendChild(td);
      });
      tbody.appendChild(row);
    });
    reportList.appendChild(tbody);
    // reportList.appendChild(table);
  } else {
    reportList.textContent = "No reports available.";
  }
}

function deleteRow(index) {
  // deleting map marker
  if (reports[index].marker) {
    map.removeLayer(reports[index].marker);
  }
  // to delete the row
  reports.splice(index, 1);
  displayReports();
  saveReportsToLocalStorage();
}

function tooltip(report) {
  // For Priyansh & Yasir
  /* Create the map tooltip here. You can access report object for details and use it here. Manipulate DOM to achieve this. */
  console.log("For Debugging: Tooltip called for report\n");
  console.log(report);
}

// Load saved reports and display them
(async function initializeApp() {
  await loadReportsFromLocalStorage();
  displayReports();
})();

// FOR DEBUGGING ONLY
// Clears local storage to use fresh content
function clearLocalStorage() {
  localStorage.removeItem("emergencyReports");
  reports = []; // Clear the reports array in memory
  mapMarkers.forEach((marker) => map.removeLayer(marker)); // Remove all markers from the map
  mapMarkers = []; // Clear the mapMarkers array
  displayReports(); // Update the display
  console.log("Local storage and reports have been cleared.");
}
