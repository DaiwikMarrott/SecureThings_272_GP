// Initialize the map
var map = L.map("mapid").setView([49.2827, -123.1207], 10); // center on Vancouver
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
}).addTo(map);
map.on("moveend", filterReportsByMapBounds);

// Array to store emergency reports and map markers
let reports = [];
let sortState = {};
let mapMarkers = [];
let crossSymbol = "&#x274C;";
let locationInvalid = false;
let correctPhone = false,
  incorrectPhone = false,
  requiredPhone = false,
  correctName = false,
  incorrectName = false,
  requiredName = false,
  correctLocation = false,
  incorrectLocation = false,
  requiredLocation = false,
  correctPictureLink = false,
  incorrectPictureLink = false,
  requiredPictureLink = false;

// Helper function to convert string to title case
function toTitleCase(str) {
  // hello world becomes -> Hello World
  return str.replace(
    /\w\S*/g,
    (text) => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
  );
}

function validatePhoneNumber(phone) {
  // This regex matches common North American phone number formats
  const phoneRegex =
    /^(\+1|1)?[-.\s]?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/;
  return phoneRegex.test(phone);
}

function validateName(name) {
  // checking if name field is empty
  return name.trim() !== "";
}

function validatePictureLink(link) {
  // Regular expression for a valid URL ending with an image file extension
  const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|svg|webp)$/i;
  const urlRegex =
    /^(https?:\/\/)([\w\-]+(\.[\w\-]+)+)(:[0-9]+)?(\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?$/;

  // Check if the link matches a valid URL and ends with an image extension
  if (urlRegex.test(link) && imageExtensions.test(link)) {
    return true; // Valid picture link
  }
  return false; // Invalid picture link
}

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

// Form submission handler
async function handleFormSubmission(event) {
  event.preventDefault();
  if (incorrectPhone) {
    return;
  } else if (correctPhone) {
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
    const paragraphs = document.querySelectorAll("p");
    paragraphs.forEach((p) => p.remove());

    return report;
  }
}

// Attach the event listener
document
  .getElementById("emergencyForm")
  .addEventListener("submit", handleFormSubmission);

// Validate fields and show output: creates relevant elements to show error messages or input validation
function showValidation(isOk, notOk, notOkMsg, element, id, requiredNotMet) {
  // Extract and format field title from ID
  let fieldTitle =
    id.replace("Validate", "").charAt(0).toUpperCase() +
    id.replace("Validate", "").slice(1);
  // Locate or create validation message element
  let validationMsg = document.getElementById(id);
  if (!validationMsg) {
    validationMsg = document.createElement("p");
    validationMsg.id = id;
    element.parentNode.insertBefore(validationMsg, element.nextSibling);
  }
  // Validation logic
  if (requiredNotMet) {
    isOk = false;
    notOk = true;
    // Handle when field is empty: shows yellow box
    element.className = "form-control border border-warning";
    element.classList.remove("is-valid");
    element.classList.add("is-invalid");
    validationMsg.className = "alert alert-warning";
    validationMsg.innerHTML = `Validation Unsuccessful! ${fieldTitle} is a required field.`;
  } else if (!isOk && notOk) {
    // Handle when validation is unsuccessful: shows red box
    element.className = "form-control border border-danger";
    element.classList.remove("is-valid");
    element.classList.add("is-invalid");
    validationMsg.className = "alert alert-danger";
    validationMsg.innerHTML = `Validation Unsuccessful!<br>${notOkMsg}`;
  } else if (isOk && !notOk) {
    // Handle when validation is successful: shows green box
    element.className = "form-control border border-success";
    element.classList.add("is-valid");
    element.classList.remove("is-invalid");
    validationMsg.className = "alert alert-success";
    validationMsg.innerHTML = "Validation Successful!";
  }
}

// Validating name in real-time
document.getElementById("reporterName").addEventListener("input", function () {
  const nameInput = this;
  const nameValue = nameInput.value;
  if (nameValue === "") {
    // If name is empty
    correctName = false;
    incorrectName = false;
    requiredName = true;
    showValidation(
      correctName,
      incorrectName,
      "",
      nameInput,
      "nameValidate",
      requiredName
    );
  } else if (validateName(nameValue)) {
    // If name is valid
    correctName = true;
    incorrectName = false;
    requiredName = false;
    showValidation(
      correctName,
      incorrectName,
      "",
      nameInput,
      "nameValidate",
      requiredName
    );
  }
  // only invalid case is if the field is empty which is already implemented above in this function
});

// Validating phone number in real-time
document.getElementById("reporterPhone").addEventListener("input", function () {
  const phoneInput = this;
  const phoneValue = phoneInput.value;
  if (phoneValue === "") {
    // If phone number is empty
    correctPhone = false;
    incorrectPhone = false;
    requiredPhone = true;
    showValidation(
      correctPhone,
      incorrectPhone,
      "",
      phoneInput,
      "phoneValidate",
      requiredPhone
    );
  } else if (validatePhoneNumber(phoneValue)) {
    // If phone number is valid
    correctPhone = true;
    incorrectPhone = false;
    requiredPhone = false;
    showValidation(
      correctPhone,
      incorrectPhone,
      "",
      phoneInput,
      "phoneValidate",
      requiredPhone
    );
  } else {
    // If phone number is invalid
    correctPhone = false;
    incorrectPhone = true;
    requiredPhone = false;
    showValidation(
      correctPhone,
      incorrectPhone,
      "Valid phone number formats: (123) 456-7890, 123-456-7890, 123.456.7890, 1234567890, +1 123 456 7890",
      phoneInput,
      "phoneValidate",
      requiredPhone
    );
  }
});

// Validating picture link in real-time
document.getElementById("pictureLink").addEventListener("input", function () {
  const pictureLinkInput = this;
  const pictureLink = pictureLinkInput.value;
  if (pictureLink === "") {
    correctPictureLink = false;
    incorrectPictureLink = false;
    console.log(pictureLink);
    pictureLinkInput.classList.remove("is-valid", "is-invalid");
    pictureLinkInput.className = "form-control border border-primary";
    document.getElementById("pictureLinkValidate").remove();
  }
  // Not checking empty since this field is not required
  if (validatePictureLink(pictureLink)) {
    // If picture link is valid
    correctPictureLink = true;
    incorrectPictureLink = false;
    requiredPictureLink = false;
    showValidation(
      correctPictureLink,
      incorrectPictureLink,
      "",
      pictureLinkInput,
      "pictureLinkValidate",
      requiredPictureLink
    );
  } else if (validatePictureLink(pictureLink) === false && pictureLink !== "") {
    // If picture link is invalid
    correctPictureLink = false;
    incorrectPictureLink = true;
    requiredPictureLink = false;
    showValidation(
      correctPictureLink,
      incorrectPictureLink,
      "Valid pictureLink number formats: .jpg, .png, .gif, etc.",
      pictureLinkInput,
      "pictureLinkValidate",
      requiredPictureLink
    );
  }
});

// Validating location in real-time
document.getElementById("location").addEventListener("input", function () {
  const locationInput = this;
  var locationValue = locationInput.value;

  // If location is empty, hide suggestions
  if (locationValue.trim() === "") {
    document.getElementById("locationSuggestions").style.display = "none";
    correctLocation = false;
    incorrectLocation = false;
    requiredLocation = true;
    document.getElementById("locationValidate").remove();
    showValidation(
      correctLocation,
      incorrectLocation,
      "",
      locationInput,
      "locationValidate",
      requiredLocation
    );
    return;
  }

  // Fetch location suggestions from OpenStreetMap API
  fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      locationValue
    )}&countrycodes=ca&limit=5`
  )
    .then((response) => response.json())
    .then((data) => {
      const suggestionsList = document.getElementById("locationSuggestions");
      suggestionsList.innerHTML = ""; // Clear previous suggestions

      // If there are suggestions, show them
      if (data.length > 0) {
        if (document.getElementById("locationValidate") != null) {
          document.getElementById("locationValidate").remove();
        }
        suggestionsList.style.display = "block";
        data.forEach((item) => {
          const listItem = document.createElement("li");
          listItem.classList.add("list-group-item");
          listItem.textContent = item.display_name;
          listItem.onmouseover = () => {
            // locationInput.value = item.display_name;
            listItem.classList.add("bg-primary", "text-white");
            // You can store the selected location's lat/lng in the input
            creating_long_lat(
              item.display_name,
              document.getElementById("emergencyType").value,
              reports.length - 1
            );
          };
          listItem.onmouseout = () => {
            listItem.classList.remove("bg-primary", "text-white");
            listItem.style.listStyle = "none";
          };
          listItem.onclick = () => {
            locationInput.value = item.display_name;
            locationValue = locationInput.value;
            document.getElementById("locationSuggestions").style.display =
              "none";
            // If location is valid as per API
            correctLocation = true;
            incorrectLocation = false;
            requiredLocation = false;
            showValidation(
              correctLocation,
              incorrectLocation,
              "",
              locationInput,
              "locationValidate",
              requiredLocation
            );
          };
          suggestionsList.appendChild(listItem);
        });
      } else {
        suggestionsList.style.display = "none";
      }
    })
    .catch((error) => {
      console.error("Error fetching location suggestions:", error);
      document.getElementById("locationSuggestions").style.display = "none";
    });
});

// Getting coordinates from location input
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

function displayReports(reports) {
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
    // add headers
    reportList.appendChild(initTable(tableHeaders));
    const tbody = document.createElement("tbody");
    // create table body
    reports.forEach((report, index) => {
      const reportDisplay = {
        location: report.locationNameFromAPI,
        type: report.type,
        time: report.time,
        status: report.status,
        moreInfo: report.moreInfo,
        delete: report.delete,
      };
      // only include fields that are required as per demo image in project PDF
      const row = document.createElement("tr");
      row.style.cursor = "pointer";
      row.onclick = function () {
        showMarkerPopup(index);
      };
      // For each key in reportDisplay, adding rows with respective value
      Object.entries(reportDisplay).forEach(([key, value]) => {
        const td = document.createElement("td");
        if (key === "delete" && reportDisplay.delete === false) {
          // Add 'cross' delete symbol
          td.innerHTML = crossSymbol;
          td.style.cursor = "pointer";
          td.onclick = function (e) {
            e.stopPropagation();
            deleteRow(index);
          };
        } else if (key === "moreInfo" && reportDisplay.moreInfo === false) {
          // Add MORE INFO text
          const a = document.createElement("a");
          a.className = "badge badge-light";
          a.href = "#";
          a.textContent = "MORE INFO";
          a.onclick = function (e) {
            e.preventDefault();
            e.stopPropagation();
            // Calls tooltip function: For YASIR & PRIYANSH
            tooltip(report);
          };
          td.appendChild(a);
        } else {
          // For other cases
          td.textContent = value;
        }
        // Add cell data
        row.appendChild(td);
      });
      // Add row
      tbody.appendChild(row);
    });
    // Add table body
    reportList.appendChild(tbody);
    tableHeaders.forEach((header, index) => {
      const th = reportList.querySelector(`th:nth-child(${index + 1})`);
      th.style.cursor = "pointer";
      th.addEventListener("click", () => sortTable(index));
    });
  } else {
    // Handling edge case when no report is there
    reportList.textContent = "No reports available.";
  }
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
  displayReports(filteredReports);
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
