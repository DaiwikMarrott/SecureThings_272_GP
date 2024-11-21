# SecureThings_272_GP

Group Project for CMPT272

## ToDos:

- [ ] Update UI (make it look better than it is as of now & responsive) [Priyansh]
- [ ] Connect location to frontend + table & additional details [Luvveer + Sanchit]
- [ ] Add functionality for Emergency handler (includes passcode) [Yasir]

# Metro Vancouver 9-1-1 Emergency Call Answer System

## Project Overview

This project is a web-based emergency reporting system for Metro Vancouver’s 9-1-1 Emergency Call Answer Service. The application allows the public, including civilians, to submit emergency reports that can be monitored and reviewed by operators and first responders. The system logs essential information about each emergency, such as:

- Witness's contact information
- Type of emergency (fire, shooting, vehicle accident, medical, etc.)
- Location of the emergency
- Optional image link
- Additional comments

Operators can view, modify, and delete reports based on a passcode, with reports displayed interactively on a map.

---

## Features and Requirements

The project requirements include the following features:

1. **Interactive Map with Emergency Markers**:

   - Displays all reported emergencies on a map (using Leaflet and OpenStreetMap).
   - Allows users to interact with markers to view details.
   - Dynamically filters the emergency list based on map zoom level.

2. **Detailed Emergency Report Submission**:

   - A form to submit reports with fields for name, phone, emergency type, location, picture link, and comments.
   - Automatically logs the report’s date, time, and status (initially set to OPEN).
   - Report details are displayed interactively.

3. **Passcode-protected Modifications**:

   - Users can modify or delete reports after entering a valid passcode (to be implemented by the team).
   - MD5 hash is required for passcode storage.

4. **DOM Storage and Validation**:
   - DOM Storage API is used to save data.
   - Error handling and feedback for incorrect inputs.

---

## Technologies Used

- **HTML, CSS, JavaScript**: Core front-end development
- **Bootstrap**: Enhances UI components and styling
- **Leaflet with OpenStreetMap**: Displays emergency markers on an interactive map
- **CryptoJS**: Used for MD5 hashing of passcodes (to be implemented)
- **DOM Storage API**: Stores emergency reports locally

## Completed Components

The following components have been implemented:

1. HTML Structure:
   - **Basic structure with a navigation bar, form for submitting emergency reports, and a map section to display reports.**
   - **Comments added to explain each section, making it easy for teammates to understand.**
2. CSS Styling:
   - **Applied a red-and-white theme based on Simon Fraser University colors.**
   - **Styled navbar, form, buttons, and the map container.**
   - **Comments explain styling for each component.**
3. JavaScript Functionality:
   - **Initialized the map with Leaflet and set a central view on Vancouver.**
   - **Handled form submission for emergency reports with data validation.**
   - **Displayed emergency reports dynamically as a list and on the map as markers.**
   - **Added comments for each JavaScript function to explain its purpose and logic.**

So niggas as far as i know this is the shit that is left for us to complete

1. Passcode Protection for Modifying/Deleting Reports:
   - **Implement a passcode prompt for modification and deletion actions.**
   - **Use MD5 hashing (via CryptoJS) to store and verify the passcode.**
2. Map Integration with Leaflet API:
   - **Add functionality to update the emergency list dynamically based on map zoom level.**
   - **Highlight a marker on the map when a corresponding list item is clicked.**
3. Error Handling and Input Validation:
   - **Implement feedback for incorrect form inputs, such as an alert for invalid phone numbers.**
   - **Add error feedback for failed map operations if any issues occur with marker placements.**
4. Advanced UI Enhancements (Optional):
   - **Add animations to the search bar and other form elements.**
   - **Improve map interactivity, such as zoom-specific marker clusters (if feasible).**
