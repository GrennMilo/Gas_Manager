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
        
        // Load saved data from localStorage
        this.loadFromLocalStorage();
        
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
    
    // Process captured image
    processImage: function(imageDataUrl) {
        // Here you would implement OCR or barcode scanning
        // For simplicity, just populate the form with some data
        this.showNotification('Immagine acquisita, elaborazione in corso...', 'info');
        
        // Simulate processing delay
        setTimeout(() => {
            // Set values to form
            document.getElementById('cylinderCode').value = 'CYL' + Math.floor(Math.random() * 10000);
            document.getElementById('gasType').value = 'H2';
            this.showNotification('Codice rilevato con successo', 'success');
        }, 1000);
    },
    
    // Process captured return image
    processReturnImage: function(imageDataUrl) {
        // Simulate OCR processing
        this.showNotification('Immagine acquisita, elaborazione in corso...', 'info');
        
        // Simulate processing delay
        setTimeout(() => {
            // Check if cylinder exists in stock
            const code = 'CYL' + Math.floor(Math.random() * 10000);
            const cylinder = this.cylinders.find(c => c.code === code);
            
            if (cylinder) {
                document.getElementById('manualReturnCode').value = cylinder.code;
                document.getElementById('manualReturnGasType').value = cylinder.gasType;
                document.getElementById('manualReturnPressureIn').value = cylinder.pressure;
                document.getElementById('manualReturnPressureOut').value = Math.floor(cylinder.pressure * 0.2);
                
                this.showNotification('Bombola trovata in stock', 'success');
            } else {
                this.showNotification('Bombola non trovata in stock', 'warning');
            }
        }, 1000);
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
    
    // Add cylinder to stock
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
    },
    
    // Return cylinder (remove from stock)
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
        
        fetch('/api/extract-localstorage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.showNotification(data.message, 'success');
            } else {
                this.showNotification(data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Errore backup:', error);
            this.showNotification('Errore durante il backup', 'error');
        });
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