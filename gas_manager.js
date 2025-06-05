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
                
                this.showNotification('Sistema inizializzato con successo', 'success');
            })
            .catch(error => {
                console.error('Error initializing application:', error);
                this.showNotification('Errore durante l\'inizializzazione. Utilizzando dati locali.', 'error');
                
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
            this.showNotification('Sistema OCR inizializzato', 'success');
        } catch (err) {
            console.error('Failed to create Tesseract scheduler:', err);
            this.showNotification('Impossibile inizializzare il sistema OCR', 'error');
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
        
        document.getElementById('togglePreviewBtn').textContent = 'Abilita Fotocamera';
    },
    
    // Initialize return camera
    initReturnCamera: function() {
        this.returnVideoElement = document.getElementById('returnVideo');
        this.returnCanvasElement = document.getElementById('returnCanvas');
        this.returnVideoStream = null;
        this.returnCameraActive = false;
        
        document.getElementById('returnTogglePreviewBtn').textContent = 'Abilita Fotocamera';
    },
    
    // Toggle main camera on/off
    toggleMainCamera: function() {
        const toggleBtn = document.getElementById('togglePreviewBtn');
        
        if (this.mainCameraActive) {
            this.stopMainCamera();
            toggleBtn.innerHTML = '<i class="fas fa-camera"></i> Abilita Fotocamera';
        } else {
            this.startMainCamera();
            toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Disabilita Fotocamera';
        }
    },
    
    // Toggle return camera on/off
    toggleReturnCamera: function() {
        const toggleBtn = document.getElementById('returnTogglePreviewBtn');
        
        if (this.returnCameraActive) {
            this.stopReturnCamera();
            toggleBtn.innerHTML = '<i class="fas fa-camera"></i> Abilita Fotocamera';
        } else {
            this.startReturnCamera();
            toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Disabilita Fotocamera';
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
                        
                        this.showNotification('Fotocamera principale attivata', 'success');
                    })
                    .catch(err => {
                        console.error('Errore accesso alla fotocamera principale:', err);
                        this.showNotification('Errore accesso alla fotocamera: ' + err.message, 'error');
                    });
            } catch (err) {
                console.error('Errore fotocamera:', err);
                this.showNotification('Errore fotocamera: ' + err.message, 'error');
            }
        } else {
            this.showNotification('Il tuo browser non supporta l\'accesso alla fotocamera', 'error');
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
                        
                        this.showNotification('Fotocamera restituzione attivata', 'success');
                    })
                    .catch(err => {
                        console.error('Errore accesso alla fotocamera restituzione:', err);
                        this.showNotification('Errore accesso alla fotocamera: ' + err.message, 'error');
                        
                        // Show specific instructions for common errors
                        if (err.name === 'NotAllowedError') {
                            this.showNotification('Permesso fotocamera negato. Verifica le impostazioni del browser', 'error');
                        } else if (err.name === 'NotFoundError') {
                            this.showNotification('Nessuna fotocamera trovata sul dispositivo', 'error');
                        } else if (err.name === 'NotReadableError') {
                            this.showNotification('La fotocamera è già in uso da un\'altra applicazione', 'error');
                        }
                    });
            } catch (err) {
                console.error('Errore fotocamera:', err);
                this.showNotification('Errore fotocamera: ' + err.message, 'error');
            }
        } else {
            this.showNotification('Il tuo browser non supporta l\'accesso alla fotocamera', 'error');
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
            this.showNotification('Attiva prima la fotocamera', 'warning');
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
            this.showNotification('Attiva prima la fotocamera', 'warning');
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
        
        // Step 1: Look for codes with hyphens at the 7th position (format: 756311-123456)
        const hyphenPattern = /7563\d{2}\-\d+/g;
        const hyphenMatches = processedText.match(hyphenPattern) || [];
        
        if (hyphenMatches.length > 0) {
            console.log('Found hyphenated codes:', hyphenMatches);
            allMatches.push(...hyphenMatches);
        }
        
        // Step 2: Look for the specific pattern 7563 followed by numbers (with possible OCR errors)
        // This regex looks for "7563" (or similar patterns) followed by numbers
        // It allows for spaces between digits that might be introduced by OCR
        // Original: /7563[0-9]+/g
        const specificRegex = /[7T][ ]?5[ ]?6[ ]?3[ ]?[0-9O0oIl1 ]+/g;
        const specificMatches = processedText.match(specificRegex) || [];
        
        if (specificMatches.length > 0) {
            console.log('Found specific pattern matches:', specificMatches);
            
            // Clean up the matches by removing spaces and standardizing characters
            const cleanedMatches = specificMatches.map(match => {
                return match.replace(/\s+/g, '') // Remove all spaces
                            .replace(/[Oo]/g, '0') // Replace O/o with 0
                            .replace(/[Il]/g, '1') // Replace I/l with 1
                            .replace(/[T]/g, '7'); // Replace T with 7 (common OCR confusion)
            });
            
            allMatches.push(...cleanedMatches);
        }
        
        // Step 3: Check original text for any numbers that might start with 7563
        // This is a broader search in case the specific pattern wasn't matched due to OCR errors
        const anyNumberRegex = /\b\d{4,}\b/g;
        const numberMatches = processedText.match(anyNumberRegex) || [];
        
        // Filter for numbers that start with 7563 or similar patterns
        const potentialMatches = numberMatches.filter(num => {
            return num.startsWith('7563') || 
                   num.startsWith('7S63') ||
                   num.startsWith('75G3');
        });
        
        if (potentialMatches.length > 0) {
            console.log('Found potential number matches:', potentialMatches);
            allMatches.push(...potentialMatches);
        }
        
        // Step 4: Look for any sequence of 4+ digits as a fallback
        if (allMatches.length === 0) {
            console.log('No specific matches found, falling back to general number detection');
            
            // Look for 4 or more consecutive digits (standard code length)
            const genericNumberRegex = /\b\d{4,}\b/g;
            const genericMatches = processedText.match(genericNumberRegex) || [];
            
            allMatches.push(...genericMatches);
        }
        
        // Step 5: Advanced pattern detection (for severely distorted OCR)
        // This pattern looks for text that might be a code but with severe OCR issues
        // For example: "7 5 6 3 1 2 3 4" or "7S63-12345"
        if (allMatches.length === 0) {
            // This regex looks for patterns that might be cylinder codes but with severe distortion
            const fuzzyRegex = /[7T][ \-_.]*[5S][ \-_.]*[6G][ \-_.]*3[ \-_.]*[\d\s]+/g;
            const fuzzyMatches = normalizedText.match(fuzzyRegex) || [];
            
            if (fuzzyMatches.length > 0) {
                console.log('Found fuzzy matches:', fuzzyMatches);
                
                // Clean up fuzzy matches by removing non-digit characters
                const cleanedFuzzyMatches = fuzzyMatches.map(match => {
                    // First replace common OCR errors
                    let cleaned = match.replace(/[Oo]/g, '0') // Replace O/o with 0
                                      .replace(/[Il]/g, '1')  // Replace I/l with 1
                                      .replace(/[T]/g, '7')   // Replace T with 7
                                      .replace(/[S]/g, '5')   // Replace S with 5
                                      .replace(/[G]/g, '6');  // Replace G with 6
                    
                    // Special case: Keep hyphens at position 7 (for format 756311-123456)
                    if (cleaned.length >= 8 && cleaned.charAt(6) === '-') {
                        // Keep the hyphen for this format
                        cleaned = cleaned.substring(0, 7) + cleaned.substring(7).replace(/[^\d]/g, '');
                    } else {
                        // Remove all non-digit characters
                        cleaned = cleaned.replace(/[^\d]/g, '');
                    }
                    
                    return cleaned;
                });
                
                allMatches.push(...cleanedFuzzyMatches);
            }
        }
        
        // Remove duplicates and empty strings
        const uniqueMatches = [...new Set(allMatches)].filter(match => match && match.length >= 4);
        console.log('Final unique matches:', uniqueMatches);
        
        return uniqueMatches;
    },
    
    // Validate cylinder code
    validateCylinderCode: function(code) {
        if (!code) return false;
        
        // Convert to string in case it's a number
        const codeStr = String(code);
        
        // Basic validation rules:
        // 1. Must be all digits after cleaning (allowing for hyphen at 7th position)
        // 2. Must start with 7563
        // 3. Must be at least 8 digits (7563 + at least 4 more digits)
        // 4. Must not be more than 16 digits (reasonable upper limit)
        
        // Check if the code follows the format "756311-123456"
        const hyphenPattern = /^7563\d{2}\-\d+$/;
        if (hyphenPattern.test(codeStr)) {
            // Remove the hyphen and return
            return codeStr.replace('-', '');
        }
        
        // Otherwise, handle regular codes
        // Remove any non-digit characters (final cleaning)
        const cleanedCode = codeStr.replace(/[^\d]/g, '');
        
        // Check if it starts with 7563
        const startsWithPrefix = cleanedCode.startsWith('7563');
        
        // Check length constraints
        const validLength = cleanedCode.length >= 8 && cleanedCode.length <= 16;
        
        // All criteria must be met
        return startsWithPrefix && validLength ? cleanedCode : false;
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
            
            // More lenient validation - if any code contains 7563 sequence
            const lenientCodes = codes
                .map(code => {
                    // If the code contains 7563 anywhere, extract from that point onwards
                    const match = String(code).match(/7563\d+/);
                    return match ? match[0] : false;
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
            this.showNotification('Nessun codice bombola rilevato', 'warning');
            return;
        }
        
        // Create a container for batch cylinders if it doesn't exist
        let batchContainer = document.getElementById('batchCylindersContainer');
        if (!batchContainer) {
            batchContainer = document.createElement('div');
            batchContainer.id = 'batchCylindersContainer';
            batchContainer.className = 'mt-3 p-3 border rounded bg-light';
            
            const heading = document.createElement('h5');
            heading.textContent = 'Bombole Rilevate';
            batchContainer.appendChild(heading);
            
            const formsContainer = document.getElementById('cylinderFormsContainer');
            if (formsContainer) {
                formsContainer.innerHTML = '';
                formsContainer.appendChild(batchContainer);
            }
        } else {
            batchContainer.innerHTML = '';
            const heading = document.createElement('h5');
            heading.textContent = 'Bombole Rilevate';
            batchContainer.appendChild(heading);
        }
        
        // Add stock summary before the forms
        const stockSummary = document.createElement('div');
        stockSummary.className = 'mb-3 p-2 border-bottom';
        stockSummary.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <h6 class="mb-0">Stock Attuale: ${this.cylinders.length} bombole</h6>
                <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="collapse" 
                        data-bs-target="#stockSummaryCollapse" aria-expanded="false" aria-controls="stockSummaryCollapse">
                    <i class="fas fa-eye"></i> Mostra Stock
                </button>
            </div>
            <div class="collapse mt-2" id="stockSummaryCollapse">
                <div class="card card-body p-2">
                    <div class="table-responsive" style="max-height: 200px; overflow-y: auto;">
                        <table class="table table-sm table-hover">
                            <thead>
                                <tr>
                                    <th>Codice</th>
                                    <th>Gas</th>
                                    <th>Pressione</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.cylinders.length > 0 ? 
                                    this.cylinders.map(cylinder => `
                                        <tr>
                                            <td>${cylinder.code}</td>
                                            <td>${cylinder.gasType}</td>
                                            <td>${cylinder.pressure} bar</td>
                                        </tr>
                                    `).join('') : 
                                    '<tr><td colspan="3" class="text-center">Nessuna bombola in stock</td></tr>'
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
            // Check if cylinder already exists in stock
            const existingCylinder = this.cylinders.find(c => c.code === code);
            const cylinderForm = document.createElement('div');
            cylinderForm.className = 'batch-cylinder-form mb-3 p-2 border-bottom';
            
            // If the cylinder exists, show it differently
            if (existingCylinder) {
                cylinderForm.innerHTML = `
                    <div class="alert alert-warning mb-2">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Bombola ${code} già presente in stock (${existingCylinder.gasType}, ${existingCylinder.pressure} bar)
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group mb-2">
                                <label>Codice Bombola</label>
                                <input type="text" class="form-control batch-cylinder-code" value="${code}" readonly>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group mb-2">
                                <label>Tipo Gas</label>
                                <select class="form-select batch-cylinder-gas" disabled>
                                    <option value="${existingCylinder.gasType}" selected>${existingCylinder.gasType}</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group mb-2">
                                <label>Pressione (bar)</label>
                                <input type="number" class="form-control batch-cylinder-pressure" value="${existingCylinder.pressure}" disabled>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group mb-2">
                                <label>Forma Fisica</label>
                                <select class="form-select batch-cylinder-form" disabled>
                                    <option value="${existingCylinder.physicalForm}" selected>${this.getPhysicalFormLabel(existingCylinder.physicalForm)}</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input batch-cylinder-include" type="checkbox" id="includeCylinder-${index}" disabled>
                        <label class="form-check-label text-muted" for="includeCylinder-${index}">
                            Escluso automaticamente (duplicato)
                        </label>
                    </div>
                `;
            } else {
                cylinderForm.innerHTML = `
                    <div class="alert alert-success mb-2">
                        <i class="fas fa-check-circle me-2"></i>
                        Nuova bombola - pronta per essere aggiunta
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group mb-2">
                                <label>Codice Bombola</label>
                                <input type="text" class="form-control batch-cylinder-code" value="${code}" readonly>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group mb-2">
                                <label>Tipo Gas</label>
                                <select class="form-select batch-cylinder-gas" required>
                                    <option value="">Seleziona...</option>
                                    <option value="H2">H2</option>
                                    <option value="N2">N2</option>
                                    <option value="CO2">CO2</option>
                                    <option value="NH3">NH3</option>
                                    <option value="N2 50ppm">N2 50 ppm</option>
                                    <option value="N2 450ppm">N2 450 ppm</option>
                                    <option value="Air">Air</option>
                                    <option value="He">He</option>
                                    <option value="Mix">Mix</option>
                                    <option value="other">Altro</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group mb-2">
                                <label>Pressione (bar)</label>
                                <input type="number" class="form-control batch-cylinder-pressure" value="200" min="0" required>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group mb-2">
                                <label>Forma Fisica</label>
                                <select class="form-select batch-cylinder-form" required>
                                    <option value="gas" selected>Gas</option>
                                    <option value="liquid">Liquido</option>
                                    <option value="liquidWithDip">Liquido con pescante</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input batch-cylinder-include" type="checkbox" id="includeCylinder-${index}" checked>
                        <label class="form-check-label" for="includeCylinder-${index}">
                            Includi nell'aggiunta
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
        addAllButton.innerHTML = `<i class="fas fa-plus-circle me-2"></i>Aggiungi ${newCount} Bombole Nuove`;
        if (newCount === 0) {
            addAllButton.disabled = true;
            addAllButton.innerHTML = '<i class="fas fa-ban me-2"></i>Tutte le bombole sono già in stock';
        }
        addAllButton.onclick = () => this.addBatchCylinders();
        
        batchContainer.appendChild(addAllButton);
        
        // Add summary of what was found
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'mt-2 text-center text-muted small';
        summaryDiv.innerHTML = `
            <p>Rilevate ${codes.length} bombole: ${newCount} nuove, ${duplicateCount} già in stock</p>
        `;
        batchContainer.appendChild(summaryDiv);
        
        this.showNotification(`Rilevate ${codes.length} bombole (${newCount} nuove, ${duplicateCount} duplicate)`, 'success');
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
            const physicalForm = form.querySelector('.batch-cylinder-form').value;
            
            // Validate input
            if (!code || !gasType || !pressure) {
                skippedCount++;
                console.log(`Skipping cylinder ${code}: missing required fields`);
                return; // Skip invalid entries
            }
            
            // Double-check if cylinder already exists (in case the UI wasn't updated)
            if (this.cylinders.some(c => c.code === code)) {
                this.showNotification(`Bombola ${code} già presente in stock`, 'warning');
                skippedCount++;
                return; // Skip duplicates
            }
            
            // Create new cylinder object
            const newCylinder = {
                code,
                gasType,
                pressure,
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
            
            this.showNotification(`Aggiunte ${addedCount} bombole con successo`, 'success');
            
            // Don't automatically backup to server anymore
            // this.backupToServer();
        } else {
            if (skippedCount > 0) {
                this.showNotification(`Nessuna bombola aggiunta, ${skippedCount} non valide o duplicate`, 'warning');
            } else {
                this.showNotification('Nessuna bombola aggiunta, verificare i dati inseriti', 'warning');
            }
        }
    },
    
    // Process captured image with OCR
    processImage: function(imageDataUrl) {
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
                            
                            this.showNotification(`Codice bombola rilevato: ${validCylinderCodes[0]}`, 'success');
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
                                        this.showNotification(`Codice bombola rilevato: ${originalValidCodes[0]}`, 'success');
                                    } else {
                                        this.batchProcessCylinders(originalValidCodes);
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
                    console.error('OCR Error:', err);
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
                                document.getElementById('cylinderCode').value = validCodes[0];
                                this.showNotification(`Codice bombola rilevato: ${validCodes[0]}`, 'success');
                            } else {
                                this.batchProcessCylinders(validCodes);
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
                                </tr>
                            </thead>
                            <tbody>
                                ${this.cylinders.length > 0 ? 
                                    this.cylinders.map(cylinder => `
                                        <tr>
                                            <td>${cylinder.code}</td>
                                            <td>${cylinder.gasType}</td>
                                            <td>${cylinder.pressure} bar</td>
                                        </tr>
                                    `).join('') : 
                                    '<tr><td colspan="3" class="text-center">Nessuna bombola in stock</td></tr>'
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
                                <input type="text" class="form-control batch-return-code" value="${code}" readonly>
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
                        <div class="col-md-6">
                            <div class="form-group mb-2">
                                <label>Pressione Originale (bar)</label>
                                <input type="number" class="form-control batch-return-pressure-in" value="${cylinder.pressure}" readonly>
                            </div>
                        </div>
                        <div class="col-md-6">
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
                                <input type="text" class="form-control batch-return-code" value="${code}" readonly>
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
            
            const code = codeInput.value.trim();
            
            // Find cylinder in stock
            const cylinderIndex = this.cylinders.findIndex(c => c.code === code);
            
            if (cylinderIndex === -1) {
                this.showNotification(`Bombola ${code} non trovata in stock`, 'warning');
                return;
            }
            
            const cylinder = this.cylinders[cylinderIndex];
            
            // Get pressure out value
            const pressureOutInput = form.querySelector('.batch-return-pressure-out');
            const pressureOut = pressureOutInput ? pressureOutInput.value : 0;
            
            // Create history record
            const historyRecord = {
                code: cylinder.code,
                gasType: cylinder.gasType,
                pressureIn: cylinder.pressure,
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
        const physicalForm = document.getElementById('physicalForm').value;
        
        // Validate input
        if (!code || !gasType || !pressure) {
            this.showNotification('Compila tutti i campi richiesti', 'error');
            return;
        }
        
        // Check if cylinder already exists
        if (this.cylinders.some(c => c.code === code)) {
            this.showNotification('Bombola già presente in stock', 'error');
            return;
        }
        
        // Create new cylinder object
        const newCylinder = {
            code,
            gasType,
            pressure,
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
        
        this.showNotification('Bombola aggiunta con successo', 'success');
        
        // Removed automatic backup to server
        // this.backupToServer();
    },
    
    // Return cylinder (remove from stock) with automatic backup
    returnCylinderManual: function() {
        const code = document.getElementById('manualReturnCode').value.trim();
        const pressureOut = document.getElementById('manualReturnPressureOut').value;
        
        // Validate input
        if (!code || pressureOut === '') {
            this.showNotification('Compila tutti i campi richiesti', 'error');
            return;
        }
        
        // Find cylinder in stock
        const cylinderIndex = this.cylinders.findIndex(c => c.code === code);
        
        if (cylinderIndex === -1) {
            this.showNotification('Bombola non trovata in stock', 'error');
            return;
        }
        
        const cylinder = this.cylinders[cylinderIndex];
        
        // Create history record
        const historyRecord = {
            code: cylinder.code,
            gasType: cylinder.gasType,
            pressureIn: cylinder.pressure,
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
        
        this.showNotification('Bombola restituita con successo', 'success');
        
        // Removed automatic backup to server
        // this.backupToServer();
    },
    
    // Check cylinder code
    checkCylinderCode: function() {
        const code = document.getElementById('manualReturnCode').value.trim();
        
        if (!code) {
            this.showNotification('Inserisci un codice bombola', 'warning');
            return;
        }
        
        // Find cylinder in stock
        const cylinder = this.cylinders.find(c => c.code === code);
        
        if (cylinder) {
            document.getElementById('manualReturnGasType').value = cylinder.gasType;
            document.getElementById('manualReturnPressureIn').value = cylinder.pressure;
            this.showNotification('Bombola trovata in stock', 'success');
        } else {
            document.getElementById('manualReturnGasType').value = '';
            document.getElementById('manualReturnPressureIn').value = '';
            this.showNotification('Bombola non trovata in stock', 'error');
        }
    },
    
    // Render stock table
    renderStockTable: function() {
        const tableBody = document.getElementById('stockTable');
        tableBody.innerHTML = '';
        
        if (this.cylinders.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="6" class="text-center">Nessuna bombola in stock</td>';
            tableBody.appendChild(row);
            return;
        }
        
        this.cylinders.forEach(cylinder => {
            const row = document.createElement('tr');
            
            const formattedDate = new Date(cylinder.entryDate).toLocaleDateString('it-IT');
            const physicalFormLabel = this.getPhysicalFormLabel(cylinder.physicalForm);
            
            row.innerHTML = `
                <td>${cylinder.code}</td>
                <td>${cylinder.gasType}</td>
                <td>${cylinder.pressure} bar</td>
                <td>${physicalFormLabel}</td>
                <td>${formattedDate}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="gasManager.returnCylinder('${cylinder.code}')">
                        <i class="fas fa-undo"></i> Restituisci
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    },
    
    // Return cylinder directly from stock table
    returnCylinder: function(code) {
        const cylinder = this.cylinders.find(c => c.code === code);
        
        if (!cylinder) {
            this.showNotification('Bombola non trovata in stock', 'error');
            return;
        }
        
        // Fill return form
        document.getElementById('manualReturnCode').value = cylinder.code;
        document.getElementById('manualReturnGasType').value = cylinder.gasType;
        document.getElementById('manualReturnPressureIn').value = cylinder.pressure;
        document.getElementById('manualReturnPressureOut').value = '0';
        
        // Scroll to return section
        document.querySelector('.section-card:nth-child(3)').scrollIntoView({ behavior: 'smooth' });
        
        this.showNotification('Compila la pressione residua e conferma la restituzione', 'info');
    },
    
    // Render history table
    renderHistoryTable: function() {
        const tableBody = document.getElementById('historyTable');
        tableBody.innerHTML = '';
        
        if (this.history.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="6" class="text-center">Nessun record nello storico</td>';
            tableBody.appendChild(row);
            return;
        }
        
        this.history.forEach(record => {
            const row = document.createElement('tr');
            
            const entryDate = new Date(record.entryDate).toLocaleDateString('it-IT');
            const exitDate = new Date(record.exitDate).toLocaleDateString('it-IT');
            
            row.innerHTML = `
                <td>${record.code}</td>
                <td>${record.gasType}</td>
                <td>${record.pressureIn} bar</td>
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
        stockGasFilter.innerHTML = '<option value="">Tutti</option>';
        
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
        historyGasFilter.innerHTML = '<option value="">Tutti</option>';
        
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
        this.renderStockTable();
        this.showNotification('Filtri applicati', 'info');
    },
    
    // Apply history filters
    applyHistoryFilters: function() {
        this.renderHistoryTable();
        this.showNotification('Filtri applicati', 'info');
    },
    
    // Export stock to CSV
    exportStock: function() {
        if (this.cylinders.length === 0) {
            this.showNotification('Nessun dato da esportare', 'warning');
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
            console.error('Errore esportazione:', error);
            this.showNotification('Errore durante l\'esportazione', 'error');
        });
    },
    
    // Export history to CSV
    exportHistory: function() {
        if (this.history.length === 0) {
            this.showNotification('Nessun dato da esportare', 'warning');
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
            console.error('Errore esportazione:', error);
            this.showNotification('Errore durante l\'esportazione', 'error');
        });
    },
    
    // Export all data to CSV
    exportAll: function() {
        if (this.cylinders.length === 0 && this.history.length === 0) {
            this.showNotification('Nessun dato da esportare', 'warning');
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
            console.error('Errore esportazione:', error);
            this.showNotification('Errore durante l\'esportazione', 'error');
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
                this.showNotification('Salvataggio dati completato con successo', 'success');
                return data;
            } else {
                console.error('Backup failed:', data.message);
                this.showNotification(data.message, 'error');
                throw new Error(data.message);
            }
        })
        .catch(error => {
            console.error('Errore backup:', error);
            this.showNotification('Errore durante il salvataggio', 'error');
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
        backupsList.innerHTML = '<tr><td colspan="5" class="text-center">Caricamento salvataggi...</td></tr>';
        
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
                                        <i class="fas fa-download me-1"></i>Carica
                                    </button>
                                </td>
                            </tr>
                        `;
                    });
                    
                    backupsList.innerHTML = html;
                } else {
                    backupsList.innerHTML = '<tr><td colspan="5" class="text-center">Nessun salvataggio disponibile</td></tr>';
                }
            })
            .catch(error => {
                console.error('Error loading backups:', error);
                backupsList.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Errore durante il caricamento dei salvataggi</td></tr>';
            });
    },
    
    // Create a new backup
    createBackup: function() {
        this.showNotification('Salvataggio dati in corso...', 'info');
        
        this.backupToServer()
            .then(data => {
                // Reload backups list
                this.loadBackupsList();
                this.showNotification('Dati salvati con successo', 'success');
            })
            .catch(error => {
                console.error('Error creating backup:', error);
                this.showNotification('Errore durante il salvataggio', 'error');
            });
    },
    
    // Load a specific backup
    loadBackup: function(filename) {
        if (!confirm(`Sei sicuro di voler caricare il salvataggio ${filename}?\nQuesto sostituirà tutti i dati attuali.`)) {
            return;
        }
        
        this.showNotification(`Caricamento salvataggio ${filename} in corso...`, 'info');
        
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
                    this.updateDataSourceInfo(`Dati caricati da ${filename}`);
                    
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
                this.showNotification('Errore durante il caricamento del salvataggio', 'error');
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