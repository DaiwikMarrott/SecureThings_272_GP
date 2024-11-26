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
let currentDisplayedReportIndex = null;
let activeMarker = null;
let filteredReports = [];

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
function validateReport(report) {
  const excludeProperties = ["pictureLink", "comments"];

  const emptyProperties = Object.keys(report).filter(
    (key) => !excludeProperties.includes(key) && report[key] === ""
  );

  if (emptyProperties.length > 0) {
    const formattedProperties = emptyProperties.map((prop) =>
      toTitleCase(prop)
    );
    throw new Error(
      `The following properties are empty: ${formattedProperties.join(", ")}`
    );
  }
}

function validateInput(value, type, callback) {
  const validations = {
    phone: {
      regex: /^(\+1|1)?[-.\s]?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/,
      errorMsg:
        "Valid phone number formats: (123) 456-7890, 123-456-7890, 123.456.7890, 1234567890, +1 123 456 7890",
    },
    name: {
      validate: (name) => name.trim() !== "",
      errorMsg: "Name is required.",
    },
    location: {
      validate: (loc) => loc.trim() !== "",
      errorMsg: "Location is required.",
    },
    pictureLink: {
      regex:
        /^(https?:\/\/)([\w\-]+(\.[\w\-]+)+)(:[0-9]+)?(\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?$/,
      errorMsg: "Invalid URL format for the picture link.",
    },
  };

  const validation = validations[type];
  if (!validation)
    return callback({ isValid: false, errorMsg: "Unknown validation type" });

  if (validation.regex) {
    const matchesFormat = validation.regex.test(value);

    if (type === "pictureLink" && !matchesFormat && value === "") {
      return callback({ isValid: true, errorMsg: "", optional: true });
    } else if (type === "pictureLink" && matchesFormat) {
      // Use checkImage to validate the URL
      checkImage(value, (isValid) => {
        if (isValid) {
          callback({ isValid: true, errorMsg: "", optional: false });
        } else {
          callback({
            isValid: false,
            errorMsg:
              "The URL is either invalid or does not point to an accessible image.",
            optional: false,
          });
        }
      });
    } else if (!matchesFormat) {
      callback({ isValid: false, errorMsg: validation.errorMsg });
    } else {
      callback({ isValid: true, errorMsg: "" });
    }
  } else if (validation.validate) {
    callback({
      isValid: validation.validate(value),
      errorMsg: validation.errorMsg,
    });
  } else {
    callback({ isValid: true, errorMsg: "" });
  }
}

// Display validation message
function showValidation(element, isValid, errorMsg, optional = false) {
  const fieldTitle = element.id.charAt(0).toUpperCase() + element.id.slice(1);
  let validationMsg = document.getElementById(`${element.id}Validate`);

  if (optional) {
    if (validationMsg) {
      validationMsg.style.display = "none";
      element.classList.toggle("is-valid", isValid);
      element.classList.toggle("is-invalid", !isValid);
      element.className = `form-control border ${
        isValid ? "border-success" : "border-danger"
      }`;
      return;
    }
  }
  if (!validationMsg) {
    validationMsg = document.createElement("p");
    validationMsg.id = `${element.id}Validate`;
    element.parentNode.insertBefore(validationMsg, element.nextSibling);
  }
  validationMsg.style.display = "block";
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
    clicked: false,
  };

  // Do not allow submissions if required fields are empty;

  // Process the report
  reports.push(report);
  try {
    validateReport(report);
    await creating_long_lat(locationName, report.type, reports.length - 1);
    filterReportsByMapBounds();
    saveReportsToLocalStorage();

    // Reset the form
    event.target.reset();

    // Hide the "More Info" container if visible
    const container = document.getElementById("moreInfoContainer");
    if (container) {
      container.style.display = "none"; // Hide the container
    }

    // Scroll to the table of reports
    document
      .getElementById("emergencyList")
      .scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    // console.error("Error processing report:", error);
    showValidation(document.getElementById("comments"), false, error);
    reports.pop(); // Remove the report if there was an error
  }
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
    const paragraphs = document.querySelectorAll(
      "p:not(#statusChange):not(#reportDetails)"
    );
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
            .bindPopup(
              `<strong>${locationNameFromAPI}</strong> <br> Type: ${type}`
            );

          // Attach custom property `reportIndex` to the marker
          geoMarker.reportIndex = reportIndex;

          geoMarker.on("click", function (e) {
            e.originalEvent.stopPropagation();

            // Close and reset the active marker if it exists and is different
            if (activeMarker && activeMarker !== this) {
              activeMarker.closePopup();
              reports[activeMarker.reportIndex].clicked = false;

              const container = document.getElementById("moreInfoContainer");
              if (container) {
                container.style.display = "none";
              }
            }

            // Toggle the current marker's state
            if (!reports[this.reportIndex].clicked) {
              reports[this.reportIndex].clicked = true;
              this.openPopup();
              showMoreInfo(reportIndex, reports);
              activeMarker = this; // Set the current marker as active
            } else {
              this.closePopup();
              reports[this.reportIndex].clicked = false;

              const container = document.getElementById("moreInfoContainer");
              if (container) {
                container.style.display = "none";
              }

              activeMarker = null; // Reset the active marker
            }
          });

          geoMarker.on("popupopen", (e) => {
            const popupElement = e.popup._container;

            // Query the close button inside the popup
            const closeButton = popupElement.querySelector(
              ".leaflet-popup-close-button"
            );

            // Add an event listener to handle close button clicks
            if (closeButton) {
              closeButton.addEventListener("click", () => {
                const container = document.getElementById("moreInfoContainer");
                if (container) {
                  reports[reportIndex].clicked = false;
                  container.style.display = "none";
                }

                activeMarker = null; // Reset the active marker
              });
            }
          });

          reports[reportIndex].marker = geoMarker;
          reports[reportIndex].location = locationName;
          reports[reportIndex].locationNameFromAPI = locationNameFromAPI;
          reports[reportIndex].markerPosition = geoMarker.getLatLng();
          resolve();
        } else {
          showValidation(
            document.getElementById("location"),
            false,
            "Location not found. Please check the spelling and try again."
          );
          reject("Location not found");
        }
      })
      .catch((error) => {
        console.error("Error fetching geocoding data:", error);
        showValidation(
          document.getElementById("location"),
          false,
          "Error validating location. Try again."
        );
        reject(error);
      });
  });
}

function initTable(headers) {
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  headers.forEach((key, index) => {
    const th = document.createElement("th");
    th.scope = "col"; // Accessibility for Bootstrap tables

    if (key === "moreInfo" || key === "delete") {
      th.textContent = ""; // Skip non-sortable columns
    } else {
      th.textContent = key.charAt(0).toUpperCase() + key.slice(1); // Capitalize header name

      // Add a click event listener for sorting
      th.style.cursor = "pointer"; // Indicate clickable headers
      th.addEventListener("click", () => {
        console.log(`Sorting column: ${key} (Index: ${index})`); // Debugging
        sortTable(index); // Call sortTable with the correct column index
      });
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

  // Check if the currently displayed "More Info" container should be hidden
  const moreInfoContainer = document.getElementById("moreInfoContainer");
  if (
    moreInfoContainer.style.display === "block" &&
    currentDisplayedReportIndex !== null
  ) {
    const currentReport = reports[currentDisplayedReportIndex];
    const reportStillVisible = filteredReports.some(
      (report) => report.location === currentReport.location
    );

    if (!reportStillVisible) {
      currentReport.clicked = false;
      moreInfoContainer.style.display = "none";
      currentDisplayedReportIndex = null;
    }
  }

  if (filteredReports.length > 0) {
    displayReports(filteredReports);
  } else {
    const reportList = document.getElementById("reports");
    reportList.innerHTML = "";
    reportList.textContent = "No reports available in the current view.";
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

function showMarkerPopup(index, reportsArray) {
  // console.log("show marker function toggled");
  const report = reportsArray[index];
  if (report.marker) {
    report.marker.openPopup();
    // map.panTo(report.marker.getLatLng());
  }
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

  if (reports && reports.length > 0) {
    // Add table headers
    reportList.appendChild(initTable(tableHeaders));

    const tbody = document.createElement("tbody");

    reports.forEach((report, index) => {
      const row = document.createElement("tr");
      row.style.cursor = "pointer";
      row.onclick = function () {
        // console.log("row has been clicked");
        showMarkerPopup(index, reports);
        reports[index].clicked = true;
        showMoreInfo(index, reports);
      };

      Object.entries({
        // Use user-entered location here
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
            deleteRow(index, reports); // Call the deleteRow function
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
            // console.log(index);
            reports[index].clicked = true;
            showMoreInfo(index, reports); // Call the function to show "More Info" container
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
    // Hide "More Info" container if the currently viewed report is being deleted
    const moreInfoContainer = document.getElementById("moreInfoContainer");
    if (moreInfoContainer.style.display === "block") {
      const currentReportDetails =
        document.getElementById("reportDetails").innerHTML;
      const deletedReportLocation = reports[index].location;

      // Check if the currently displayed report matches the report being deleted
      if (currentReportDetails.includes(deletedReportLocation)) {
        moreInfoContainer.style.display = "none";
        reports[index].clicked = false;
      }
    }

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
          <option value="OPEN" ${
            currentStatus === "OPEN" ? "selected" : ""
          }>OPEN</option>
          <option value="IN-PROGRESS" ${
            currentStatus === "IN-PROGRESS" ? "selected" : ""
          }>IN-PROGRESS</option>
          <option value="RESOLVED" ${
            currentStatus === "RESOLVED" ? "selected" : ""
          }>RESOLVED</option>
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
    document.getElementById("saveStatus").onclick = function (e) {
      e.stopPropagation();
      const newStatus = document.getElementById("statusSelect").value; // Get the selected status

      // Update the report status
      reports[index].status = newStatus;

      // Update localStorage and refresh UI
      saveReportsToLocalStorage();
      filterReportsByMapBounds(); // Refresh the table to show updated status

      // Show success alert
      alert("The status has been changed successfully!");

      // Revert the container to show updated status with the "Change" link
      statusChangeContainer.innerHTML = `
          Status: ${newStatus} 
          <a href="#" id="changeStatus" class="badge badge-warning" style="cursor: pointer;">Change</a>
        `;

      // Attach event listener to the new "Change" link
      document.getElementById("changeStatus").onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        handleChangeStatus(index);
      };
    };

    // Cancel button functionality
    document.getElementById("cancelStatus").onclick = function (e) {
      // Revert back to the original status with the "Change" link
      e.stopPropagation();
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

function showMoreInfo(index, reports) {
  // console.log("show more info toggled");
  // reports[index].clicked = true;
  const report = reports[index];
  currentDisplayedReportIndex = index;
  const container = document.getElementById("moreInfoContainer");
  const reportImageElement = document.getElementById("reportImage");
  const reportDetailsElement = document.getElementById("reportDetails");
  const statusChangeContainer = document.getElementById("statusChange");

  if (
    !container ||
    !reportImageElement ||
    !reportDetailsElement ||
    !statusChangeContainer
  ) {
    console.error("Missing one or more elements for the More Info container.");
    return;
  }

  // Reset container content
  reportImageElement.src = "";
  reportImageElement.alt = "";
  reportDetailsElement.innerHTML = "";
  statusChangeContainer.innerHTML = "";

  // Handle image display
  const imageUrl =
    report.pictureLink && report.pictureLink.trim() !== ""
      ? report.pictureLink
      : null;

  if (imageUrl) {
    checkImage(imageUrl, function (isValid, optional) {
      if (isValid && !optional) {
        reportImageElement.src = imageUrl;
        reportImageElement.alt = "Report Image";
        reportImageElement.style.display = "block";
        reportImageElement.classList.add("center-image");
        document.getElementById("noImageMessage")?.remove();
      } else {
        reportImageElement.style.display = "none";
        showNoImageMessage(
          reportDetailsElement,
          "No publicly accessible image found for this report."
        );
      }
    });
  } else {
    reportImageElement.style.display = "none";
    showNoImageMessage(
      reportDetailsElement,
      "No image specified for this report."
    );
  }

  // Set the report details
  reportDetailsElement.innerHTML += `
      <strong>Type:</strong> ${report.type} <br>
      <strong>Location:</strong> ${report.location} <br>
      <strong>Reported by:</strong> ${toTitleCase(report.name)} (${
    report.phone
  }) <br>
      <strong>Time:</strong> ${report.time} <br>
      <strong>Comments:</strong> ${report.comments || "No additional comments"}
    `;

  // Status and Change button
  statusChangeContainer.innerHTML = `
      Status: <span id="reportStatus">${report.status}</span>
      <a href="#" id="changeStatus" class="badge badge-warning" style="cursor: pointer;">Change</a>
    `;
  document.getElementById("changeStatus").onclick = function (e) {
    e.preventDefault();
    handleChangeStatus(index);
  };

  // Close button logic
  let closeButton = document.getElementById("closeContainer");
  if (!closeButton) {
    closeButton = document.createElement("button");
    closeButton.id = "closeContainer";
    closeButton.className = "btn btn-secondary btn-sm mt-3";
    closeButton.textContent = "Close";
    closeButton.onclick = function (e) {
      // e.stopPropagation();
      reports[index].clicked = false;
      container.style.display = "none";
      document
        .getElementById("emergencyList")
        .scrollIntoView({ behavior: "smooth" });
    };
    container.querySelector(".card-body").appendChild(closeButton);
  }

  container.style.display = "block";
  container.scrollIntoView({ behavior: "smooth" });
}

// Helper function to show the "No image found" message
function showNoImageMessage(parentElement, message) {
  const noImageMessage = document.createElement("p");
  noImageMessage.id = "noImageMessage";
  noImageMessage.className = "text-center font-weight-bold center-message";
  noImageMessage.textContent = message;
  parentElement.prepend(noImageMessage);
}

/**
 * Function to validate an image URL with a fallback mechanism.
 * @param {string} url - The image URL to validate.
 * @param {function} callback - A callback function to handle the result.
 */

function checkImage(url, callback) {
  if (url === "") {
    callback(true, true);
  }
  const request = new XMLHttpRequest();
  request.open("HEAD", url, true);
  request.onload = function () {
    const contentType = request.getResponseHeader("Content-Type");
    if (
      request.status === 200 &&
      contentType &&
      contentType.startsWith("image")
    ) {
      callback(true, false);
    } else {
      validateWithImageObject(url, callback);
    }
  };
  request.onerror = function () {
    validateWithImageObject(url, callback);
  };
  request.send();
}

function validateWithImageObject(url, callback) {
  const img = new Image();
  img.onload = function () {
    callback(true, false);
  };
  img.onerror = function () {
    callback(false, false);
  };
  img.src = url;
}

document.getElementById("reporterName").addEventListener("input", function () {
  validateInput(this.value, "name", ({ isValid, errorMsg }) =>
    showValidation(this, isValid, errorMsg)
  );
});

// Event listeners for input validation
document.getElementById("reporterPhone").addEventListener("input", function () {
  validateInput(this.value, "phone", ({ isValid, errorMsg }) =>
    showValidation(this, isValid, errorMsg)
  );
});

document.getElementById("location").addEventListener("input", function () {
  validateInput(this.value, "location", ({ isValid, errorMsg }) =>
    showValidation(this, isValid, errorMsg)
  );
});

document.getElementById("pictureLink").addEventListener("input", function () {
  validateInput(
    this.value,
    "pictureLink",
    ({ isValid, errorMsg, optional }) => {
      showValidation(this, isValid, errorMsg, optional);
    }
  );
});
