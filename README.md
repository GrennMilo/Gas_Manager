# RMIC - Pressure Cylinder Management System

A web application for managing pressurized gas cylinders, allowing tracking of inputs, outputs, consumption, and generating comprehensive reports.

## Features

- **Cylinder Entry**: Register new cylinders with code, gas type, pressure, and physical form
- **Stock Management**: View and filter cylinders currently in stock
- **Cylinder Return**: Register the return of cylinders with residual pressure
- **Operation History**: View the history of all operations
- **Data Export**: Generate CSV reports for stock, history, and comprehensive reports
- **Data Backup**: Save data on the server

## Technical Requirements

- Python 3.7+
- Flask
- Modern browser with JavaScript support

## Installation

1. Clone or download the repository
   ```
   git clone https://github.com/GrennMilo/Gas_Manager.git
   ```
2. Install dependencies:
   ```
   pip install flask flask-cors
   ```
3. Start the application:
   ```
   python app.py
   ```
4. Access the application from your browser at the URL shown in the terminal

## Using the Camera

The application supports image capture via camera for barcode scanning and text recognition. To use this feature:

1. Click on "Enable Camera" to activate the camera
2. Frame the cylinder code
3. Click on "Capture" to acquire the image
4. The application will automatically attempt to read the code

## Troubleshooting Common Issues

### Camera Access Errors

If you encounter camera access errors, verify that:

1. The browser has permission to access the camera
2. You're using HTTPS or localhost (required for the MediaDevices API)
3. The camera is not already in use by other applications

### 404 Errors for Static Files

If static files (CSS, JavaScript) are not loading:

1. Verify that the files are in the correct location
2. Restart the Flask application
3. Clear your browser's cache

## Project Structure

- `app.py`: Flask server that handles requests and serves files
- `gas.html`: Application user interface
- `gas_manager.js`: JavaScript logic for cylinder management
- `reports/`: Directory where generated reports are saved

## Technical Implementation

### Frontend
The application uses plain JavaScript with Bootstrap 5 for the UI components. Key JavaScript libraries:
- **Toastify.js**: For user notifications
- **HTML5-QRCode**: For barcode scanning capabilities
- **Tesseract.js**: For OCR (Optical Character Recognition)
- **SheetJS**: For Excel exports

### Backend
The backend is built with Flask, providing:
- File serving for the single-page application
- RESTful API endpoints for data export
- CSV generation for reports
- Local storage backup

## Security Notes

This application is designed for internal use on trusted networks. It does not implement authentication or authorization and should not be directly exposed to the Internet.

For production use, it is recommended to:
1. Implement user authentication
2. Use HTTPS
3. Configure an appropriate web server (nginx, Apache) in front of Flask
4. Implement proper data validation and sanitization

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License

## Roadmap

Future development plans include:
- Barcode scanning implementation
- OCR improvements for cylinder code recognition
- Mobile responsive design enhancements
- User authentication system
- Database integration for more robust data storage 