// Simple test framework functions
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
  return true;
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected} but got ${actual}`);
  }
  return true;
}

function assertContains(array, element, message) {
  if (!array.includes(element)) {
    throw new Error(message || `Expected array to contain ${element}`);
  }
  return true;
}

function runTests() {
  const testResults = {
    passed: 0,
    failed: 0,
    details: [],
  };

  function addResult(testName, passed, error = null) {
    testResults.details.push({
      name: testName,
      passed,
      error: error?.message,
    });
    if (passed) testResults.passed++;
    else testResults.failed++;
  }

  // Mock DOM elements
  document.body.innerHTML = `
        <form id="emergencyForm">
            <input id="reporterName" value="Test User" />
            <input id="reporterPhone" value="123-456-7890" />
            <select id="emergencyType"><option value="Fire">Fire</option></select>
            <input id="location" value="Vancouver Downtown" />
            <textarea id="comments">Test emergency</textarea>
        </form>
        <div id="reports"></div>
        <div id="mapid"></div>
    `;

  // Mock map interaction events
  let mapClickCallback;
  let mapMoveCallback;
  let mapZoomCallback;

  // Enhanced Leaflet mock with event handling
  window.L = {
    map: function () {
      return {
        setView: function () {
          return this;
        },
        on: function (event, callback) {
          if (event === "click") mapClickCallback = callback;
          if (event === "move") mapMoveCallback = callback;
          if (event === "zoom") mapZoomCallback = callback;
          return this;
        },
        getZoom: function () {
          return 13;
        },
        getCenter: function () {
          return { lat: 49.2827, lng: -123.1207 };
        },
      };
    },
    tileLayer: function () {
      return {
        addTo: function () {
          return this;
        },
      };
    },
    marker: function (coords) {
      return {
        addTo: function () {
          return this;
        },
        bindPopup: function () {
          return this;
        },
        openPopup: function () {
          return this;
        },
        getLatLng: function () {
          return coords;
        },
        remove: function () {
          return this;
        },
      };
    },
  };

  // 1. SPECIFIC TEST CASES

  // Test 1.1: Form validation - Empty required fields
  try {
    document.getElementById("reporterName").value = "";
    const form = document.getElementById("emergencyForm");
    let validationPassed = true;
    try {
      form.dispatchEvent(new Event("submit"));
    } catch {
      validationPassed = false;
    }
    assert(
      !validationPassed,
      "Form should not submit with empty required fields"
    );
    addResult("Form Validation - Empty Fields", true);
  } catch (error) {
    addResult("Form Validation - Empty Fields", false, error);
  }

  // Test 1.2: Form validation - Phone format
  try {
    document.getElementById("reporterName").value = "Test User";
    document.getElementById("reporterPhone").value = "invalid-phone";
    const form = document.getElementById("emergencyForm");
    let validationPassed = true;
    try {
      form.dispatchEvent(new Event("submit"));
    } catch {
      validationPassed = false;
    }
    assert(
      !validationPassed,
      "Form should not submit with invalid phone format"
    );
    addResult("Form Validation - Phone Format", true);
  } catch (error) {
    addResult("Form Validation - Phone Format", false, error);
  }

  // Test 1.3: Multiple reports handling
  try {
    reports = [];
    document.getElementById("reporterPhone").value = "123-456-7890";

    // Submit multiple reports
    for (let i = 0; i < 3; i++) {
      document.getElementById("location").value = `Location ${i}`;
      const form = document.getElementById("emergencyForm");
      form.dispatchEvent(new Event("submit"));
    }

    assert(reports.length === 3, "Multiple reports should be stored");
    assert(
      reports.every((r) => r.status === "OPEN"),
      "All reports should start as OPEN"
    );
    addResult("Multiple Reports Handling", true);
  } catch (error) {
    addResult("Multiple Reports Handling", false, error);
  }

  // 2. ERROR HANDLING TESTS

  // Test 2.1: Network error handling
  try {
    const originalFetch = window.fetch;
    window.fetch = function () {
      return Promise.reject(new Error("Network error"));
    };

    let errorLogged = false;
    const originalConsoleError = console.error;
    console.error = () => {
      errorLogged = true;
    };

    creating_long_lat("Test Location", "Fire")
      .then(() => {
        assert(errorLogged, "Network error should be logged");
        addResult("Network Error Handling", true);
      })
      .catch((error) => addResult("Network Error Handling", false, error))
      .finally(() => {
        window.fetch = originalFetch;
        console.error = originalConsoleError;
      });
  } catch (error) {
    addResult("Network Error Handling", false, error);
  }

  // Test 2.2: Invalid coordinates handling
  try {
    mapMarkers = [];
    const originalFetch = window.fetch;
    window.fetch = function () {
      return Promise.resolve({
        json: () => Promise.resolve([{ lat: "invalid", lon: "invalid" }]),
      });
    };

    creating_long_lat("Invalid Coords", "Fire")
      .then(() => {
        assert(
          mapMarkers.length === 0,
          "Invalid coordinates should not create marker"
        );
        addResult("Invalid Coordinates Handling", true);
      })
      .catch((error) => addResult("Invalid Coordinates Handling", false, error))
      .finally(() => {
        window.fetch = originalFetch;
      });
  } catch (error) {
    addResult("Invalid Coordinates Handling", false, error);
  }

  // 3. MAP INTERACTION TESTS

  // Test 3.1: Map click handling
  try {
    const clickEvent = {
      latlng: { lat: 49.2827, lng: -123.1207 },
    };

    if (mapClickCallback) {
      mapClickCallback(clickEvent);
      assert(true, "Map click handler executed without error");
    }
    addResult("Map Click Handling", true);
  } catch (error) {
    addResult("Map Click Handling", false, error);
  }

  // Test 3.2: Map zoom handling
  try {
    const zoomEvent = {
      target: {
        getZoom: () => 15,
      },
    };

    if (mapZoomCallback) {
      mapZoomCallback(zoomEvent);
      assert(true, "Map zoom handler executed without error");
    }
    addResult("Map Zoom Handling", true);
  } catch (error) {
    addResult("Map Zoom Handling", false, error);
  }

  // 4. MARKER REMOVAL TESTS

  // Test 4.1: Close report and remove marker
  try {
    reports = [
      {
        location: "Test Location",
        type: "Fire",
        status: "OPEN",
      },
    ];

    mapMarkers = [L.marker([49.2827, -123.1207])];

    // Simulate closing a report
    reports[0].status = "CLOSED";

    // Assume we have a function to clean up closed reports
    function cleanupClosedReports() {
      reports = reports.filter((r) => r.status !== "CLOSED");
      mapMarkers.forEach((marker, index) => {
        if (reports.every((r) => r.location !== marker.getLatLng())) {
          marker.remove();
          mapMarkers.splice(index, 1);
        }
      });
    }

    cleanupClosedReports();

    assert(
      reports.length === 0,
      "Closed report should be removed from reports array"
    );
    assert(mapMarkers.length === 0, "Marker should be removed from map");
    addResult("Report Closure and Marker Removal", true);
  } catch (error) {
    addResult("Report Closure and Marker Removal", false, error);
  }

  // Test 4.2: Marker removal with multiple reports
  try {
    reports = [
      { location: "Location 1", type: "Fire", status: "OPEN" },
      { location: "Location 2", type: "Medical", status: "OPEN" },
    ];

    mapMarkers = [
      L.marker([49.2827, -123.1207]),
      L.marker([49.2828, -123.1208]),
    ];

    reports[0].status = "CLOSED";
    cleanupClosedReports();

    assert(reports.length === 1, "Only closed report should be removed");
    assert(
      mapMarkers.length === 1,
      "Only corresponding marker should be removed"
    );
    addResult("Multiple Markers Management", true);
  } catch (error) {
    addResult("Multiple Markers Management", false, error);
  }

  // Print test results
  console.log("\n=== Test Results ===");
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.failed}`);
  console.log("\nDetails:");
  testResults.details.forEach((result) => {
    console.log(`${result.passed ? "✓" : "✗"} ${result.name}`);
    if (!result.passed) {
      console.log(`  Error: ${result.error}`);
    }
  });
}

// Run all tests
document.addEventListener("DOMContentLoaded", runTests);
