// Global variables
let selectedFile = null;
let isProcessing = false;

// DOM Elements
const imageInput = document.getElementById('imageInput');
const uploadArea = document.getElementById('uploadArea');
const preview = document.getElementById('preview');
const result = document.getElementById('result');
const error = document.getElementById('error');
const errorMessage = document.getElementById('errorMessage');
const predictBtn = document.getElementById('predictBtn');

// Initialize event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
});

function initializeEventListeners() {
    // File input change event
    imageInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop events
    uploadArea.addEventListener('click', () => imageInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    
    // Prevent default drag behaviors on document
    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => e.preventDefault());
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        validateAndProcessFile(file);
    }
}

function handleDragOver(event) {
    event.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(event) {
    event.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleDrop(event) {
    event.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        validateAndProcessFile(files[0]);
    }
}

function validateAndProcessFile(file) {
    // Clear previous errors
    hideError();
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
        showError('Please select a valid image file (JPG, PNG, or GIF).');
        return;
    }
    
    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
        showError('File size must be less than 10MB.');
        return;
    }
    
    selectedFile = file;
    displayImagePreview(file);
    enablePredictButton();
}

function displayImagePreview(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const previewHtml = `
            <div class="preview-container">
                <img src="${e.target.result}" alt="Preview" class="img-fluid">
                <div class="image-overlay" onclick="removeImage()" title="Remove image">
                    <i class="fas fa-times"></i>
                </div>
            </div>
            <div class="mt-3">
                <h5 class="text-center">
                    <i class="fas fa-file-image me-2"></i>
                    ${file.name}
                </h5>
                <p class="text-center text-muted">
                    Size: ${formatFileSize(file.size)} | Type: ${file.type}
                </p>
            </div>
        `;
        
        preview.innerHTML = previewHtml;
        preview.classList.add('show');
        
        // Hide the upload area
        uploadArea.style.display = 'none';
    };
    
    reader.readAsDataURL(file);
}

function removeImage() {
    selectedFile = null;
    preview.innerHTML = '';
    preview.classList.remove('show');
    uploadArea.style.display = 'block';
    imageInput.value = '';
    disablePredictButton();
    hideError();
    hideResult();
}

function enablePredictButton() {
    predictBtn.disabled = false;
    predictBtn.classList.remove('btn-secondary');
    predictBtn.classList.add('btn-success');
}

function disablePredictButton() {
    predictBtn.disabled = true;
    predictBtn.classList.remove('btn-success');
    predictBtn.classList.add('btn-secondary');
}

async function predictImage() {
    if (!selectedFile || isProcessing) {
        return;
    }
    
    // Clear previous results and errors
    hideError();
    hideResult();
    
    // Set processing state
    isProcessing = true;
    setLoadingState(true);
    
    try {
        // Prepare form data
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        // Make API request with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetch('https://prasanta4-my-model-deployment.hf.space/predict', {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            let errorText;
            try {
                errorText = await response.text();
            } catch {
                errorText = `HTTP ${response.status}`;
            }
            throw new Error(`API request failed with status ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        
        // Validate response data
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid API response: Response is not a valid JSON object');
        }
        
        if (!data.predicted_class || typeof data.predicted_class !== 'string') {
            throw new Error('Invalid API response: Missing or invalid predicted_class');
        }
        
        if (data.confidence_score === undefined || typeof data.confidence_score !== 'number') {
            throw new Error('Invalid API response: Missing or invalid confidence_score');
        }
        
        // Display results
        displayResults(data);
        
    } catch (err) {
        if (err.name === 'AbortError') {
            showError('Request timed out. Please try again.');
        } else if (err.message.includes('Failed to fetch')) {
            showError('Network error. Please check your connection and try again.');
        } else {
            showError(`Error: ${err.message}`);
        }
        console.error('API Error:', err);
    } finally {
        // Reset processing state
        isProcessing = false;
        setLoadingState(false);
    }
}

function displayResults(data) {
    const confidence = Math.round(data.confidence_score * 100);
    const confidenceColor = confidence >= 80 ? 'success' : confidence >= 60 ? 'warning' : 'danger';
    
    const resultHtml = `
        <div class="result-card">
            <div class="result-header">
                <i class="fas fa-chart-line"></i>
                <h4 class="mb-0">Analysis Results</h4>
            </div>
            
            ${data.filename ? `
            <div class="result-item">
                <span class="result-label">
                    <i class="fas fa-file me-2"></i>Filename:
                </span>
                <span class="result-value">${escapeHtml(data.filename)}</span>
            </div>
            ` : ''}
            
            <div class="result-item">
                <span class="result-label">
                    <i class="fas fa-diagnosis me-2"></i>Predicted Class:
                </span>
                <span class="result-value">
                    <span class="badge bg-primary fs-6">${escapeHtml(data.predicted_class)}</span>
                </span>
            </div>
            
            <div class="result-item">
                <span class="result-label">
                    <i class="fas fa-percentage me-2"></i>Confidence Score:
                </span>
                <div>
                    <span class="result-value text-${confidenceColor}">${confidence}%</span>
                    <div class="confidence-bar">
                        <div class="confidence-fill" style="width: ${confidence}%"></div>
                    </div>
                </div>
            </div>
            
            ${data.processing_time ? `
            <div class="result-item">
                <span class="result-label">
                    <i class="fas fa-clock me-2"></i>Processing Time:
                </span>
                <span class="result-value">${data.processing_time}ms</span>
            </div>
            ` : ''}
            
            <div class="mt-4 p-3 bg-light rounded">
                <div class="d-flex align-items-center mb-2">
                    <i class="fas fa-info-circle text-info me-2"></i>
                    <strong>Important Note</strong>
                </div>
                <p class="mb-0 small text-muted">
                    This AI analysis is for educational and research purposes only. 
                    Please consult with a qualified healthcare professional for proper medical diagnosis and treatment.
                </p>
            </div>
            
            <div class="text-center mt-4">
                <button class="btn btn-outline-primary me-2" onclick="downloadReport()">
                    <i class="fas fa-download me-2"></i>Download Report
                </button>
                <button class="btn btn-outline-secondary" onclick="resetAnalysis()">
                    <i class="fas fa-redo me-2"></i>New Analysis
                </button>
            </div>
        </div>
    `;
    
    result.innerHTML = resultHtml;
    result.style.display = 'block';
    
    // Animate the confidence bar
    setTimeout(() => {
        const confidenceFill = document.querySelector('.confidence-fill');
        if (confidenceFill) {
            confidenceFill.style.width = '0%';
            setTimeout(() => {
                confidenceFill.style.width = `${confidence}%`;
            }, 100);
        }
    }, 500);
    
    // Scroll to results
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function setLoadingState(loading) {
    const btnText = predictBtn.querySelector('.btn-text');
    const spinner = predictBtn.querySelector('.spinner-border');
    
    if (loading) {
        btnText.textContent = 'Analyzing...';
        spinner.classList.remove('d-none');
        predictBtn.disabled = true;
        
        // Add loading overlay to preview
        const previewContainer = document.querySelector('.preview-container');
        if (previewContainer && !previewContainer.querySelector('.loading-overlay')) {
            const loadingOverlay = document.createElement('div');
            loadingOverlay.className = 'loading-overlay';
            loadingOverlay.innerHTML = '<div class="loading-spinner"></div>';
            previewContainer.style.position = 'relative';
            previewContainer.appendChild(loadingOverlay);
        }
    } else {
        btnText.textContent = 'Analyze Image';
        spinner.classList.add('d-none');
        predictBtn.disabled = false;
        
        // Remove loading overlay
        const loadingOverlay = document.querySelector('.loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.remove();
        }
    }
}

function showError(message) {
    errorMessage.textContent = message;
    error.classList.remove('d-none');
    error.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    // Auto-hide error after 10 seconds
    setTimeout(() => {
        hideError();
    }, 10000);
}

function hideError() {
    error.classList.add('d-none');
    errorMessage.textContent = '';
}

function hideResult() {
    result.style.display = 'none';
    result.innerHTML = '';
}

function resetAnalysis() {
    removeImage();
    hideResult();
    hideError();
    
    // Scroll back to upload area
    uploadArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function downloadReport() {
    const resultData = extractResultData();
    if (!resultData) {
        showError('No results available to download.');
        return;
    }
    
    try {
        const reportContent = generateReportContent(resultData);
        const blob = new Blob([reportContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `gallbladder-analysis-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        // Show success message
        showSuccessMessage('Report downloaded successfully!');
    } catch (err) {
        showError('Failed to generate report. Please try again.');
        console.error('Download error:', err);
    }
}

function extractResultData() {
    const resultCard = document.querySelector('.result-card');
    if (!resultCard) return null;
    
    const data = {};
    const resultItems = resultCard.querySelectorAll('.result-item');
    
    resultItems.forEach(item => {
        const label = item.querySelector('.result-label')?.textContent.trim();
        const value = item.querySelector('.result-value')?.textContent.trim();
        
        if (label && value) {
            if (label.includes('Filename')) data.filename = value;
            else if (label.includes('Predicted Class')) data.predicted_class = value;
            else if (label.includes('Confidence Score')) data.confidence_score = value;
            else if (label.includes('Processing Time')) data.processing_time = value;
        }
    });
    
    return Object.keys(data).length > 0 ? data : null;
}

function generateReportContent(data) {
    const timestamp = new Date().toLocaleString();
    
    return `
GALLBLADDER AI DIAGNOSTIC REPORT
================================

Generated: ${timestamp}
System: Gallbladder AI Diagnostics v1.0

ANALYSIS RESULTS
================

Filename: ${data.filename || 'N/A'}
Predicted Class: ${data.predicted_class || 'N/A'}
Confidence Score: ${data.confidence_score || 'N/A'}
Processing Time: ${data.processing_time || 'N/A'}

IMPORTANT DISCLAIMER
====================

This AI analysis is for educational and research purposes only. 
The results should NOT be used for medical diagnosis or treatment decisions.
Please consult with a qualified healthcare professional for proper medical evaluation.

SYSTEM INFORMATION
==================

AI Model: Gallbladder Classification Neural Network
Analysis Date: ${new Date().toLocaleDateString()}
Report Generated: ${timestamp}

For questions or support, please contact your healthcare provider.
    `.trim();
}

function showSuccessMessage(message) {
    // Create and show a temporary success alert
    const successAlert = document.createElement('div');
    successAlert.className = 'alert alert-success alert-dismissible fade show position-fixed';
    successAlert.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    successAlert.innerHTML = `
        <i class="fas fa-check-circle me-2"></i>
        ${message}
        <button type="button" class="btn-close" onclick="this.parentElement.remove()"></button>
    `;
    
    document.body.appendChild(successAlert);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (successAlert.parentElement) {
            successAlert.remove();
        }
    }, 5000);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Error handling for unhandled promise rejections
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    showError('An unexpected error occurred. Please try again.');
    event.preventDefault();
});

// Page visibility change handler to reset processing state
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible' && isProcessing) {
        // Reset processing state if page becomes visible while processing
        isProcessing = false;
        setLoadingState(false);
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // ESC key to reset analysis
    if (event.key === 'Escape' && !isProcessing) {
        resetAnalysis();
    }
    
    // Enter key to start prediction (if file is selected and not processing)
    if (event.key === 'Enter' && selectedFile && !isProcessing) {
        predictImage();
    }
});

// Initialize tooltips (if using Bootstrap tooltips)
document.addEventListener('DOMContentLoaded', function() {
    // Enable Bootstrap tooltips if they exist
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    if (window.bootstrap && window.bootstrap.Tooltip) {
        tooltipTriggerList.map(function(tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
});

// Performance monitoring
let performanceData = {
    uploadTime: 0,
    processingTime: 0,
    renderTime: 0
};

function trackPerformance(action, startTime) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    switch(action) {
        case 'upload':
            performanceData.uploadTime = duration;
            break;
        case 'processing':
            performanceData.processingTime = duration;
            break;
        case 'render':
            performanceData.renderTime = duration;
            break;
    }
    
    console.log(`Performance - ${action}: ${duration.toFixed(2)}ms`);
}
