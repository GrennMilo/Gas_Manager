# RMIC - Pressure Cylinder Management System

A comprehensive web application for tracking and managing pressurized gas cylinders throughout their lifecycle, from entry to exit, with detailed reporting capabilities and advanced OCR-based identification.

## Table of Contents

1. [Overview](#overview)
2. [Key Features](#key-features)
3. [Technical Architecture](#technical-architecture)
4. [Installation Guide](#installation-guide)
5. [User Guide](#user-guide)
6. [Configuration](#configuration)
7. [API Documentation](#api-documentation)
8. [Component Reference](#component-reference)
9. [Troubleshooting](#troubleshooting)
10. [Development Guide](#development-guide)
11. [Security Considerations](#security-considerations)
12. [Performance Optimization](#performance-optimization)
13. [Future Roadmap](#future-roadmap)
14. [License](#license)
15. [Recent Updates](#recent-updates)

## Overview

The RMIC Pressure Cylinder Management System provides a complete solution for managing gas cylinders in industrial and laboratory settings. It allows organizations to track the entire lifecycle of pressurized gas cylinders, from their initial entry into inventory to their exit and usage history.

The system combines a modern web interface with advanced technologies like Optical Character Recognition (OCR) to streamline the management process. By automating the identification and data entry of cylinders, it reduces human error and improves inventory accuracy.

### Business Value

- **Reduced Administrative Overhead**: Automates manual cylinder tracking processes
- **Improved Inventory Accuracy**: Real-time tracking of cylinder status and location
- **Enhanced Safety Compliance**: Maintains detailed records for regulatory requirements
- **Cost Optimization**: Better visibility into gas consumption patterns and cylinder usage
- **Data-Driven Decision Making**: Comprehensive reporting for resource planning

### Target Users

- Laboratory managers and technicians
- Industrial gas supply administrators
- Safety compliance officers
- Inventory managers
- Quality control personnel

## Key Features

### Cylinder Entry Management

- **OCR-Based Cylinder Recognition**: Automatically identify cylinder codes via camera
- **Batch Processing**: Handle multiple cylinders simultaneously
- **Flexible Data Entry**: Input cylinder information manually or via camera
- **Data Validation**: Prevent duplicate entries and validate code formats
- **Smart Defaults**: Suggest common gas types and pressure values

### Real-Time Stock Management

- **Comprehensive Inventory View**: See all cylinders currently in stock
- **Advanced Filtering**: Filter by gas type, physical form, and other parameters
- **Sorting Options**: Order cylinders by various criteria
- **Status Indicators**: Visual cues for cylinder status
- **Stock Summary**: At-a-glance view of inventory statistics

### Cylinder Return Processing

- **Simplified Returns**: Track returned cylinders and their residual pressure
- **Consumption Calculation**: Automatically calculate gas usage
- **Batch Returns**: Process multiple returns simultaneously
- **Return Validation**: Verify cylinder existence in stock
- **Historical Records**: Maintain complete cylinder history

### Data Reporting and Analytics

- **CSV Exports**: Generate downloadable reports in standard formats
- **Customizable Reports**: Configure report parameters and content
- **Stock Analysis**: Analyze inventory levels and trends
- **Usage Patterns**: Visualize consumption patterns over time
- **Backup Management**: Create and restore data backups

### Technical Capabilities

- **Camera Integration**: Leverage device cameras for data capture
- **OCR Processing**: Extract text from images using Tesseract.js
- **Responsive Design**: Fully functional on desktop and mobile devices
- **Offline Capability**: Core functionality works without constant server connection
- **Secure Communication**: HTTPS protocol for data security

## Technical Architecture

### Frontend Architecture

The frontend is built as a single-page application (SPA) using vanilla JavaScript with Bootstrap 5 for responsive design. This approach offers a balance of performance and simplicity while maintaining cross-browser compatibility.

#### Key Frontend Components:

1. **UI Layer**: Bootstrap 5 components provide a responsive and modern interface
2. **Application Logic**: Modular JavaScript organized in the `gasManager` object
3. **Data Capture**: Camera integration via MediaDevices API
4. **Image Processing**: OCR capabilities through Tesseract.js
5. **Notification System**: User feedback via Toastify.js
6. **Local Storage**: Caching of data for offline operations and performance

#### JavaScript Organization:

The frontend logic is encapsulated in a comprehensive JavaScript module (`gas_manager.js`), which follows an object-oriented pattern. All functionality is contained within the `gasManager` object, which provides:

- Data storage for cylinders and history
- Camera control and image processing
- User interface initialization and event handling
- Data synchronization with the server
- Form validation and error handling

### Backend Architecture

The backend is implemented as a lightweight Flask application that serves the static frontend assets and provides RESTful API endpoints for data operations.

#### Key Backend Components:

1. **Web Server**: Flask application with CORS support
2. **API Endpoints**: RESTful services for data operations
3. **File Storage**: JSON-based data persistence
4. **Report Generation**: CSV export functionality
5. **Security Layer**: HTTPS implementation with SSL certificates

#### Data Flow:

1. Client loads the SPA from the Flask server
2. Local storage is initialized with data from the server (if available)
3. User interactions trigger JavaScript functions
4. Data changes are persisted to local storage and synchronized with the server
5. Reports and exports are generated server-side and downloaded by the client

### Data Model

The application uses a simple but effective data model with two main entities:

#### Cylinder Object
```javascript
{
  code: "7563110001",       // Unique cylinder identifier
  gasType: "N2",            // Type of gas contained
  pressure: 200,            // Pressure in bar
  physicalForm: "gas",      // Physical state (gas, liquid, etc.)
  entryDate: "2023-05-20T14:30:00.000Z"  // ISO timestamp of entry
}
```

#### History Record Object
```javascript
{
  code: "7563110001",       // Cylinder identifier
  gasType: "N2",            // Type of gas
  pressureIn: 200,          // Initial pressure
  pressureOut: 40,          // Remaining pressure at return
  entryDate: "2023-05-20T14:30:00.000Z",  // Entry timestamp
  exitDate: "2023-06-15T09:45:00.000Z"    // Exit timestamp
}
```

## Installation Guide

### System Requirements

- **Server Requirements**:
  - Python 3.7 or higher
  - 1GB RAM minimum (2GB recommended)
  - 100MB free disk space (plus space for data growth)
  - Network connectivity for multi-user access

- **Client Requirements**:
  - Modern web browser (Chrome 83+, Firefox 78+, Safari 14+, Edge 84+)
  - Camera access for OCR functionality
  - JavaScript enabled
  - 1280×720 display resolution or higher (recommended)

### Installation Steps

1. **Clone or download the repository**
   ```bash
   git clone https://github.com/GrennMilo/Gas_Manager.git
   cd Gas_Manager
   ```

2. **Create a Python virtual environment (optional but recommended)**
   ```bash
   python -m venv venv
   # On Windows
   venv\Scripts\activate
   # On macOS/Linux
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install flask flask-cors cryptography
   ```

4. **Generate SSL certificates for HTTPS**
   ```bash
   python create_cert.py
   ```
   This script generates self-signed certificates in the `ssl` directory, enabling HTTPS for camera access.

5. **Customize configuration (optional)**
   - Edit `app.py` to change the port (default: 8078)
   - Modify reporting formats in the export functions

6. **Start the application**
   ```bash
   python app.py
   ```
   The application will automatically open in your default browser.

7. **Access the application**
   - Local access: `https://127.0.0.1:8078/`
   - Network access: `https://[your-IP-address]:8078/`

### Docker Installation (Alternative)

For containerized deployment, use the following steps:

1. **Build the Docker image**
   ```bash
   docker build -t gas-manager .
   ```

2. **Run the container**
   ```bash
   docker run -p 8078:8078 -v $(pwd)/reports:/app/reports gas-manager
   ```

3. **Access the application at `https://localhost:8078/`**

## User Guide

### First-Time Setup

When accessing the application for the first time:

1. **SSL Certificate Acceptance**
   - You'll see a security warning in your browser
   - Click "Advanced" or "Details"
   - Click "Proceed to site" or "Accept the risk and continue"
   - This is required for camera access and only needs to be done once per browser session

2. **System Initialization**
   - The system will initialize with empty inventory
   - Data will be stored in your browser's local storage initially
   - Click "Backup" to save data to the server for persistence

### Adding Cylinders to Inventory

#### Method 1: Manual Entry

1. Navigate to the "Cylinder Entry" section
2. Fill in the cylinder details:
   - **Cylinder Code**: The unique identifier (typically starting with 7563)
   - **Gas Type**: Select from the dropdown (H2, N2, CO2, etc.)
   - **Pressure (bar)**: The initial pressure (default: 200)
   - **Physical Form**: Gas, Liquid, or Liquid with dip tube
3. Click "Add to Stock"

#### Method 2: Camera Recognition

1. Click "Enable Camera" to activate your device camera
2. Position the cylinder code within the camera view
3. Click "Capture" to take a picture
4. The system will use OCR to recognize the code and populate the form
5. Verify and adjust the details if needed
6. Click "Add to Stock"

#### Method 3: Batch Processing

1. Enable camera and capture an image containing multiple cylinder codes
2. The system will detect multiple codes and display a batch entry form
3. Review and edit details for each cylinder
4. Optionally uncheck cylinders you don't want to add
5. Click "Add All Cylinders" to process the batch

### Managing Cylinder Stock

The Stock section provides a comprehensive view of all cylinders currently in inventory:

1. **Filtering Options**:
   - Filter by gas type using the "Gas" dropdown
   - Filter by physical form using the "Form" dropdown
   - Apply filters by clicking the "Filter" button

2. **Sorting Options**:
   - Sort by date, code, or gas type
   - Change the sort order using the dropdown

3. **Actions**:
   - Return a cylinder by clicking the "Return" button
   - Export the current stock to CSV by clicking the export icon
   - Refresh data from the server using the refresh icon

### Returning Cylinders

#### Method 1: Manual Return

1. Navigate to the "Cylinder Return" section
2. Enter the cylinder code
3. Click the search icon to verify the cylinder exists in stock
4. The system will populate the gas type and original pressure
5. Enter the residual pressure
6. Click "Return Cylinder"

#### Method 2: Camera Recognition

1. In the Return section, enable the camera
2. Capture an image of the cylinder code
3. The system will identify the code and check if it's in stock
4. Enter the residual pressure
5. Click "Return Cylinder"

#### Method 3: Batch Returns

1. Capture an image with multiple cylinder codes
2. The system will identify which cylinders are in stock
3. Enter residual pressures for each cylinder
4. Select which cylinders to include in the return
5. Click "Return Selected Cylinders"

### Viewing History

The History section displays all completed cylinder transactions:

1. **Filtering Options**:
   - Filter by date range
   - Filter by gas type
   - Sort by entry or exit date

2. **Data Displayed**:
   - Cylinder code
   - Gas type
   - Initial pressure
   - Residual pressure
   - Entry date
   - Exit date

3. **Export Options**:
   - Export history to CSV by clicking the export icon

### Generating Reports

#### Stock Report

1. Click the export icon in the Stock section
2. A CSV file will be generated and downloaded
3. The report includes all cylinders currently in stock

#### History Report

1. Click the export icon in the History section
2. A CSV file will be generated and downloaded
3. The report includes all cylinder transactions

#### Comprehensive Report

1. Click "Report Complete" in the bottom toolbar
2. A comprehensive CSV report will be generated containing:
   - Current stock summary
   - Inventory by gas type
   - Complete transaction history
   - Consumption analysis by gas type

### Data Backup and Recovery

#### Creating a Backup

1. Click "Save" in the bottom toolbar
2. The system will save all current data to the server
3. A confirmation message will appear when the backup is complete

#### Managing Backups

1. Click "Backup Manager" in the bottom toolbar
2. The Backup Manager dialog will display all available backups
3. Each backup shows:
   - Filename
   - Creation date
   - Number of cylinders
   - Number of history records

#### Restoring from Backup

1. Open the Backup Manager
2. Locate the backup you want to restore
3. Click "Load" next to the backup
4. Confirm the restoration
5. The system will load the data from the backup

### Camera Troubleshooting

If you encounter issues with the camera:

1. Click "Test Camera" in the bottom toolbar
2. The Camera Test tool will open
3. Test basic camera functionality
4. Check for permission issues
5. Verify browser compatibility

## Configuration

The application supports image capture via camera for barcode scanning and text recognition. To use this feature:

1. Click on "Enable Camera" to activate the camera
2. Frame the cylinder code - ensure proper lighting and clear view of the code
3. Click on "Capture" to acquire the image
4. The application will automatically analyze the image using OCR (Optical Character Recognition)

### Cylinder Code Recognition

The system is designed to recognize cylinder codes with the format "7563" followed by numbers. The OCR engine:

1. Processes the image to improve text recognition quality
2. Extracts cylinder codes from the processed image
3. Supports batch processing for multiple cylinders in a single image
4. Automatically fills in form fields with recognized data

### Batch Processing

When multiple cylinder codes are detected in a single image, the system will:

1. Display all recognized codes in a batch entry form
2. Allow you to review and edit details for each code
3. Process all selected cylinders at once with a single button click

## API Documentation

The application provides RESTful API endpoints for data operations. Key endpoints include:

- **Cylinder Entry**: POST /api/cylinders
- **Stock Management**: GET /api/cylinders
- **Cylinder Return**: POST /api/returns
- **Operation History**: GET /api/history
- **Data Export**: GET /api/reports
- **Data Backup**: POST /api/backup

## Component Reference

### Gas Manager Module (`gas_manager.js`)

The Gas Manager module is the core JavaScript component that handles all application logic. Below is a detailed reference of its key functions and responsibilities.

#### Initialization Functions

| Function | Description |
|----------|-------------|
| `init()` | Initializes the application, loads data, and sets up UI components |
| `initUI()` | Sets up event listeners for UI elements |
| `initMainCamera()` | Initializes the main camera for cylinder entry |
| `initReturnCamera()` | Initializes the camera for cylinder returns |
| `initTesseractWorker()` | Sets up the OCR engine for text recognition |

#### Camera Control Functions

| Function | Description |
|----------|-------------|
| `toggleMainCamera()` | Toggles the main camera on/off |
| `toggleReturnCamera()` | Toggles the return camera on/off |
| `startMainCamera()` | Activates the main camera |
| `startReturnCamera()` | Activates the return camera |
| `stopMainCamera()` | Deactivates the main camera |
| `stopReturnCamera()` | Deactivates the return camera |
| `captureImage()` | Captures an image from the main camera |
| `captureReturnImage()` | Captures an image from the return camera |

#### OCR and Image Processing Functions

| Function | Description |
|----------|-------------|
| `preprocessImage(imageDataUrl)` | Enhances image quality for better OCR results |
| `processImage(imageDataUrl)` | Processes captured image for cylinder entry |
| `processReturnImage(imageDataUrl)` | Processes captured image for cylinder return |
| `extractCylinderCode(text)` | Extracts cylinder codes from OCR text |
| `validateCylinderCode(code)` | Validates cylinder code format |
| `processExtractedCodes(codes)` | Validates and processes extracted codes |

#### Cylinder Management Functions

| Function | Description |
|----------|-------------|
| `addCylinder()` | Adds a single cylinder to inventory |
| `batchProcessCylinders(codes)` | Sets up batch processing UI for multiple cylinders |
| `addBatchCylinders()` | Processes and adds multiple cylinders |
| `returnCylinderManual()` | Processes a manual cylinder return |
| `batchProcessReturns(codes)` | Sets up batch return UI for multiple cylinders |
| `processBatchReturns()` | Processes multiple cylinder returns |
| `checkCylinderCode()` | Verifies if a cylinder exists in stock |

#### Data Management Functions

| Function | Description |
|----------|-------------|
| `saveToLocalStorage()` | Saves data to browser local storage |
| `loadFromLocalStorage()` | Loads data from browser local storage |
| `backupToServer()` | Sends data to server for backup |
| `loadFromServer()` | Loads data from the server |
| `createBackup()` | Creates a new server backup |
| `loadBackup(filename)` | Loads a specific backup from server |
| `loadBackupsList()` | Retrieves the list of available backups |

#### UI Management Functions

| Function | Description |
|----------|-------------|
| `renderStockTable()` | Renders the current inventory table |
| `renderHistoryTable()` | Renders the transaction history table |
| `updateFilterOptions()` | Updates the filter dropdown options |
| `applyStockFilters()` | Applies filters to the stock table |
| `applyHistoryFilters()` | Applies filters to the history table |
| `showNotification(message, type)` | Displays a notification to the user |
| `showCaptureEffect()` | Shows visual feedback for image capture |
| `updateDataSourceInfo(message)` | Updates the data source information display |

#### Export Functions

| Function | Description |
|----------|-------------|
| `exportStock()` | Exports current stock to CSV |
| `exportHistory()` | Exports transaction history to CSV |
| `exportAll()` | Generates a comprehensive report |

### Flask Server (`app.py`)

The Flask server provides API endpoints for data operations and serves the frontend application.

#### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serves the main application HTML |
| `/camera-test` | GET | Serves the camera test diagnostic tool |
| `/api/export-stock` | POST | Generates CSV export of current stock |
| `/api/export-history` | POST | Generates CSV export of transaction history |
| `/api/export-all` | POST | Generates comprehensive CSV report |
| `/api/extract-localstorage` | POST | Receives and stores backup data |
| `/download/<filename>` | GET | Downloads a generated file |
| `/api/load-data` | GET | Loads the most recent backup |
| `/api/list-backups` | GET | Lists all available backups |
| `/api/load-backup/<filename>` | GET | Loads a specific backup |

#### Helper Functions

| Function | Description |
|----------|-------------|
| `format_date(iso_date)` | Formats ISO date string to DD/MM/YYYY |
| `get_physical_form_label(form)` | Converts physical form code to readable label |
| `generate_timestamp()` | Generates a timestamp for filenames |
| `get_local_ip()` | Gets the local IP address of the server |
| `get_latest_backup()` | Finds the most recent backup file |
| `open_browser()` | Opens the browser after server start |

## Troubleshooting

### Camera Issues

| Problem | Possible Causes | Solution |
|---------|-----------------|----------|
| Camera not activating | Browser permissions denied | Check browser permissions and grant camera access |
| | HTTPS not properly set up | Ensure you're using HTTPS and have accepted the certificate |
| | Camera in use by another application | Close other applications using the camera |
| Poor image recognition | Insufficient lighting | Improve lighting conditions |
| | Blurry image | Hold the camera steady and ensure proper focus |
| | Damaged or dirty code | Clean the code surface or try a different angle |
| "NotAllowedError" | Permission denied | Grant camera permissions in browser settings |
| "NotFoundError" | No camera detected | Verify camera hardware is connected and working |
| "NotReadableError" | Camera already in use | Close other applications using the camera |

### Data Management Issues

| Problem | Possible Causes | Solution |
|---------|-----------------|----------|
| Data not saving | Network connectivity issues | Check network connection |
| | Server errors | Check server logs for errors |
| | Storage permissions | Ensure the reports directory is writable |
| Data loss | No backup created | Use the "Save" button to create backups regularly |
| | Corrupted backup | Restore from an earlier backup |
| Can't load backup | File not found | Verify the backup file exists in the reports directory |
| | File permissions | Check file permissions |
| | Corrupted file | Try a different backup file |

### Server Issues

| Problem | Possible Causes | Solution |
|---------|-----------------|----------|
| Server won't start | Port already in use | Change the port in app.py |
| | Missing dependencies | Ensure all required packages are installed |
| | SSL certificate issues | Run create_cert.py to regenerate certificates |
| 404 errors | Incorrect file paths | Verify file locations in the code |
| | Static files not being served | Check Flask static_folder configuration |
| Slow performance | Large data files | Consider cleaning up old backup files |
| | Limited server resources | Increase server memory or CPU allocation |

### Browser Compatibility

| Browser | Minimum Version | Known Issues |
|---------|-----------------|--------------|
| Chrome | 83+ | None |
| Firefox | 78+ | May require explicit camera permissions |
| Safari | 14+ | May have stricter HTTPS requirements |
| Edge | 84+ | None |
| Opera | 69+ | None |
| Mobile Chrome | 83+ | Camera orientation may vary by device |
| Mobile Safari | 14+ | Requires explicit camera permissions |

## Development Guide

### Project Structure

```
/
├── app.py                    # Flask server application
├── create_cert.py            # SSL certificate generation
├── gas.html                  # Main application HTML
├── gas_manager.js            # Core JavaScript functionality
├── camera_test.html          # Camera diagnostic tool
├── css/
│   └── styles.css            # Custom CSS styles
├── reports/                  # Generated reports and backups
│   ├── backup_data_*.json    # Backup files
│   ├── stock_*.csv           # Stock exports
│   ├── history_*.csv         # History exports
│   └── report_*.csv          # Comprehensive reports
└── ssl/                      # SSL certificates
    ├── cert.pem              # Certificate file
    └── key.pem               # Private key file
```

### Adding New Features

To extend the application with new features:

1. **Frontend Extensions**
   - Add new UI elements to `gas.html`
   - Implement corresponding logic in `gas_manager.js`
   - Follow the existing pattern of using the `gasManager` object

2. **Backend Extensions**
   - Add new API endpoints to `app.py`
   - Implement appropriate error handling
   - Update the data model if necessary

3. **Testing Procedure**
   - Test the feature in development
   - Verify browser compatibility
   - Ensure mobile responsiveness

### Code Style Guidelines

1. **JavaScript**
   - Use camelCase for variables and functions
   - Document functions with clear comments
   - Group related functions together
   - Use consistent error handling

2. **HTML**
   - Use semantic HTML5 elements
   - Include appropriate ARIA attributes for accessibility
   - Maintain consistent indentation

3. **Python**
   - Follow PEP 8 style guidelines
   - Use docstrings for function documentation
   - Handle exceptions appropriately

## Security Considerations

### Data Security

The application stores data in JSON format on the server. Consider these security enhancements:

1. **Data Encryption**
   - Implement encryption for sensitive data
   - Use secure hashing for any credential storage

2. **Access Controls**
   - Add user authentication and authorization
   - Implement role-based access control

3. **Data Validation**
   - Validate all user inputs on the server side
   - Sanitize data to prevent injection attacks

### Network Security

1. **HTTPS Configuration**
   - Use properly signed certificates in production
   - Configure secure TLS parameters

2. **API Security**
   - Implement rate limiting
   - Add request validation
   - Consider adding API keys or tokens

### Operational Security

1. **Backup Strategy**
   - Implement automated regular backups
   - Set up offsite backup storage

2. **Logging and Monitoring**
   - Add detailed application logging
   - Set up alerts for unusual activities

## Performance Optimization

For larger installations, consider these performance improvements:

1. **Frontend Optimization**
   - Minify and bundle JavaScript
   - Optimize image processing for faster OCR
   - Implement pagination for large data sets

2. **Backend Optimization**
   - Add caching layer
   - Optimize database queries
   - Implement server-side pagination

3. **Scaling Strategies**
   - Deploy behind a load balancer
   - Containerize for horizontal scaling
   - Separate frontend and backend services

## Future Roadmap

### Short-term Improvements

- **Barcode Scanning**: Add support for standard barcodes and QR codes
- **Mobile App**: Develop dedicated mobile applications for better offline support
- **Multi-language Support**: Add internationalization for global deployment
- **Data Visualization**: Implement charts and graphs for consumption analytics

### Medium-term Goals

- **Database Integration**: Migrate from file-based storage to a proper database
- **User Management**: Add user accounts, permissions, and audit trails
- **Supplier Integration**: Connect with supplier systems for automated reordering
- **API Expansion**: Develop a comprehensive API for third-party integration

### Long-term Vision

- **Predictive Analytics**: Implement ML-based consumption forecasting
- **IoT Integration**: Connect with smart pressure sensors for real-time monitoring
- **Blockchain Tracking**: Implement distributed ledger for secure chain of custody
- **Digital Twin**: Create virtual representations of physical cylinders

## License

MIT License

Copyright (c) 2023 RMIC

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Recent Updates

### June 2025 Updates

#### Enhanced Consumption Reporting

The gas consumption calculation has been improved to provide more accurate volume metrics:

- **Direct Volume Calculation**: Gas consumption is now calculated using the formula `consumed_liters = (pressure_difference * cylinder_volume)`, which directly measures the volume of gas consumed
- **Improved Reporting**: The "RIEPILOGO CONSUMO PER TIPO DI GAS" (Gas Consumption Summary) section in reports now clearly displays both pressure consumption (bar) and volume consumption (liters)
- **Total Consumption Metrics**: Reports now include totals for both pressure and volume consumption across all gas types

#### Report Generation Improvements

- **Comprehensive Reports**: The "Report Completo" (Complete Report) feature now generates more detailed analyses including stock status, gas type distribution, and consumption patterns
- **CSV Format Optimization**: Improved CSV formatting for better compatibility with Excel and other data analysis tools
- **Data Validation**: Enhanced validation of consumption calculations for more reliable reporting

### English Translation Guide

To translate the application interface and reporting to English, follow these steps:

#### Translating the User Interface

1. **HTML Translation**:
   - Open `gas.html` and replace Italian text with English equivalents
   - Translate button labels, form fields, and section headers
   - Maintain all HTML attributes and structure

2. **JavaScript Translation**:
   - Open `gas_manager.js` and translate user-facing messages
   - Update notification texts in the `showNotification` function calls
   - Translate validation messages and alerts

#### Translating Reports

1. **Report Headers**:
   - In `app.py`, find the `export_all`, `export_stock`, and `export_history` functions
   - Translate CSV headers and section titles from Italian to English

2. **Function Names**:
   - Consider updating function names to reflect English terminology
   - Update corresponding JavaScript function calls if necessary

3. **Date Formatting**:
   - The `format_date` function can be updated to use English date formatting if desired (MM/DD/YYYY instead of DD/MM/YYYY)

#### Key Translation References

| Italian Term | English Translation |
|--------------|---------------------|
| Bombole | Cylinders |
| Storico | History |
| Aggiungi a Stock | Add to Stock |
| Restituisci | Return |
| Codice Bombola | Cylinder Code |
| Tipo Gas | Gas Type |
| Pressione | Pressure |
| Volume Cilindro | Cylinder Volume |
| Forma Fisica | Physical Form |
| Data Ingresso | Entry Date |
| Data Uscita | Exit Date |
| Consumo | Consumption |
| Riepilogo | Summary |

> **Note**: A comprehensive translation utility is planned for a future update to support multiple languages through a configuration file. 