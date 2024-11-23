// Initialize the map
var map = L.map("mapid").setView([49.2827, -123.1207], 10); // center on Vancouver
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
}).addTo(map);
map.on("moveend", filterReportsByMapBounds);

let reports = [];
let sortState = {};
let mapMarkers = [];
let crossSymbol = "&#x274C;";
let locationInvalid = false;

// Initial passcode and its MD5 hash stored in local storage
const initialPasscode = "admin123"; // Change this to your desired initial passcode
const hashedPasscode = CryptoJS.MD5(initialPasscode).toString();
if (!localStorage.getItem("hashedPasscode")) {
  localStorage.setItem("hashedPasscode", hashedPasscode);
}


/* Helper functions */
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

  return `${year}-${month}-${day} (${hours}:${minutes} ${ampm})`;
}

// Converting string to title case
function toTitleCase(str) {
  // hello world becomes -> Hello World
  return str.replace(
    /\w\S*/g,
    (text) => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
  );
}

// Validation functions
function validateInput(value, type) {
  const validations = {
    phone: {
      regex: /^(\+1|1)?[-.\s]?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/,
      errorMsg:
        "Valid phone number formats: (123) 456-7890, 123-456-7890, 123.456.7890, 1234567890, +1 123 456 7890",
    },
    name: {
      validate: (name) => name.trim() !== "",
      errorMsg: "Name is required",
    },
    pictureLink: {
      regex:
        /^(https?:\/\/)([\w\-]+(\.[\w\-]+)+)(:[0-9]+)?(\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?$/,
      fileExtension: /\.(jpg|jpeg|png|gif|bmp|svg|webp)$/i,
      errorMsg: "Valid picture link formats: .jpg, .png, .gif, etc.",
    },
  };

  const validation = validations[type];
  if (!validation)
    return { isValid: false, errorMsg: "Unknown validation type" };

  if (validation.regex) {
    return {
      isValid:
        validation.regex.test(value) &&
        (type !== "pictureLink" || validation.fileExtension.test(value)),
      errorMsg: validation.errorMsg,
    };
  } else if (validation.validate) {
    return {
      isValid: validation.validate(value),
      errorMsg: validation.errorMsg,
    };
  }
}

// Display validation message
function showValidation(element, isValid, errorMsg) {
  const fieldTitle = element.id.charAt(0).toUpperCase() + element.id.slice(1);
  let validationMsg = document.getElementById(`${element.id}Validate`);

  if (!validationMsg) {
    validationMsg = document.createElement("p");
    validationMsg.id = `${element.id}Validate`;
    element.parentNode.insertBefore(validationMsg, element.nextSibling);
  }

  element.className = `form-control border ${
    isValid ? "border-success" : "border-danger"
  }`;
  element.classList.toggle("is-valid", isValid);
  element.classList.toggle("is-invalid", !isValid);

  validationMsg.className = `alert alert-${isValid ? "success" : "danger"}`;
  validationMsg.innerHTML = isValid
    ? "Validation Successful!"
    : `Validation Unsuccessful!<br>${errorMsg}`;
}

["reporterName", "reporterPhone", "pictureLink"].forEach((fieldId) => {
  document.getElementById(fieldId).addEventListener("input", function () {
    const { isValid, errorMsg } = validateInput(
      this.value,
      fieldId.replace("reporter", "").toLowerCase()
    );
    showValidation(this, isValid, errorMsg);
  });
});

document.getElementById("location").addEventListener("input", function () {
  const locationInput = this;
  const locationValue = locationInput.value.trim();

  if (locationValue === "") {
    showValidation(locationInput, false, "Location is required");
    return;
  } else {
    showValidation(locationInput, true, "");
  }
});

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
    displayReports(parsedReports);
  }
}

// Form submission handler
async function handleFormSubmission(event) {
  event.preventDefault();
  const locationName = toTitleCase(document.getElementById("location").value);

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
    locationNameFromAPI: null,
  };

  // Do not allow submissions if required fields are empty;
  if (report.name === "" && report.phone === "" && report.location === "") {
    return;
  }
  // Process the report
  reports.push(report);
  try {
    await creating_long_lat(locationName, report.type, reports.length - 1);
    filterReportsByMapBounds();
    saveReportsToLocalStorage();
  } catch (error) {
    console.error("Error processing report:", error);
    reports.pop(); // Remove the report if there was an error
  }

  // Reset form
  event.target.reset();
  return report;
}

function resetForm() {
  // Reset the form
  document.getElementById("emergencyForm").reset();

  // Remove validation classes and messages
  const formElements = document.querySelectorAll(
    "#emergencyForm .form-control"
  );
  formElements.forEach((element) => {
    element.classList.remove(
      "border-success",
      "border-danger",
      "is-valid",
      "is-invalid"
    );
    element.className = "form-control";

    // Remove all validation messages
    const paragraphs = document.querySelectorAll("p");
    paragraphs.forEach((p) => p.remove());
  });
}

// Attach the event listener
document
  .getElementById("emergencyForm")
  .addEventListener("submit", handleFormSubmission);

// Attach the resetForm function to the form's reset event
document.getElementById("emergencyForm").addEventListener("reset", resetForm);

// Getting coordinates from location input
function creating_long_lat(locationName, type, reportIndex) {
  return new Promise((resolve, reject) => {
    const storedPosition = reports[reportIndex].markerPosition;
    if (storedPosition) {
      // PRIYANSH & YASIR make changes here for creating html element
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
            const latitude = parseFloat(data[0].lat);
            const longitude = parseFloat(data[0].lon);
            const locationNameFromAPI = data[0].name;
            let geoMarker = L.marker([latitude, longitude])
              .addTo(map)
              .bindPopup(`<strong>${locationName}</strong> <br> Type: ${type}`)
              .openPopup();

            reports[reportIndex].marker = geoMarker;
            reports[reportIndex].location = locationName;
            reports[reportIndex].locationNameFromAPI = locationNameFromAPI;
            reports[reportIndex].markerPosition = geoMarker.getLatLng();
            resolve();
          } else {
            correctLocation = false;
            incorrectLocation = true;
            requiredLocation = false;
            showValidation(
              correctLocation,
              incorrectLocation,
              "Location not found. Please check the spelling and try again.",
              document.getElementById("location"),
              "locationValidate",
              requiredLocation
            );
            reject("Location not found");
          }
        })
        .catch((error) => {
          console.error("Error fetching geocoding data:", error);
          locationInvalid = true;
          reject(error);
        });
    }
  });
}

function initTable(headers) {
  // Creates table with column names as values from headers array
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headers.forEach((key) => {
    const th = document.createElement("th");
    th.scope = "col"; // bootstrap
    if (key === "moreInfo" || key === "delete") {
      th.textContent = "";
    } else if (key !== "marker" && key !== "locationNameFromAPI") {
      th.textContent = key.charAt(0).toUpperCase() + key.slice(1);
    }
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  return thead;
}

  

function updateSortIndicators(sortedColumnIndex) {
  const headers = document.querySelectorAll("#reports th");
  headers.forEach((header, index) => {
    header.classList.remove("sorted-asc", "sorted-desc");
    if (index === sortedColumnIndex) {
      if (sortState[sortedColumnIndex]) {
        header.classList.add("sorted-asc");
      } else {
        header.classList.add("sorted-desc");
      }
    }
  });
}

function addSortListeners() {
  const tableHeaders = [
    "location",
    "type",
    "time",
    "status",
    "moreInfo",
    "delete",
  ];
  tableHeaders.forEach((header, index) => {
    const th = reportList.querySelector(`th:nth-child(${index + 1})`);
    th.style.cursor = "pointer";
    th.addEventListener("click", () => sortTable(index));
  });
}

function sortTable(columnIndex) {
  const table = document.getElementById("reports");
  const tbody = table.querySelector("tbody");
  const rows = Array.from(tbody.querySelectorAll("tr"));

  // Toggle sort direction
  sortState[columnIndex] = !sortState[columnIndex];

  rows.sort((a, b) => {
    const aValue = a.cells[columnIndex].textContent;
    const bValue = b.cells[columnIndex].textContent;

    if (sortState[columnIndex]) {
      return aValue.localeCompare(bValue);
    } else {
      return bValue.localeCompare(aValue);
    }
  });

  // Clear the table body
  tbody.innerHTML = "";

  // Append sorted rows
  rows.forEach((row) => tbody.appendChild(row));

  // Update header appearance
  updateSortIndicators(columnIndex);
}

function filterReportsByMapBounds() {
  const bounds = map.getBounds();
  const filteredReports = reports.filter((report) => {
    if (report.marker) {
      return bounds.contains(report.marker.getLatLng());
    }
    return false;
  });

  if (filteredReports.length > 0) {
    displayReports(filteredReports);
  } else {
    const reportList = document.getElementById("reports");
    reportList.innerHTML = ""; // Clear previous content
    reportList.textContent = "No reports available in the current view.";
  }
}

function deleteRow(index) {
  // Remove the marker from the map
  if (reports[index].marker) {
    map.removeLayer(reports[index].marker);
  }

  // Remove the report from the array
  reports.splice(index, 1);

  // Update local storage
  saveReportsToLocalStorage();

  // Update the table display
  filterReportsByMapBounds();

  // If there are no reports left, update the table content
  if (reports.length === 0) {
    const reportList = document.getElementById("reports");
    reportList.textContent = "No reports available.";
  }
}

function tooltip(report) {
  // For Priyansh & Yasir
  /* Create the map tooltip here. You can access report object for details and use it here. Manipulate DOM to achieve this. 
      Location input by user: location, Location fetched from API: locationNameFromAPI*/
  console.log("For Debugging: Tooltip called for report\n");
  console.log(report);
}

// Load saved reports and display them
(async function initializeApp() {
  await loadReportsFromLocalStorage();
  filterReportsByMapBounds();
})();

function showMarkerPopup(index) {
  const report = reports[index];
  if (report.marker) {
    report.marker.openPopup();
    map.panTo(report.marker.getLatLng());
  }
}




function displayReports(reports) {
    const reportList = document.getElementById("reports");
    reportList.innerHTML = ""; // Clear previous content
    const tableHeaders = ["location", "type", "time", "status", "moreInfo", "delete"];
  
    if (reports && reports.length > 0) {
      // Add table headers
      reportList.appendChild(initTable(tableHeaders));
  
      const tbody = document.createElement("tbody");
  
      reports.forEach((report, index) => {
        const row = document.createElement("tr");
        row.style.cursor = "pointer";
        row.onclick = function () {
          showMarkerPopup(index);
        };
  
        Object.entries({
          location: report.locationNameFromAPI,
          type: report.type,
          time: report.time,
          status: report.status,
          moreInfo: report.moreInfo,
          delete: report.delete,
        }).forEach(([key, value]) => {
          const td = document.createElement("td");
  
          if (key === "delete") {
            // Add the red cross delete button
            td.innerHTML = crossSymbol;
            td.style.cursor = "pointer";
  
            // Bind the deleteRow function to the delete button
            td.addEventListener("click", function (e) {
              e.stopPropagation(); // Prevent row click event from firing
              deleteRow(index); // Call the deleteRow function
            });
          } else if (key === "moreInfo") {
            // Add the "More Info" link
            const a = document.createElement("a");
            a.className = "badge badge-light";
            a.href = "#";
            a.textContent = "MORE INFO";
            a.onclick = function (e) {
              e.preventDefault();
              e.stopPropagation();
              showMoreInfo(index); // Call the function to show "More Info" container
            };
            td.appendChild(a);
          } else {
            // Add other data fields
            td.textContent = value;
          }
  
          row.appendChild(td);
        });
  
        tbody.appendChild(row);
      });
  
      reportList.appendChild(tbody);
    } else {
      reportList.textContent = "No reports available.";
    }
  }
  
  


function deleteRow(index) {
    // Prompt the user for the passcode
    const userPasscode = prompt("Enter the passcode to delete this report:");
    if (userPasscode === null) return; // User canceled the prompt
  
    // Retrieve the stored hashed passcode from localStorage
    const storedHashedPasscode = localStorage.getItem("hashedPasscode");
    const userHashedPasscode = CryptoJS.MD5(userPasscode).toString();
  
    // Validate the passcode
    if (userHashedPasscode === storedHashedPasscode) {
      // Remove the marker from the map
      if (reports[index].marker) {
        map.removeLayer(reports[index].marker);
      }
  
      // Remove the report from the array
      reports.splice(index, 1);
  
      // Update localStorage
      saveReportsToLocalStorage();
  
      // Refresh the reports display
      filterReportsByMapBounds();
  
      // Notify the user
      alert("Report deleted successfully!");
    } else {
      alert("Invalid passcode. You are not authorized to delete this report.");
    }
  }
  


  function handleChangeStatus(index) {
    const userPasscode = prompt("Enter the passcode to change the status:");
    if (userPasscode === null) return; // User canceled the prompt
  
    const storedHashedPasscode = localStorage.getItem("hashedPasscode");
    const userHashedPasscode = CryptoJS.MD5(userPasscode).toString();
  
    if (userHashedPasscode === storedHashedPasscode) {
      const statusChangeContainer = document.getElementById("statusChange");
      const currentStatus = reports[index].status;
  
      // Create the dropdown with three status options
      const dropdownHTML = `
        <select id="statusSelect" class="form-control form-control-sm mb-2">
          <option value="OPEN" ${currentStatus === "OPEN" ? "selected" : ""}>OPEN</option>
          <option value="IN-PROGRESS" ${currentStatus === "In-Progress" ? "selected" : ""}>IN-PROGRESS</option>
          <option value="RESOLVED" ${currentStatus === "Resolved" ? "selected" : ""}>RESOLVED</option>
        </select>
      `;
  
      // Add Save and Cancel buttons
      const actionButtonsHTML = `
        <button id="saveStatus" class="btn btn-success btn-sm">Save</button>
        <button id="cancelStatus" class="btn btn-danger btn-sm ml-2">Cancel</button>
      `;
  
      // Update the container's HTML
      statusChangeContainer.innerHTML = dropdownHTML + actionButtonsHTML;
  
      // Save button functionality
      document.getElementById("saveStatus").onclick = function () {
        const newStatus = document.getElementById("statusSelect").value; // Get the selected status
  
        // Update the report status
        reports[index].status = newStatus;
  
        // Update localStorage and refresh UI
        saveReportsToLocalStorage();
        filterReportsByMapBounds(); // Refresh the table to show updated status
  
        // Revert the container to show updated status with the "Change" link
        statusChangeContainer.innerHTML = `
          Status: ${newStatus} 
          <a href="#" id="changeStatus" class="badge badge-warning" style="cursor: pointer;">Change</a>
        `;
  
        // Attach event listener to the new "Change" link
        document.getElementById("changeStatus").onclick = function (e) {
          e.preventDefault();
          handleChangeStatus(index);
        };
      };
  
      // Cancel button functionality
      document.getElementById("cancelStatus").onclick = function () {
        // Revert back to the original status with the "Change" link
        statusChangeContainer.innerHTML = `
          Status: ${currentStatus} 
          <a href="#" id="changeStatus" class="badge badge-warning" style="cursor: pointer;">Change</a>
        `;
  
        // Attach event listener to the new "Change" link
        document.getElementById("changeStatus").onclick = function (e) {
          e.preventDefault();
          handleChangeStatus(index);
        };
      };
    } else {
      alert("Invalid passcode. You are not authorized to change the status.");
    }
  }
  
  
  


  function showMoreInfo(index) {
    const report = reports[index];
  
    // Debugging: Check if the report exists
    console.log("Selected Report: ", report);
  
    // Get the elements
    const reportImageElement = document.getElementById("reportImage");
    const reportDetailsElement = document.getElementById("reportDetails");
    const reportStatusElement = document.getElementById("reportStatus");
    const changeStatusLink = document.getElementById("changeStatus");
  
    // Check if elements exist
    if (!reportImageElement || !reportDetailsElement || !reportStatusElement || !changeStatusLink) {
      console.error("Missing one or more elements for the More Info container.");
      return;
    }
  
    // Set the image (or use a placeholder if no image link is provided)
    const imageUrl = report.pictureLink || "image.jpg"; // Default image if none is provided
    reportImageElement.src = imageUrl;
  
    // Set the report details
    const details = `
        <strong>Type:</strong> ${report.type} <br>
        <strong>Location:</strong> ${report.location} <br>
        <strong>Reported by:</strong> ${report.name} (${report.phone}) <br>
        <strong>Time:</strong> ${report.time} <br>
        <strong>Comments:</strong> ${report.comments || "No additional comments"}
      `;
    reportDetailsElement.innerHTML = details;
  
    // Set the current status
    reportStatusElement.textContent = report.status;
  
    // Add the event listener for the "Change" link
    changeStatusLink.onclick = function (e) {
      e.preventDefault();
      handleChangeStatus(index);
    };
  
    // Show the container
    const container = document.getElementById("moreInfoContainer");
    if (container) {
      container.style.display = "block";
  
      // Scroll to the container (optional)
      container.scrollIntoView({ behavior: "smooth" });
    } else {
      console.error("More Info container is missing in the HTML.");
    }
  }
  
  
  