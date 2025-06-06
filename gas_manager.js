/**
 * Gas Cylinder Management System
 * Handles all operations for tracking gas cylinders including camera controls
 * for barcode/QR scanning and OCR.
 */

// Initialize the gas manager as an object to manage all functions
const gasManager = {
    // Data storage
    cylinders: [],
    history: [],
    
    // Initialize application
    init: function() {
        console.log('Initializing Gas Manager System');
        
        // Load data from server first, with localStorage as fallback
        this.loadFromServer()
            .then(() => {
                // Initialize UI components
                this.initUI();
                
                // Initialize camera for main scanner
                this.initMainCamera();
                
                // Initialize camera for return scanner
                this.initReturnCamera();
                
                // Populate filter options
                this.updateFilterOptions();
                
                // Render tables
                this.renderStockTable();
                this.renderHistoryTable();
                
                // Initialize Tesseract worker
                this.initTesseractWorker();
                
                // Remove automatic backup
                // setInterval(() => this.backupToServer(), 5 * 60 * 1000);
                
                this.showNotification('System successfully initialized', 'success');
            })
            .catch(error => {
                console.error('Error initializing application:', error);
                this.showNotification('Error during initialization. Using local data.', 'error');
                
                // Fall back to localStorage if server load fails
                this.loadFromLocalStorage();
                
                // Continue with initialization
                this.initUI();
                this.initMainCamera();
                this.initReturnCamera();
                this.updateFilterOptions();
                this.renderStockTable();
                this.renderHistoryTable();
                this.initTesseractWorker();
            });
    },
    
    // Initialize Tesseract worker
    initTesseractWorker: function() {
        // Initialize the Tesseract worker when app starts
        // This preloads the OCR engine for faster recognition later
        this.tesseractScheduler = null;
        
        try {
            // Create a scheduler for multiple recognition tasks
            this.tesseractScheduler = {
                addJob: async (action, image, options = {}) => {
                    // Create a worker for each job
                    const worker = await Tesseract.createWorker({
                        logger: options.logger || (() => {})
                    });
                    
                    // Initialize with English language
                    await worker.loadLanguage('eng');
                    await worker.initialize('eng');
                    
                    // Perform recognition
                    const result = await worker.recognize(image);
                    
                    // Terminate worker after job
                    await worker.terminate();
                    
                    return result;
                }
            };
            
            console.log('Tesseract scheduler initialized');
            this.showNotification('OCR system initialized', 'success');
        } catch (err) {
            console.error('Failed to create Tesseract scheduler:', err);
            this.showNotification('Unable to initialize OCR system', 'error');
        }
    },
    
    // Preprocess image for better OCR results
    preprocessImage: function(imageDataUrl) {
        return new Promise((resolve, reject) => {
            try {
                const img = new Image();
                img.onload = () => {
                    // Create a canvas to work with the image
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Set canvas size to match image
                    canvas.width = img.width;
                    canvas.height = img.height;
                    
                    // Draw the original image
                    ctx.drawImage(img, 0, 0);
                    
                    // Get image data
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imageData.data;
                    
                    // Enhance contrast and convert to grayscale
                    for (let i = 0; i < data.length; i += 4) {
                        // Convert to grayscale using luminance formula
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        
                        // Weighted luminance formula
                        let gray = 0.299 * r + 0.587 * g + 0.114 * b;
                        
                        // Enhance contrast (threshold 128)
                        gray = gray < 128 ? 0 : 255;
                        
                        // Set RGB to grayscale value
                        data[i] = gray;
                        data[i + 1] = gray;
                        data[i + 2] = gray;
                    }
                    
                    // Put the modified image data back on the canvas
                    ctx.putImageData(imageData, 0, 0);
                    
                    // Get the new data URL
                    const processedImageDataUrl = canvas.toDataURL('image/png');
                    
                    // Return both original and processed images
                    resolve({
                        original: imageDataUrl,
                        processed: processedImageDataUrl
                    });
                };
                
                img.onerror = (err) => {
                    reject(err);
                };
                
                // Set the image source to load it
                img.src = imageDataUrl;
                
            } catch (err) {
                reject(err);
            }
        });
    },
    
    // Initialize UI event listeners
    initUI: function() {
        // Main capture button
        document.getElementById('captureBtn').addEventListener('click', () => {
            this.captureImage();
        });
        
        // Return capture button
        document.getElementById('returnCaptureBtn').addEventListener('click', () => {
            this.captureReturnImage();
        });
        
        // Toggle preview buttons
        document.getElementById('togglePreviewBtn').addEventListener('click', () => {
            this.toggleMainCamera();
        });
        
        document.getElementById('returnTogglePreviewBtn').addEventListener('click', () => {
            this.toggleReturnCamera();
        });
    },
    
    // Initialize main camera
    initMainCamera: function() {
        this.mainVideoElement = document.getElementById('video');
        this.mainCanvasElement = document.getElementById('canvas');
        this.mainVideoStream = null;
        this.mainCameraActive = false;
        
        document.getElementById('togglePreviewBtn').textContent = 'Enable Camera';
    },
    
    // Initialize return camera
    initReturnCamera: function() {
        this.returnVideoElement = document.getElementById('returnVideo');
        this.returnCanvasElement = document.getElementById('returnCanvas');
        this.returnVideoStream = null;
        this.returnCameraActive = false;
        
        document.getElementById('returnTogglePreviewBtn').textContent = 'Enable Camera';
    },
    
    // Toggle main camera on/off
    toggleMainCamera: function() {
        const toggleBtn = document.getElementById('togglePreviewBtn');
        
        if (this.mainCameraActive) {
            this.stopMainCamera();
            toggleBtn.innerHTML = '<i class="fas fa-camera"></i> Enable Camera';
        } else {
            this.startMainCamera();
            toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Disable Camera';
        }
    },
    
    // Toggle return camera on/off
    toggleReturnCamera: function() {
        const toggleBtn = document.getElementById('returnTogglePreviewBtn');
        
        if (this.returnCameraActive) {
            this.stopReturnCamera();
            toggleBtn.innerHTML = '<i class="fas fa-camera"></i> Enable Camera';
        } else {
            this.startReturnCamera();
            toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Disable Camera';
        }
    },
    
    // Start main camera
    startMainCamera: function() {
        if (this.mainCameraActive) return;
        
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                const constraints = {
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                };
                
                navigator.mediaDevices.getUserMedia(constraints)
                    .then(stream => {
                        this.mainVideoElement.srcObject = stream;
                        this.mainVideoStream = stream;
                        this.mainVideoElement.play();
                        this.mainCameraActive = true;
                        
                        this.showNotification('Main camera activated', 'success');
                    })
                    .catch(err => {
                        console.error('Error accessing main camera:', err);
                        this.showNotification('Error accessing camera: ' + err.message, 'error');
                    });
            } catch (err) {
                console.error('Camera error:', err);
                this.showNotification('Camera error: ' + err.message, 'error');
            }
        } else {
            this.showNotification('Your browser does not support camera access', 'error');
        }
    },
    
    // Start return camera
    startReturnCamera: function() {
        if (this.returnCameraActive) return;
        
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                const constraints = {
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                };
                
                navigator.mediaDevices.getUserMedia(constraints)
                    .then(stream => {
                        this.returnVideoElement.srcObject = stream;
                        this.returnVideoStream = stream;
                        this.returnVideoElement.play();
                        this.returnCameraActive = true;
                        
                        this.showNotification('Return camera activated', 'success');
                    })
                    .catch(err => {
                        console.error('Error accessing return camera:', err);
                        this.showNotification('Error accessing camera: ' + err.message, 'error');
                        
                        // Show specific instructions for common errors
                        if (err.name === 'NotAllowedError') {
                            this.showNotification('Camera permission denied. Check browser settings', 'error');
                        } else if (err.name === 'NotFoundError') {
                            this.showNotification('No camera found on this device', 'error');
                        } else if (err.name === 'NotReadableError') {
                            this.showNotification('The camera is already in use by another application', 'error');
                        }
                    });
            } catch (err) {
                console.error('Camera error:', err);
                this.showNotification('Camera error: ' + err.message, 'error');
            }
        } else {
            this.showNotification('Your browser does not support camera access', 'error');
        }
    },
    
    // Stop main camera
    stopMainCamera: function() {
        if (!this.mainCameraActive) return;
        
        if (this.mainVideoStream) {
            const tracks = this.mainVideoStream.getTracks();
            tracks.forEach(track => track.stop());
            this.mainVideoElement.srcObject = null;
            this.mainVideoStream = null;
            this.mainCameraActive = false;
        }
    },
    
    // Stop return camera
    stopReturnCamera: function() {
        if (!this.returnCameraActive) return;
        
        if (this.returnVideoStream) {
            const tracks = this.returnVideoStream.getTracks();
            tracks.forEach(track => track.stop());
            this.returnVideoElement.srcObject = null;
            this.returnVideoStream = null;
            this.returnCameraActive = false;
        }
    },
    
    // Capture image from main camera
    captureImage: function() {
        if (!this.mainCameraActive) {
            this.showNotification('Please activate the camera first', 'warning');
            return;
        }
        
        const canvas = this.mainCanvasElement;
        const video = this.mainVideoElement;
        const context = canvas.getContext('2d');
        
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw video frame on canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Get image data
        const imageDataUrl = canvas.toDataURL('image/png');
        
        // Process the image
        this.processImage(imageDataUrl);
        
        // Show visual feedback
        this.showCaptureEffect();
    },
    
    // Capture image from return camera
    captureReturnImage: function() {
        if (!this.returnCameraActive) {
            this.showNotification('Please activate the camera first', 'warning');
            return;
        }
        
        const canvas = this.returnCanvasElement;
        const video = this.returnVideoElement;
        const context = canvas.getContext('2d');
        
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw video frame on canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Get image data
        const imageDataUrl = canvas.toDataURL('image/png');
        
        // Process the image for return
        this.processReturnImage(imageDataUrl);
        
        // Show visual feedback
        this.showReturnCaptureEffect();
    },
    
    // Extract cylinder code from OCR text
    extractCylinderCode: function(text) {
        if (!text) return [];
        
        console.log('Original OCR text for extraction:', text);
        
        // Normalize text by removing extra spaces and newlines for better pattern matching
        const normalizedText = text.replace(/\s+/g, ' ').trim();
        console.log('Normalized text:', normalizedText);
        
        // Pre-process the text to handle common OCR confusions
        // 1. Replace O/o with 0
        // 2. Replace I/l with 1
        // 3. Remove spaces between digits
        let processedText = normalizedText
            .replace(/[Oo]/g, '0') // Replace O/o with 0
            .replace(/[Il]/g, '1') // Replace I/l with 1
            .replace(/(\d)\s+(\d)/g, '$1$2'); // Remove spaces between digits
            
        console.log('Processed text:', processedText);
        
        // Array to collect all potential matches
        let allMatches = [];
        
        // Step 1: Look for codes with standard format: 756311-xxxxxxxx
        // This handles the hyphen format that's commonly used
        const hyphenPattern = /756311[\s\-]?[0-9]{8}/g;
        const hyphenMatches = processedText.match(hyphenPattern) || [];
        
        if (hyphenMatches.length > 0) {
            console.log('Found standard format codes:', hyphenMatches);
            allMatches.push(...hyphenMatches);
        }
        
        // Step 2: Look for the specific pattern 756311 followed by numbers (with possible OCR errors)
        // This regex looks for "756311" (or similar patterns) followed by numbers
        // It allows for spaces between digits that might be introduced by OCR
        const specificRegex = /756311[ ]?[0-9O0oIl1 \-]+/g;
        const specificMatches = processedText.match(specificRegex) || [];
        
        if (specificMatches.length > 0) {
            console.log('Found specific pattern matches:', specificMatches);
            
            // Clean up the matches by removing spaces and standardizing characters
            const cleanedMatches = specificMatches.map(match => {
                return match.replace(/\s+/g, '') // Remove all spaces
                            .replace(/[Oo]/g, '0') // Replace O/o with 0
                            .replace(/[Il]/g, '1') // Replace I/l with 1
                            .replace(/\-/g, ''); // Remove all hyphens
            });
            
            allMatches.push(...cleanedMatches);
        }
        
        // Step 3: Check original text for any numbers that might start with 756311
        // This is a broader search in case the specific pattern wasn't matched due to OCR errors
        const anyNumberRegex = /\b\d{6,}\b/g;
        const numberMatches = processedText.match(anyNumberRegex) || [];
        
        // Filter for numbers that start with 756311 or similar patterns
        const potentialMatches = numberMatches.filter(num => {
            return num.startsWith('756311');
        });
        
        if (potentialMatches.length > 0) {
            console.log('Found potential number matches:', potentialMatches);
            allMatches.push(...potentialMatches);
        }
        
        // Step 4: Look for any sequence of digits that might be a cylinder code
        if (allMatches.length === 0) {
            console.log('No specific matches found, falling back to general number detection');
            
            // Look for long digit sequences that might be codes with the prefix
            const genericNumberRegex = /\b\d{10,}\b/g;
            const genericMatches = processedText.match(genericNumberRegex) || [];
            
            allMatches.push(...genericMatches);
        }
        
        // Step 5: Advanced pattern detection (for severely distorted OCR)
        // This pattern looks for text that might be a code but with severe OCR issues
        if (allMatches.length === 0) {
            // This regex looks for patterns that might be cylinder codes but with severe distortion
            const fuzzyRegex = /7[ \-_.]*5[ \-_.]*6[ \-_.]*3[ \-_.]*1[ \-_.]*1[ \-_.]*[\d\s\-_.]+/g;
            const fuzzyMatches = normalizedText.match(fuzzyRegex) || [];
            
            if (fuzzyMatches.length > 0) {
                console.log('Found fuzzy matches:', fuzzyMatches);
                
                // Clean up fuzzy matches by removing non-digit characters
                const cleanedFuzzyMatches = fuzzyMatches.map(match => {
                    // First replace common OCR errors
                    let cleaned = match.replace(/[Oo]/g, '0') // Replace O/o with 0
                                      .replace(/[Il]/g, '1'); // Replace I/l with 1
                    
                    // Remove all non-digit characters
                    cleaned = cleaned.replace(/[^\d]/g, '');
                    
                    return cleaned;
                });
                
                allMatches.push(...cleanedFuzzyMatches);
            }
        }
        
        // Remove duplicates and empty strings
        const uniqueMatches = [...new Set(allMatches)].filter(match => match && match.length >= 6);
        console.log('Final unique matches before validation:', uniqueMatches);
        
        return uniqueMatches;
    },
    
    // Validate cylinder code
    validateCylinderCode: function(code) {
        if (!code) return false;
        
        // Convert to string in case it's a number
        const codeStr = String(code);
        
        // 1. Clean the code - remove all non-digit characters including spaces and hyphens
        let cleanedCode = codeStr.replace(/[^\d]/g, '');
        
        console.log('Code after cleaning:', cleanedCode);
        
        // 2. Check if it starts with the required prefix 756311
        if (!cleanedCode.startsWith('756311')) {
            console.log('Code rejected: Does not start with 756311');
            return false;
        }
        
        // 3. Ensure exact length of 14 digits
        if (cleanedCode.length < 14) {
            // Pad with zeros if needed to reach 14 digits
            cleanedCode = cleanedCode.padEnd(14, '0');
            console.log('Code padded to 14 digits:', cleanedCode);
        } else if (cleanedCode.length > 14) {
            // Truncate to 14 digits if longer
            cleanedCode = cleanedCode.substring(0, 14);
            console.log('Code truncated to 14 digits:', cleanedCode);
        }
        
        // Format the code for display/storage (optional: add hyphen after prefix)
        // const formattedCode = cleanedCode.substring(0, 6) + '-' + cleanedCode.substring(6);
        // console.log('Final formatted code:', formattedCode);
        
        return cleanedCode;
    },
    
    // Process extracted codes with validation
    processExtractedCodes: function(codes) {
        if (!codes || codes.length === 0) return [];
        
        // Validate each code and remove invalid ones
        const validatedCodes = codes
            .map(code => this.validateCylinderCode(code))
            .filter(code => code !== false);
            
        console.log('Validated codes:', validatedCodes);
        
        // If no valid codes found, but we had potential codes, try a more lenient approach
        if (validatedCodes.length === 0 && codes.length > 0) {
            console.log('No valid codes found, trying more lenient validation');
            
            // More lenient validation - if any code contains 756311 sequence
            const lenientCodes = codes
                .map(code => {
                    // If the code contains 756311 anywhere, extract from that point onwards
                    const match = String(code).match(/756311\d*/);
                    if (match) {
                        let extractedCode = match[0];
                        // Ensure it's 14 digits (including the 756311 prefix)
                        if (extractedCode.length < 14) {
                            extractedCode = extractedCode.padEnd(14, '0');
                        } else if (extractedCode.length > 14) {
                            extractedCode = extractedCode.substring(0, 14);
                        }
                        return extractedCode;
                    }
                    return false;
                })
                .filter(code => code !== false);
                
            console.log('Lenient validation results:', lenientCodes);
            return lenientCodes;
        }
        
        return validatedCodes;
    },
    
    // Batch processing of cylinders
    batchProcessCylinders: function(codes) {
        if (!codes || codes.length === 0) {
            this.showNotification('No cylinder codes detected', 'warning');
            return;
        }
        
        // Create a container for batch cylinders if it doesn't exist
        let batchContainer = document.getElementById('batchCylindersContainer');
        if (!batchContainer) {
            batchContainer = document.createElement('div');
            batchContainer.id = 'batchCylindersContainer';
            batchContainer.className = 'mt-3 p-3 border rounded bg-light';
            
            const heading = document.createElement('h5');
            heading.textContent = 'Detected Cylinders';
            batchContainer.appendChild(heading);
            
            const formsContainer = document.getElementById('cylinderFormsContainer');
            if (formsContainer) {
                formsContainer.innerHTML = '';
                formsContainer.appendChild(batchContainer);
            }
        } else {
            batchContainer.innerHTML = '';
            const heading = document.createElement('h5');
            heading.textContent = 'Detected Cylinders';
            batchContainer.appendChild(heading);
        }
        
        // Add stock summary before the forms
        const stockSummary = document.createElement('div');
        stockSummary.className = 'mb-3 p-2 border-bottom';
        stockSummary.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <h6 class="mb-0">Current Stock: ${this.cylinders.length} cylinders</h6>
                <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="collapse" 
                        data-bs-target="#stockSummaryCollapse" aria-expanded="false" aria-controls="stockSummaryCollapse">
                    <i class="fas fa-eye"></i> Show Stock
                </button>
            </div>
            <div class="collapse mt-2" id="stockSummaryCollapse">
                <div class="card card-body p-2">
                    <div class="table-responsive" style="max-height: 200px; overflow-y: auto;">
                        <table class="table table-sm table-hover">
                            <thead>
                                <tr>
                                    <th>Code</th>
                                    <th>Gas</th>
                                    <th>Pressure</th>
                                    <th>Volume</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.cylinders.length > 0 ? 
                                    this.cylinders.map(cylinder => `
                                        <tr>
                                            <td>${this.formatCylinderCode(cylinder.code)}</td>
                                            <td>${cylinder.gasType}</td>
                                            <td>${cylinder.pressure} bar</td>
                                            <td>${cylinder.cylinderVolume || '50'} L</td>
                                        </tr>
                                    `).join('') : 
                                    '<tr><td colspan="4" class="text-center">No cylinders in stock</td></tr>'
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        batchContainer.appendChild(stockSummary);
        
        // Create a form for each detected code
        codes.forEach((code, index) => {
            // Format the code for display
            const formattedCode = this.formatCylinderCode(code);
            
            // Check if cylinder already exists in stock
            const existingCylinder = this.cylinders.find(c => c.code === code);
            const cylinderForm = document.createElement('div');
            cylinderForm.className = 'batch-cylinder-form mb-3 p-2 border-bottom';
            
            // If the cylinder exists, show it differently
            if (existingCylinder) {
                cylinderForm.innerHTML = `
                    <div class="alert alert-warning mb-2">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Cylinder ${formattedCode} already exists in stock (${existingCylinder.gasType}, ${existingCylinder.pressure} bar)
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group mb-2">
                                <label>Cylinder Code</label>
                                <input type="text" class="form-control batch-cylinder-code" value="${code}" required>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group mb-2">
                                <label>Gas Type</label>
                                <select class="form-select batch-cylinder-gas" disabled>
                                    <option value="${existingCylinder.gasType}" selected>${existingCylinder.gasType}</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group mb-2">
                                <label>Pressure (bar)</label>
                                <input type="number" class="form-control batch-cylinder-pressure" value="${existingCylinder.pressure}" disabled>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group mb-2">
                                <label>Cylinder Volume (L)</label>
                                <input type="number" class="form-control batch-cylinder-volume" value="${existingCylinder.cylinderVolume || '50'}" disabled>
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-12">
                            <div class="form-group mb-2">
                                <label>Physical Form</label>
                                <select class="form-select batch-cylinder-form" disabled>
                                    <option value="${existingCylinder.physicalForm}" selected>${this.getPhysicalFormLabel(existingCylinder.physicalForm)}</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input batch-cylinder-include" type="checkbox" id="includeCylinder-${index}" disabled>
                        <label class="form-check-label text-muted" for="includeCylinder-${index}">
                            Automatically excluded (duplicate)
                        </label>
                    </div>
                `;
            } else {
                cylinderForm.innerHTML = `
                    <div class="alert alert-success mb-2">
                        <i class="fas fa-check-circle me-2"></i>
                        New cylinder - ready to be added
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group mb-2">
                                <label>Cylinder Code</label>
                                <input type="text" class="form-control batch-cylinder-code" value="${code}" required>
                                <small class="text-muted">Format: ${formattedCode}</small>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group mb-2">
                                <label>Gas Type</label>
                                <select class="form-select batch-cylinder-gas" required>
                                    <option value="">Select...</option>
                                    <option value="H2">H2</option>
                                    <option value="N2">N2</option>
                                    <option value="CO2">CO2</option>
                                    <option value="NH3">NH3</option>
                                    <option value="N2 50ppm">N2 50 ppm</option>
                                    <option value="N2 450ppm">N2 450 ppm</option>
                                    <option value="Air">Air</option>
                                    <option value="He">He</option>
                                    <option value="Mix">Mix</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group mb-2">
                                <label>Pressure (bar)</label>
                                <input type="number" class="form-control batch-cylinder-pressure" value="200" min="0" required>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group mb-2">
                                <label>Cylinder Volume (L)</label>
                                <input type="number" class="form-control batch-cylinder-volume" value="50" min="0" required>
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-12">
                            <div class="form-group mb-2">
                                <label>Physical Form</label>
                                <select class="form-select batch-cylinder-form" required>
                                    <option value="gas" selected>Gas</option>
                                    <option value="liquid">Liquid</option>
                                    <option value="liquidWithDip">Liquid with dip tube</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input batch-cylinder-include" type="checkbox" id="includeCylinder-${index}" checked>
                        <label class="form-check-label" for="includeCylinder-${index}">
                            Include in addition
                        </label>
                    </div>
                `;
            }
            
            batchContainer.appendChild(cylinderForm);
        });
        
        // Count new and duplicate cylinders
        const newCount = codes.filter(code => !this.cylinders.some(c => c.code === code)).length;
        const duplicateCount = codes.length - newCount;
        
        // Add button to add all cylinders
        const addAllButton = document.createElement('button');
        addAllButton.className = 'btn btn-success w-100';
        addAllButton.innerHTML = `<i class="fas fa-plus-circle me-2"></i>Add ${newCount} New Cylinders`;
        if (newCount === 0) {
            addAllButton.disabled = true;
            addAllButton.innerHTML = '<i class="fas fa-ban me-2"></i>All cylinders are already in stock';
        }
        addAllButton.onclick = () => this.addBatchCylinders();
        
        batchContainer.appendChild(addAllButton);
        
        // Add summary of what was found
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'mt-2 text-center text-muted small';
        summaryDiv.innerHTML = `
            <p>Detected ${codes.length} cylinders: ${newCount} new, ${duplicateCount} already in stock</p>
        `;
        batchContainer.appendChild(summaryDiv);
        
        this.showNotification(`Detected ${codes.length} cylinders (${newCount} new, ${duplicateCount} duplicates)`, 'success');
    },
    
    // Add all cylinders from batch processing
    addBatchCylinders: function() {
        const container = document.getElementById('batchCylindersContainer');
        if (!container) return;
        
        const forms = container.querySelectorAll('.batch-cylinder-form');
        let addedCount = 0;
        let skippedCount = 0;
        
        forms.forEach(form => {
            // Skip if checkbox is unchecked or disabled (already in stock)
            const includeCheckbox = form.querySelector('.batch-cylinder-include');
            if (!includeCheckbox || !includeCheckbox.checked || includeCheckbox.disabled) {
                skippedCount++;
                return;
            }
            
            const code = form.querySelector('.batch-cylinder-code').value.trim();
            const gasType = form.querySelector('.batch-cylinder-gas').value;
            const pressure = form.querySelector('.batch-cylinder-pressure').value;
            const cylinderVolume = form.querySelector('.batch-cylinder-volume').value;
            const physicalForm = form.querySelector('.batch-cylinder-form').value;
            
            // Validate input
            if (!code || !gasType || !pressure || !cylinderVolume) {
                skippedCount++;
                console.log(`Skipping cylinder ${code}: missing required fields`);
                return; // Skip invalid entries
            }
            
            // Double-check if cylinder already exists (in case the UI wasn't updated)
            if (this.cylinders.some(c => c.code === code)) {
                this.showNotification(`Cylinder ${code} already exists in stock`, 'warning');
                skippedCount++;
                return; // Skip duplicates
            }
            
            // Create new cylinder object
            const newCylinder = {
                code,
                gasType,
                pressure,
                cylinderVolume,
                physicalForm,
                entryDate: new Date().toISOString()
            };
            
            // Add to cylinders array
            this.cylinders.push(newCylinder);
            addedCount++;
        });
        
        if (addedCount > 0) {
            // Save to localStorage
            this.saveToLocalStorage();
            
            // Update UI
            this.renderStockTable();
            this.updateFilterOptions();
            
            // Clear the batch container
            container.innerHTML = '';
            
            this.showNotification(`Added ${addedCount} cylinders successfully`, 'success');
            
            // Don't automatically backup to server anymore
            // this.backupToServer();
        } else {
            if (skippedCount > 0) {
                this.showNotification(`No cylinders added, ${skippedCount} invalid or duplicates`, 'warning');
            } else {
                this.showNotification('No cylinders added, please check the data entered', 'warning');
            }
        }
    },
    
    // Process captured image with OCR
    processImage: function(imageDataUrl) {
        this.showNotification('Image captured, OCR processing in progress...', 'info');
        
        // Check if Tesseract is initialized
        if (!this.tesseractScheduler) {
            this.showNotification('OCR system not initialized, please try again', 'error');
            return;
        }
        
        // Preprocess the image for better OCR results
        this.preprocessImage(imageDataUrl)
            .then(images => {
                // Perform OCR on the processed image
                this.tesseractScheduler.addJob('recognize', images.processed, {
                    logger: message => {
                        if (message.status === 'recognizing text') {
                            const progressBar = document.querySelector('#progressBar .progress');
                            if (progressBar) {
                                progressBar.style.width = `${message.progress * 100}%`;
                            }
                        }
                    }
                }).then(result => {
                    console.log('OCR Result:', result);
                    
                    // Extract text from the result
                    const text = result.data.text;
                    console.log('Extracted Text:', text);
                    
                    // Extract and validate cylinder codes
                    const extractedCodes = this.extractCylinderCode(text);
                    const validCylinderCodes = this.processExtractedCodes(extractedCodes);
                    
                    if (validCylinderCodes && validCylinderCodes.length > 0) {
                        // Check if it's a single code or multiple codes
                        if (validCylinderCodes.length === 1) {
                            // Single code - use the existing form
                            document.getElementById('cylinderCode').value = validCylinderCodes[0];
                            
                            // Try to extract gas type (common types like H2, N2, etc.)
                            const gasRegex = /\b(H2|N2|CO2|NH3|N2p|Air)\b/i;
                            const gasMatch = text.match(gasRegex);
                            
                            if (gasMatch && gasMatch.length > 0) {
                                document.getElementById('gasType').value = gasMatch[0].toUpperCase();
                            }
                            
                            this.showNotification(`Cylinder code detected: ${validCylinderCodes[0]}`, 'success');
                        } else {
                            // Multiple codes - use batch processing
                            this.batchProcessCylinders(validCylinderCodes);
                        }
                    } else {
                        // If no codes found in processed image, try with the original
                        this.tesseractScheduler.addJob('recognize', images.original)
                            .then(originalResult => {
                                const originalText = originalResult.data.text;
                                const originalExtractedCodes = this.extractCylinderCode(originalText);
                                const originalValidCodes = this.processExtractedCodes(originalExtractedCodes);
                                
                                if (originalValidCodes && originalValidCodes.length > 0) {
                                    if (originalValidCodes.length === 1) {
                                        document.getElementById('cylinderCode').value = originalValidCodes[0];
                                        this.showNotification(`Cylinder code detected: ${originalValidCodes[0]}`, 'success');
                                    } else {
                                        this.batchProcessCylinders(originalValidCodes);
                                    }
                                } else {
                                    this.showNotification('No cylinder code detected, please enter manually', 'warning');
                                }
                            })
                            .catch(err => {
                                console.error('Original Image OCR Error:', err);
                                this.showNotification('No cylinder code detected, please enter manually', 'warning');
                            });
                    }
                    
                }).catch(err => {
                    console.error('OCR Error:', err);
                    this.showNotification('Error during OCR processing: ' + err.message, 'error');
                });
            })
            .catch(err => {
                console.error('Image Preprocessing Error:', err);
                this.showNotification('Error during image preprocessing', 'error');
                
                // Fallback to original image if preprocessing fails
                this.tesseractScheduler.addJob('recognize', imageDataUrl)
                    .then(result => {
                        const text = result.data.text;
                        const extractedCodes = this.extractCylinderCode(text);
                        const validCodes = this.processExtractedCodes(extractedCodes);
                        
                        if (validCodes && validCodes.length > 0) {
                            if (validCodes.length === 1) {
                                document.getElementById('cylinderCode').value = validCodes[0];
                                this.showNotification(`Cylinder code detected: ${validCodes[0]}`, 'success');
                            } else {
                                this.batchProcessCylinders(validCodes);
                            }
                        } else {
                            this.showNotification('No cylinder code detected, please enter manually', 'warning');
                        }
                    })
                    .catch(err => {
                        this.showNotification('Error during OCR processing', 'error');
                    });
            });
    },
    
    // Process captured return image with OCR
    processReturnImage: function(imageDataUrl) {
        this.showNotification('Immagine acquisita, elaborazione OCR in corso...', 'info');
        
        // Check if Tesseract is initialized
        if (!this.tesseractScheduler) {
            this.showNotification('Sistema OCR non inizializzato, riprovare', 'error');
            return;
        }
        
        // Preprocess the image for better OCR results
        this.preprocessImage(imageDataUrl)
            .then(images => {
                // Perform OCR on the processed image
                this.tesseractScheduler.addJob('recognize', images.processed, {
                    logger: message => {
                        if (message.status === 'recognizing text') {
                            const progressBar = document.querySelector('#returnProgressBar .progress');
                            if (progressBar) {
                                progressBar.style.width = `${message.progress * 100}%`;
                            }
                        }
                    }
                }).then(result => {
                    console.log('Return OCR Result:', result);
                    
                    // Extract text from the result
                    const text = result.data.text;
                    console.log('Extracted Return Text:', text);
                    
                    // Extract and validate cylinder codes
                    const extractedCodes = this.extractCylinderCode(text);
                    const validCylinderCodes = this.processExtractedCodes(extractedCodes);
                    
                    if (validCylinderCodes && validCylinderCodes.length > 0) {
                        // Check if it's a single code or multiple codes
                        if (validCylinderCodes.length === 1) {
                            // Single code - use the existing form
                            const cylinderCode = validCylinderCodes[0];
                            document.getElementById('manualReturnCode').value = cylinderCode;
                            this.showNotification(`Codice bombola rilevato: ${cylinderCode}`, 'success');
                            
                            // Check if the cylinder exists in stock
                            const cylinder = this.cylinders.find(c => c.code === cylinderCode);
                            
                            if (cylinder) {
                                document.getElementById('manualReturnGasType').value = cylinder.gasType;
                                document.getElementById('manualReturnPressureIn').value = cylinder.pressure;
                                document.getElementById('manualReturnPressureOut').value = Math.floor(cylinder.pressure * 0.2); // Default to 20% remaining
                                
                                this.showNotification('Bombola trovata in stock', 'success');
                            } else {
                                this.showNotification('Bombola non trovata in stock', 'warning');
                            }
                        } else {
                            // Multiple codes - use batch processing for returns
                            this.batchProcessReturns(validCylinderCodes);
                        }
                    } else {
                        // If no codes found in processed image, try with the original
                        this.tesseractScheduler.addJob('recognize', images.original)
                            .then(originalResult => {
                                const originalText = originalResult.data.text;
                                const originalExtractedCodes = this.extractCylinderCode(originalText);
                                const originalValidCodes = this.processExtractedCodes(originalExtractedCodes);
                                
                                if (originalValidCodes && originalValidCodes.length > 0) {
                                    if (originalValidCodes.length === 1) {
                                        const cylinderCode = originalValidCodes[0];
                                        document.getElementById('manualReturnCode').value = cylinderCode;
                                        
                                        // Check if cylinder exists in stock
                                        const cylinder = this.cylinders.find(c => c.code === cylinderCode);
                                        if (cylinder) {
                                            document.getElementById('manualReturnGasType').value = cylinder.gasType;
                                            document.getElementById('manualReturnPressureIn').value = cylinder.pressure;
                                            document.getElementById('manualReturnPressureOut').value = Math.floor(cylinder.pressure * 0.2);
                                            this.showNotification('Bombola trovata in stock', 'success');
                                        } else {
                                            this.showNotification('Bombola non trovata in stock', 'warning');
                                        }
                                    } else {
                                        this.batchProcessReturns(originalValidCodes);
                                    }
                                } else {
                                    this.showNotification('Nessun codice bombola rilevato, inserire manualmente', 'warning');
                                }
                            })
                            .catch(err => {
                                console.error('Original Image OCR Error:', err);
                                this.showNotification('Nessun codice bombola rilevato, inserire manualmente', 'warning');
                            });
                    }
                    
                }).catch(err => {
                    console.error('Return OCR Error:', err);
                    this.showNotification('Errore durante l\'elaborazione OCR: ' + err.message, 'error');
                });
            })
            .catch(err => {
                console.error('Image Preprocessing Error:', err);
                this.showNotification('Errore durante il preprocessing dell\'immagine', 'error');
                
                // Fallback to original image if preprocessing fails
                this.tesseractScheduler.addJob('recognize', imageDataUrl)
                    .then(result => {
                        const text = result.data.text;
                        const extractedCodes = this.extractCylinderCode(text);
                        const validCodes = this.processExtractedCodes(extractedCodes);
                        
                        if (validCodes && validCodes.length > 0) {
                            if (validCodes.length === 1) {
                                const cylinderCode = validCodes[0];
                                document.getElementById('manualReturnCode').value = cylinderCode;
                                
                                // Check if cylinder exists in stock
                                const cylinder = this.cylinders.find(c => c.code === cylinderCode);
                                if (cylinder) {
                                    document.getElementById('manualReturnGasType').value = cylinder.gasType;
                                    document.getElementById('manualReturnPressureIn').value = cylinder.pressure;
                                    document.getElementById('manualReturnPressureOut').value = Math.floor(cylinder.pressure * 0.2);
                                    this.showNotification('Bombola trovata in stock', 'success');
                                } else {
                                    this.showNotification('Bombola non trovata in stock', 'warning');
                                }
                            } else {
                                this.batchProcessReturns(validCodes);
                            }
                        } else {
                            this.showNotification('Nessun codice bombola rilevato, inserire manualmente', 'warning');
                        }
                    })
                    .catch(err => {
                        this.showNotification('Errore durante l\'elaborazione OCR', 'error');
                    });
            });
    },
    
    // Batch processing of cylinder returns
    batchProcessReturns: function(codes) {
        if (!codes || codes.length === 0) {
            this.showNotification('Nessun codice bombola rilevato', 'warning');
            return;
        }
        
        // Create a container for batch returns if it doesn't exist
        let batchContainer = document.getElementById('batchReturnsContainer');
        if (!batchContainer) {
            batchContainer = document.createElement('div');
            batchContainer.id = 'batchReturnsContainer';
            batchContainer.className = 'mt-3 p-3 border rounded bg-light';
            
            const heading = document.createElement('h5');
            heading.textContent = 'Restituzione Bombole';
            batchContainer.appendChild(heading);
            
            const formsContainer = document.getElementById('returnFormsContainer');
            if (formsContainer) {
                formsContainer.innerHTML = '';
                formsContainer.appendChild(batchContainer);
            }
        } else {
            batchContainer.innerHTML = '';
            const heading = document.createElement('h5');
            heading.textContent = 'Restituzione Bombole';
            batchContainer.appendChild(heading);
        }
        
        // Add stock summary before the forms
        const stockSummary = document.createElement('div');
        stockSummary.className = 'mb-3 p-2 border-bottom';
        stockSummary.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <h6 class="mb-0">Stock Attuale: ${this.cylinders.length} bombole</h6>
                <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="collapse" 
                        data-bs-target="#returnStockSummaryCollapse" aria-expanded="false" aria-controls="returnStockSummaryCollapse">
                    <i class="fas fa-eye"></i> Mostra Stock
                </button>
            </div>
            <div class="collapse mt-2" id="returnStockSummaryCollapse">
                <div class="card card-body p-2">
                    <div class="table-responsive" style="max-height: 200px; overflow-y: auto;">
                        <table class="table table-sm table-hover">
                            <thead>
                                <tr>
                                    <th>Codice</th>
                                    <th>Gas</th>
                                    <th>Pressione</th>
                                    <th>Volume</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.cylinders.length > 0 ? 
                                    this.cylinders.map(cylinder => `
                                        <tr>
                                            <td>${this.formatCylinderCode(cylinder.code)}</td>
                                            <td>${cylinder.gasType}</td>
                                            <td>${cylinder.pressure} bar</td>
                                            <td>${cylinder.cylinderVolume || '50'} L</td>
                                        </tr>
                                    `).join('') : 
                                    '<tr><td colspan="4" class="text-center">Nessuna bombola in stock</td></tr>'
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        batchContainer.appendChild(stockSummary);
        
        // Count found and not found cylinders
        let foundCount = 0;
        let notFoundCount = 0;
        
        // Create a form for each detected code
        codes.forEach((code, index) => {
            // Format the code for display
            const formattedCode = this.formatCylinderCode(code);
            
            // Check if the cylinder exists in stock
            const cylinder = this.cylinders.find(c => c.code === code);
            
            const returnForm = document.createElement('div');
            returnForm.className = 'batch-return-form mb-3 p-2 border-bottom';
            
            if (cylinder) {
                foundCount++;
                const suggestedPressureOut = Math.floor(cylinder.pressure * 0.2); // Default to 20% remaining
                
                returnForm.innerHTML = `
                    <div class="alert alert-success mb-2">
                        <i class="fas fa-check-circle me-2"></i>
                        Bombola trovata in stock
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group mb-2">
                                <label>Codice Bombola</label>
                                <input type="text" class="form-control batch-return-code" value="${code}" required>
                                <input type="hidden" class="batch-return-original-code" value="${code}">
                                <small class="text-muted">Format: ${formattedCode}</small>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group mb-2">
                                <label>Tipo Gas</label>
                                <input type="text" class="form-control batch-return-gas" value="${cylinder.gasType}" readonly>
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-4">
                            <div class="form-group mb-2">
                                <label>Pressione Originale (bar)</label>
                                <input type="number" class="form-control batch-return-pressure-in" value="${cylinder.pressure}" readonly>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-group mb-2">
                                <label>Volume Cilindro (L)</label>
                                <input type="number" class="form-control batch-return-volume" value="${cylinder.cylinderVolume || '50'}" readonly>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-group mb-2">
                                <label>Pressione Residua (bar)</label>
                                <input type="number" class="form-control batch-return-pressure-out" value="${suggestedPressureOut}" min="0">
                            </div>
                        </div>
                    </div>
                    <div class="form-check mb-2">
                        <input class="form-check-input batch-return-include" type="checkbox" id="includeReturn-${index}" checked>
                        <label class="form-check-label" for="includeReturn-${index}">Includi nella restituzione</label>
                    </div>
                `;
            } else {
                notFoundCount++;
                returnForm.innerHTML = `
                    <div class="alert alert-danger mb-2">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Bombola non trovata in stock
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group mb-2">
                                <label>Codice Bombola</label>
                                <input type="text" class="form-control batch-return-code" value="${code}" required>
                                <small class="text-muted">Format: ${formattedCode}</small>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="alert alert-warning py-1 mb-0">
                                <small>Bombola non trovata in stock</small>
                            </div>
                        </div>
                    </div>
                    <div class="form-check mb-2">
                        <input class="form-check-input batch-return-include" type="checkbox" id="includeReturn-${index}" disabled>
                        <label class="form-check-label text-muted" for="includeReturn-${index}">Non può essere restituita</label>
                    </div>
                `;
            }
            
            batchContainer.appendChild(returnForm);
        });
        
        // Add button to process all returns
        const returnAllButton = document.createElement('button');
        returnAllButton.className = 'btn btn-danger w-100';
        returnAllButton.innerHTML = `<i class="fas fa-undo me-2"></i>Restituisci ${foundCount} Bombole Selezionate`;
        if (foundCount === 0) {
            returnAllButton.disabled = true;
            returnAllButton.innerHTML = '<i class="fas fa-ban me-2"></i>Nessuna bombola in stock da restituire';
        }
        returnAllButton.onclick = () => this.processBatchReturns();
        
        batchContainer.appendChild(returnAllButton);
        
        // Add summary of what was found
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'mt-2 text-center text-muted small';
        summaryDiv.innerHTML = `
            <p>Rilevate ${codes.length} bombole: ${foundCount} in stock, ${notFoundCount} non trovate</p>
        `;
        batchContainer.appendChild(summaryDiv);
        
        this.showNotification(`Rilevate ${codes.length} bombole (${foundCount} in stock, ${notFoundCount} non trovate)`, 'info');
    },
    
    // Process batch returns
    processBatchReturns: function() {
        const container = document.getElementById('batchReturnsContainer');
        if (!container) return;
        
        const forms = container.querySelectorAll('.batch-return-form');
        let returnedCount = 0;
        
        forms.forEach(form => {
            const includeCheckbox = form.querySelector('.batch-return-include');
            if (!includeCheckbox || !includeCheckbox.checked) return; // Skip unchecked
            
            const codeInput = form.querySelector('.batch-return-code');
            if (!codeInput) return;
            
            const newCode = codeInput.value.trim();
            
            // Get the original code (if it exists)
            const originalCodeInput = form.querySelector('.batch-return-original-code');
            const originalCode = originalCodeInput ? originalCodeInput.value.trim() : newCode;
            
            // Find cylinder in stock using the original code
            const cylinderIndex = this.cylinders.findIndex(c => c.code === originalCode);
            
            if (cylinderIndex === -1) {
                this.showNotification(`Bombola ${originalCode} non trovata in stock`, 'warning');
                return;
            }
            
            const cylinder = this.cylinders[cylinderIndex];
            
            // Get pressure out value
            const pressureOutInput = form.querySelector('.batch-return-pressure-out');
            const pressureOut = pressureOutInput ? pressureOutInput.value : 0;
            
            // Create history record with potentially updated code
            const historyRecord = {
                code: newCode, // Use potentially updated code
                gasType: cylinder.gasType,
                pressureIn: cylinder.pressure,
                cylinderVolume: cylinder.cylinderVolume || '50',
                pressureOut: pressureOut,
                entryDate: cylinder.entryDate,
                exitDate: new Date().toISOString()
            };
            
            // Add to history
            this.history.push(historyRecord);
            
            // Remove from stock
            this.cylinders.splice(cylinderIndex, 1);
            
            returnedCount++;
        });
        
        if (returnedCount > 0) {
            // Save to localStorage
            this.saveToLocalStorage();
            
            // Update UI
            this.renderStockTable();
            this.renderHistoryTable();
            
            // Clear the batch container
            container.innerHTML = '';
            
            this.showNotification(`Restituite ${returnedCount} bombole con successo`, 'success');
            
            // Removed automatic backup to server
            // this.backupToServer();
        } else {
            this.showNotification('Nessuna bombola restituita', 'warning');
        }
    },
    
    // Show capture effect
    showCaptureEffect: function() {
        const progressBar = document.querySelector('#progressBar .progress');
        progressBar.style.width = '0%';
        progressBar.style.width = '100%';
        
        setTimeout(() => {
            progressBar.style.width = '0%';
        }, 1000);
    },
    
    // Show return capture effect
    showReturnCaptureEffect: function() {
        const progressBar = document.querySelector('#returnProgressBar .progress');
        progressBar.style.width = '0%';
        progressBar.style.width = '100%';
        
        setTimeout(() => {
            progressBar.style.width = '0%';
        }, 1000);
    },
    
    // Add cylinder to stock with automatic backup
    addCylinder: function() {
        const code = document.getElementById('cylinderCode').value.trim();
        const gasType = document.getElementById('gasType').value;
        const pressure = document.getElementById('pressure').value;
        const cylinderVolume = document.getElementById('cylinderVolume').value;
        const physicalForm = document.getElementById('physicalForm').value;
        
        // Validate input
        if (!code || !gasType || !pressure || !cylinderVolume) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        // Check if cylinder already exists
        if (this.cylinders.some(c => c.code === code)) {
            this.showNotification('Cylinder already exists in stock', 'error');
            return;
        }
        
        // Create new cylinder object
        const newCylinder = {
            code,
            gasType,
            pressure,
            cylinderVolume,
            physicalForm,
            entryDate: new Date().toISOString()
        };
        
        // Add to cylinders array
        this.cylinders.push(newCylinder);
        
        // Save to localStorage
        this.saveToLocalStorage();
        
        // Update UI
        this.renderStockTable();
        this.updateFilterOptions();
        
        // Reset form
        document.getElementById('cylinderForm').reset();
        
        this.showNotification('Cylinder added successfully', 'success');
        
        // Removed automatic backup to server
        // this.backupToServer();
    },
    
    // Return cylinder (remove from stock) with automatic backup
    returnCylinderManual: function() {
        const code = document.getElementById('manualReturnCode').value.trim();
        const pressureOut = document.getElementById('manualReturnPressureOut').value;
        
        // Validate input
        if (!code || pressureOut === '') {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        // Find cylinder in stock
        const cylinderIndex = this.cylinders.findIndex(c => c.code === code);
        
        if (cylinderIndex === -1) {
            this.showNotification('Cylinder not found in stock', 'error');
            return;
        }
        
        const cylinder = this.cylinders[cylinderIndex];
        
        // Create history record
        const historyRecord = {
            code: cylinder.code,
            gasType: cylinder.gasType,
            pressureIn: cylinder.pressure,
            cylinderVolume: cylinder.cylinderVolume || '50',
            pressureOut: pressureOut,
            entryDate: cylinder.entryDate,
            exitDate: new Date().toISOString()
        };
        
        // Add to history
        this.history.push(historyRecord);
        
        // Remove from stock
        this.cylinders.splice(cylinderIndex, 1);
        
        // Save to localStorage
        this.saveToLocalStorage();
        
        // Update UI
        this.renderStockTable();
        this.renderHistoryTable();
        
        // Reset form
        document.getElementById('manualReturnForm').reset();
        
        this.showNotification('Cylinder returned successfully', 'success');
        
        // Removed automatic backup to server
        // this.backupToServer();
    },
    
    // Check cylinder code
    checkCylinderCode: function() {
        const code = document.getElementById('manualReturnCode').value.trim();
        
        if (!code) {
            this.showNotification('Enter a cylinder code', 'warning');
            return;
        }
        
        // Find cylinder in stock
        const cylinder = this.cylinders.find(c => c.code === code);
        
        if (cylinder) {
            document.getElementById('manualReturnGasType').value = cylinder.gasType;
            document.getElementById('manualReturnPressureIn').value = cylinder.pressure;
            document.getElementById('manualReturnVolume').value = cylinder.cylinderVolume || '50';
            this.showNotification('Cylinder found in stock', 'success');
        } else {
            document.getElementById('manualReturnGasType').value = '';
            document.getElementById('manualReturnPressureIn').value = '';
            document.getElementById('manualReturnVolume').value = '';
            this.showNotification('Cylinder not found in stock', 'error');
        }
    },
    
    // Format cylinder code for display (add hyphen after prefix)
    formatCylinderCode: function(code) {
        if (!code) return '';
        
        // Ensure code is a string
        const codeStr = String(code);
        
        // If code is already formatted with hyphen, return as is
        if (codeStr.includes('-')) return codeStr;
        
        // Otherwise format it with hyphen after prefix
        if (codeStr.length >= 6) {
            return codeStr.substring(0, 6) + '-' + codeStr.substring(6);
        }
        
        // If code is too short, just return it unchanged
        return codeStr;
    },
    
    // Render stock table
    renderStockTable: function() {
        const tableBody = document.getElementById('stockTable');
        tableBody.innerHTML = '';
        
        if (this.cylinders.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="7" class="text-center">No cylinders in stock</td>';
            tableBody.appendChild(row);
            return;
        }
        
        this.cylinders.forEach(cylinder => {
            const row = document.createElement('tr');
            
            const formattedDate = new Date(cylinder.entryDate).toLocaleDateString('en-US');
            const physicalFormLabel = this.getPhysicalFormLabel(cylinder.physicalForm);
            const formattedCode = this.formatCylinderCode(cylinder.code);
            
            row.innerHTML = `
                <td>${formattedCode}</td>
                <td>${cylinder.gasType}</td>
                <td>${cylinder.pressure} bar</td>
                <td>${cylinder.cylinderVolume || '50'} L</td>
                <td>${physicalFormLabel}</td>
                <td>${formattedDate}</td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-primary" onclick="gasManager.editCylinder('${cylinder.code}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="gasManager.returnCylinder('${cylinder.code}')">
                            <i class="fas fa-undo"></i> Return
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="gasManager.deleteCylinder('${cylinder.code}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    },
    
    // Edit cylinder from stock table
    editCylinder: function(code) {
        // Find cylinder in stock
        const cylinder = this.cylinders.find(c => c.code === code);
        
        if (!cylinder) {
            this.showNotification('Cylinder not found in stock', 'error');
            return;
        }
        
        // Create modal for editing if it doesn't exist
        let editModal = document.getElementById('editCylinderModal');
        
        if (!editModal) {
            // Create the modal
            const modalHTML = `
                <div class="modal fade" id="editCylinderModal" tabindex="-1" aria-labelledby="editCylinderModalLabel" aria-hidden="true">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title" id="editCylinderModalLabel">Edit Cylinder</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <form id="editCylinderForm">
                                    <input type="hidden" id="originalCylinderCode">
                                    <div class="mb-3">
                                        <label class="form-label" for="editCylinderCode">Cylinder Code</label>
                                        <input type="text" class="form-control" id="editCylinderCode" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label" for="editGasType">Gas Type</label>
                                        <select class="form-select" id="editGasType" required>
                                            <option value="">Select...</option>
                                            <option value="H2">H2</option>
                                            <option value="N2">N2</option>
                                            <option value="CO2">CO2</option>
                                            <option value="NH3">NH3</option>
                                            <option value="N2 50ppm">N2 50 ppm</option>
                                            <option value="N2 450ppm">N2 450 ppm</option>
                                            <option value="Air">Air</option>
                                            <option value="He">He</option>
                                            <option value="Mix">Mix</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label" for="editPressure">Pressure (bar)</label>
                                        <input type="number" class="form-control" id="editPressure" min="0" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label" for="editCylinderVolume">Cylinder Volume (L)</label>
                                        <input type="number" class="form-control" id="editCylinderVolume" min="0" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label" for="editPhysicalForm">Physical Form</label>
                                        <select class="form-select" id="editPhysicalForm" required>
                                            <option value="gas">Gas</option>
                                            <option value="liquid">Liquid</option>
                                            <option value="liquidWithDip">Liquid with dip tube</option>
                                        </select>
                                    </div>
                                </form>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="button" class="btn btn-primary" id="saveEditCylinderBtn">Save Changes</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Append to body
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            editModal = document.getElementById('editCylinderModal');
            
            // Add event listener for save button
            document.getElementById('saveEditCylinderBtn').addEventListener('click', () => {
                this.saveEditCylinder();
            });
        }
        
        // Store the original code in a hidden field for reference
        document.getElementById('originalCylinderCode').value = cylinder.code;
        
        // Fill the form with cylinder data
        document.getElementById('editCylinderCode').value = cylinder.code;
        document.getElementById('editGasType').value = cylinder.gasType;
        document.getElementById('editPressure').value = cylinder.pressure;
        document.getElementById('editCylinderVolume').value = cylinder.cylinderVolume || '50';
        document.getElementById('editPhysicalForm').value = cylinder.physicalForm;
        
        // Show the modal
        const modal = new bootstrap.Modal(editModal);
        modal.show();
    },
    
    // Save edited cylinder
    saveEditCylinder: function() {
        const originalCode = document.getElementById('originalCylinderCode').value;
        const newCode = document.getElementById('editCylinderCode').value.trim();
        const gasType = document.getElementById('editGasType').value;
        const pressure = document.getElementById('editPressure').value;
        const cylinderVolume = document.getElementById('editCylinderVolume').value;
        const physicalForm = document.getElementById('editPhysicalForm').value;
        
        // Validate input
        if (!newCode || !gasType || !pressure || !cylinderVolume) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }
        
        // Find cylinder in stock using the original code
        const cylinderIndex = this.cylinders.findIndex(c => c.code === originalCode);
        
        if (cylinderIndex === -1) {
            this.showNotification('Cylinder not found in stock', 'error');
            return;
        }
        
        // Check if the new code already exists (only if code has changed)
        if (newCode !== originalCode && this.cylinders.some(c => c.code === newCode)) {
            this.showNotification(`Cylinder with code ${newCode} already exists in stock`, 'error');
            return;
        }
        
        // Update cylinder data
        this.cylinders[cylinderIndex].code = newCode;
        this.cylinders[cylinderIndex].gasType = gasType;
        this.cylinders[cylinderIndex].pressure = pressure;
        this.cylinders[cylinderIndex].cylinderVolume = cylinderVolume;
        this.cylinders[cylinderIndex].physicalForm = physicalForm;
        
        // Save to localStorage
        this.saveToLocalStorage();
        
        // Update UI
        this.renderStockTable();
        this.updateFilterOptions();
        
        // Close the modal
        const editModal = bootstrap.Modal.getInstance(document.getElementById('editCylinderModal'));
        if (editModal) {
            editModal.hide();
        }
        
        this.showNotification('Cylinder updated successfully', 'success');
    },
    
    // Return cylinder directly from stock table
    returnCylinder: function(code) {
        const cylinder = this.cylinders.find(c => c.code === code);
        
        if (!cylinder) {
            this.showNotification('Cylinder not found in stock', 'error');
            return;
        }
        
        // Fill return form
        document.getElementById('manualReturnCode').value = cylinder.code;
        document.getElementById('manualReturnGasType').value = cylinder.gasType;
        document.getElementById('manualReturnPressureIn').value = cylinder.pressure;
        document.getElementById('manualReturnVolume').value = cylinder.cylinderVolume || '50';
        document.getElementById('manualReturnPressureOut').value = '0';
        
        // Scroll to return section
        document.querySelector('.section-card:nth-child(3)').scrollIntoView({ behavior: 'smooth' });
        
        this.showNotification('Enter residual pressure and confirm return', 'info');
    },
    
    // Delete cylinder directly from stock table
    deleteCylinder: function(code) {
        if (!confirm(`Are you sure you want to delete cylinder ${code} from stock?\nThis action cannot be undone.`)) {
            return;
        }
        
        const cylinderIndex = this.cylinders.findIndex(c => c.code === code);
        
        if (cylinderIndex === -1) {
            this.showNotification('Cylinder not found in stock', 'error');
            return;
        }
        
        // Remove from stock
        this.cylinders.splice(cylinderIndex, 1);
        
        // Save to localStorage
        this.saveToLocalStorage();
        
        // Update UI
        this.renderStockTable();
        this.updateFilterOptions();
        
        this.showNotification(`Cylinder ${code} has been deleted from stock`, 'success');
    },
    
    // Render history table
    renderHistoryTable: function() {
        const tableBody = document.getElementById('historyTable');
        tableBody.innerHTML = '';
        
        if (this.history.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="7" class="text-center">No records in history</td>';
            tableBody.appendChild(row);
            return;
        }
        
        this.history.forEach(record => {
            const row = document.createElement('tr');
            
            const entryDate = new Date(record.entryDate).toLocaleDateString('en-US');
            const exitDate = new Date(record.exitDate).toLocaleDateString('en-US');
            const formattedCode = this.formatCylinderCode(record.code);
            
            row.innerHTML = `
                <td>${formattedCode}</td>
                <td>${record.gasType}</td>
                <td>${record.pressureIn} bar</td>
                <td>${record.cylinderVolume || '50'} L</td>
                <td>${record.pressureOut} bar</td>
                <td>${entryDate}</td>
                <td>${exitDate}</td>
            `;
            
            tableBody.appendChild(row);
        });
    },
    
    // Update filter options
    updateFilterOptions: function() {
        // Get unique gas types
        const gasTypes = [...new Set(this.cylinders.map(c => c.gasType))];
        
        // Stock gas filter
        const stockGasFilter = document.getElementById('stockGasFilter');
        stockGasFilter.innerHTML = '<option value="">All</option>';
        
        gasTypes.forEach(gas => {
            if (gas) {
                const option = document.createElement('option');
                option.value = gas;
                option.textContent = gas;
                stockGasFilter.appendChild(option);
            }
        });
        
        // History gas filter
        const historyGasTypes = [...new Set(this.history.map(h => h.gasType))];
        const historyGasFilter = document.getElementById('historyGasFilter');
        historyGasFilter.innerHTML = '<option value="">All</option>';
        
        historyGasTypes.forEach(gas => {
            if (gas) {
                const option = document.createElement('option');
                option.value = gas;
                option.textContent = gas;
                historyGasFilter.appendChild(option);
            }
        });
    },
    
    // Apply stock filters
    applyStockFilters: function() {
        const gasFilter = document.getElementById('stockGasFilter').value;
        const formFilter = document.getElementById('stockFormFilter').value;
        const sortOption = document.getElementById('stockSort').value;
        
        // Create a filtered copy of the cylinders array
        let filteredCylinders = [...this.cylinders];
        
        // Apply gas filter if selected
        if (gasFilter) {
            filteredCylinders = filteredCylinders.filter(c => c.gasType === gasFilter);
        }
        
        // Apply form filter if selected
        if (formFilter) {
            filteredCylinders = filteredCylinders.filter(c => c.physicalForm === formFilter);
        }
        
        // Apply sorting
        if (sortOption === 'date') {
            filteredCylinders.sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate));
        } else if (sortOption === 'code') {
            filteredCylinders.sort((a, b) => a.code.localeCompare(b.code));
        } else if (sortOption === 'gas') {
            filteredCylinders.sort((a, b) => a.gasType.localeCompare(b.gasType));
        }
        
        // Render the filtered table
        this.renderFilteredStockTable(filteredCylinders);
        
        this.showNotification('Filters applied', 'info');
    },
    
    // Render filtered stock table
    renderFilteredStockTable: function(filteredCylinders) {
        const tableBody = document.getElementById('stockTable');
        tableBody.innerHTML = '';
        
        if (filteredCylinders.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="7" class="text-center">No cylinders match the selected filters</td>';
            tableBody.appendChild(row);
            return;
        }
        
        filteredCylinders.forEach(cylinder => {
            const row = document.createElement('tr');
            
            const formattedDate = new Date(cylinder.entryDate).toLocaleDateString('en-US');
            const physicalFormLabel = this.getPhysicalFormLabel(cylinder.physicalForm);
            const formattedCode = this.formatCylinderCode(cylinder.code);
            
            row.innerHTML = `
                <td>${formattedCode}</td>
                <td>${cylinder.gasType}</td>
                <td>${cylinder.pressure} bar</td>
                <td>${cylinder.cylinderVolume || '50'} L</td>
                <td>${physicalFormLabel}</td>
                <td>${formattedDate}</td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-primary" onclick="gasManager.editCylinder('${cylinder.code}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="gasManager.returnCylinder('${cylinder.code}')">
                            <i class="fas fa-undo"></i> Return
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="gasManager.deleteCylinder('${cylinder.code}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    },
    
    // Apply history filters
    applyHistoryFilters: function() {
        const gasFilter = document.getElementById('historyGasFilter').value;
        const dateFilter = document.getElementById('historyDateFilter').value;
        const sortOption = document.getElementById('historySort').value;
        
        // Create a filtered copy of the history array
        let filteredHistory = [...this.history];
        
        // Apply gas filter if selected
        if (gasFilter) {
            filteredHistory = filteredHistory.filter(h => h.gasType === gasFilter);
        }
        
        // Apply date filter if selected
        if (dateFilter) {
            const filterDate = new Date(dateFilter);
            filterDate.setHours(0, 0, 0, 0); // Set to start of day
            
            filteredHistory = filteredHistory.filter(h => {
                const entryDate = new Date(h.entryDate);
                entryDate.setHours(0, 0, 0, 0); // Set to start of day
                
                const exitDate = new Date(h.exitDate);
                exitDate.setHours(0, 0, 0, 0); // Set to start of day
                
                // Match if either entry or exit date matches the filter date
                return entryDate.getTime() === filterDate.getTime() || 
                       exitDate.getTime() === filterDate.getTime();
            });
        }
        
        // Apply sorting
        if (sortOption === 'dateIn') {
            filteredHistory.sort((a, b) => new Date(b.entryDate) - new Date(a.entryDate));
        } else if (sortOption === 'dateOut') {
            filteredHistory.sort((a, b) => new Date(b.exitDate) - new Date(a.exitDate));
        }
        
        // Render the filtered table
        this.renderFilteredHistoryTable(filteredHistory);
        
        this.showNotification('Filters applied', 'info');
    },
    
    // Render filtered history table
    renderFilteredHistoryTable: function(filteredHistory) {
        const tableBody = document.getElementById('historyTable');
        tableBody.innerHTML = '';
        
        if (filteredHistory.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="7" class="text-center">No records match the selected filters</td>';
            tableBody.appendChild(row);
            return;
        }
        
        filteredHistory.forEach(record => {
            const row = document.createElement('tr');
            
            const entryDate = new Date(record.entryDate).toLocaleDateString('en-US');
            const exitDate = new Date(record.exitDate).toLocaleDateString('en-US');
            const formattedCode = this.formatCylinderCode(record.code);
            
            row.innerHTML = `
                <td>${formattedCode}</td>
                <td>${record.gasType}</td>
                <td>${record.pressureIn} bar</td>
                <td>${record.cylinderVolume || '50'} L</td>
                <td>${record.pressureOut} bar</td>
                <td>${entryDate}</td>
                <td>${exitDate}</td>
            `;
            
            tableBody.appendChild(row);
        });
    },
    
    // Export stock to CSV
    exportStock: function() {
        if (this.cylinders.length === 0) {
            this.showNotification('No data to export', 'warning');
            return;
        }
        
        fetch('/api/export-stock', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(this.cylinders)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.showNotification(data.message, 'success');
                // Open the file
                window.open('/download/' + data.filepath.split('\\').pop(), '_blank');
            } else {
                this.showNotification(data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Export error:', error);
            this.showNotification('Error during export', 'error');
        });
    },
    
    // Export history to CSV
    exportHistory: function() {
        if (this.history.length === 0) {
            this.showNotification('No data to export', 'warning');
            return;
        }
        
        fetch('/api/export-history', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(this.history)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.showNotification(data.message, 'success');
                // Open the file
                window.open('/download/' + data.filepath.split('\\').pop(), '_blank');
            } else {
                this.showNotification(data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Export error:', error);
            this.showNotification('Error during export', 'error');
        });
    },
    
    // Export all data to CSV
    exportAll: function() {
        if (this.cylinders.length === 0 && this.history.length === 0) {
            this.showNotification('No data to export', 'warning');
            return;
        }
        
        fetch('/api/export-all', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cylinders: this.cylinders,
                history: this.history
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.showNotification(data.message, 'success');
                // Open the file
                window.open('/download/' + data.filepath.split('\\').pop(), '_blank');
            } else {
                this.showNotification(data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Export error:', error);
            this.showNotification('Error during export', 'error');
        });
    },
    
    // Backup data to server
    backupToServer: function() {
        const data = {
            cylinders: this.cylinders,
            history: this.history,
            timestamp: new Date().toISOString()
        };
        
        return fetch('/api/extract-localstorage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('Backup completed:', data.message);
                // Always show notification for all backups since auto-backup is disabled
                this.showNotification('Data saved successfully', 'success');
                return data;
            } else {
                console.error('Backup failed:', data.message);
                this.showNotification(data.message, 'error');
                throw new Error(data.message);
            }
        })
        .catch(error => {
            console.error('Backup error:', error);
            this.showNotification('Error during save', 'error');
            throw error;
        });
    },
    
    // Show backup manager modal
    showBackupManager: function() {
        // Show the modal
        const backupModal = new bootstrap.Modal(document.getElementById('backupModal'));
        backupModal.show();
        
        // Load backups
        this.loadBackupsList();
    },
    
    // Load available backups
    loadBackupsList: function() {
        const backupsList = document.getElementById('backupsList');
        backupsList.innerHTML = '<tr><td colspan="5" class="text-center">Loading backups...</td></tr>';
        
        fetch('/api/list-backups')
            .then(response => response.json())
            .then(result => {
                if (result.success && result.backups.length > 0) {
                    let html = '';
                    
                    result.backups.forEach(backup => {
                        html += `
                            <tr>
                                <td>${backup.filename}</td>
                                <td>${backup.modified}</td>
                                <td>${backup.cylinders_count}</td>
                                <td>${backup.history_count}</td>
                                <td>
                                    <button class="btn btn-sm btn-primary" onclick="gasManager.loadBackup('${backup.filename}')">
                                        <i class="fas fa-download me-1"></i>Load
                                    </button>
                                </td>
                            </tr>
                        `;
                    });
                    
                    backupsList.innerHTML = html;
                } else {
                    backupsList.innerHTML = '<tr><td colspan="5" class="text-center">No backups available</td></tr>';
                }
            })
            .catch(error => {
                console.error('Error loading backups:', error);
                backupsList.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading backups</td></tr>';
            });
    },
    
    // Create a new backup
    createBackup: function() {
        this.showNotification('Saving data...', 'info');
        
        this.backupToServer()
            .then(data => {
                // Reload backups list
                this.loadBackupsList();
                this.showNotification('Data saved successfully', 'success');
            })
            .catch(error => {
                console.error('Error creating backup:', error);
                this.showNotification('Error during save', 'error');
            });
    },
    
    // Load a specific backup
    loadBackup: function(filename) {
        if (!confirm(`Are you sure you want to load backup ${filename}?\nThis will replace all current data.`)) {
            return;
        }
        
        this.showNotification(`Loading backup ${filename}...`, 'info');
        
        fetch(`/api/load-backup/${filename}`)
            .then(response => response.json())
            .then(result => {
                if (result.success && result.data) {
                    // Update cylinders and history
                    this.cylinders = result.data.cylinders || [];
                    this.history = result.data.history || [];
                    
                    // Also update localStorage as a cache
                    this.saveToLocalStorage();
                    
                    // Update UI
                    this.updateFilterOptions();
                    this.renderStockTable();
                    this.renderHistoryTable();
                    
                    // Update data source info
                    this.updateDataSourceInfo(`Data loaded from ${filename}`);
                    
                    this.showNotification(result.message, 'success');
                    
                    // Close the modal
                    const backupModal = bootstrap.Modal.getInstance(document.getElementById('backupModal'));
                    if (backupModal) {
                        backupModal.hide();
                    }
                } else {
                    this.showNotification(result.message, 'error');
                }
            })
            .catch(error => {
                console.error('Error loading backup:', error);
                this.showNotification('Error loading backup', 'error');
            });
    },
    
    // Load data from server
    loadFromServer: function() {
        return new Promise((resolve, reject) => {
            fetch('/api/load-data')
                .then(response => response.json())
                .then(result => {
                    if (result.success && result.data) {
                        // Update cylinders and history
                        this.cylinders = result.data.cylinders || [];
                        this.history = result.data.history || [];
                        
                        // Also update localStorage as a cache
                        this.saveToLocalStorage();
                        
                        // Update data source info
                        this.updateDataSourceInfo(result.message);
                        
                        this.showNotification(result.message, 'success');
                        resolve();
                    } else {
                        this.showNotification(result.message, 'warning');
                        // Try to load from localStorage as fallback
                        this.loadFromLocalStorage();
                        this.updateDataSourceInfo('Dati caricati dalla memoria locale');
                        resolve();
                    }
                })
                .catch(error => {
                    console.error('Error loading data from server:', error);
                    reject(error);
                });
        });
    },
    
    // Refresh data from server (manual action)
    refreshFromServer: function() {
        this.showNotification('Aggiornamento dati dal server in corso...', 'info');
        
        this.loadFromServer()
            .then(() => {
                // Update UI
                this.updateFilterOptions();
                this.renderStockTable();
                this.renderHistoryTable();
                
                this.showNotification('Dati aggiornati con successo', 'success');
            })
            .catch(error => {
                console.error('Error refreshing data:', error);
                this.showNotification('Errore durante l\'aggiornamento dei dati', 'error');
            });
    },
    
    // Update data source information display
    updateDataSourceInfo: function(message) {
        const infoElement = document.getElementById('dataSourceInfo');
        if (infoElement) {
            const now = new Date();
            const timeString = now.toLocaleTimeString();
            infoElement.textContent = `${message} | Ultimo aggiornamento: ${timeString}`;
        }
    },
    
    // Save data to localStorage
    saveToLocalStorage: function() {
        localStorage.setItem('gasManager_cylinders', JSON.stringify(this.cylinders));
        localStorage.setItem('gasManager_history', JSON.stringify(this.history));
    },
    
    // Load data from localStorage
    loadFromLocalStorage: function() {
        const savedCylinders = localStorage.getItem('gasManager_cylinders');
        const savedHistory = localStorage.getItem('gasManager_history');
        
        if (savedCylinders) {
            this.cylinders = JSON.parse(savedCylinders);
        }
        
        if (savedHistory) {
            this.history = JSON.parse(savedHistory);
        }
    },
    
    // Get physical form label
    getPhysicalFormLabel: function(form) {
        const labels = {
            'gas': 'Gas',
            'liquid': 'Liquido',
            'liquidWithDip': 'Liquido con pescante'
        };
        
        return labels[form] || form;
    },
    
    // Show notification
    showNotification: function(message, type) {
        const bgColors = {
            success: 'linear-gradient(to right, #00b09b, #96c93d)',
            error: 'linear-gradient(to right, #ff5f6d, #ffc371)',
            warning: 'linear-gradient(to right, #f7b733, #fc4a1a)',
            info: 'linear-gradient(to right, #2196f3, #4286f4)'
        };
        
        Toastify({
            text: message,
            duration: 3000,
            gravity: 'top',
            position: 'right',
            style: {
                background: bgColors[type] || bgColors.info
            }
        }).showToast();
    }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    gasManager.init();
}); 