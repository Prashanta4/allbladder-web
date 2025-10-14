// Global variables
let selectedFile = null;
let isProcessing = false;
let _lastChangeMs = 0; // ignore duplicate rapid change events

// DOM Elements
const imageInput = document.getElementById('imageInput');
const uploadArea = document.getElementById('uploadArea');
const preview = document.getElementById('preview');
const result = document.getElementById('result');
const error = document.getElementById('error');
const errorMessage = document.getElementById('errorMessage');
const predictBtn = document.getElementById('predictBtn');
const xaiBtn = document.getElementById('xaiBtn');

// Named handlers so we don't accidentally attach duplicates
function onImageInputChange(e) {
    // Debounce / ignore duplicates: if a change happened in the last 500ms, ignore
    const now = Date.now();
    if (now - _lastChangeMs < 500) {
        // ignore noisy duplicate
        return;
    }
    _lastChangeMs = now;

    const file = e.target.files && e.target.files[0];
    if (file) {
        validateAndProcessFile(file);
        // Clear input value AFTER a short delay so the "same file" can be picked again and fire change
        setTimeout(() => {
            try { imageInput.value = ""; } catch (err) { /* ignore */ }
        }, 200);
    }
}

function onUploadAreaClick(e) {
    // clicking the upload area should open the file picker
    e.preventDefault();
    e.stopPropagation();
    imageInput.click();
}

function onUploadAreaDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function onUploadAreaDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
}

function onUploadAreaDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length > 0) {
        // protect against very quick duplicate events
        const now = Date.now();
        if (now - _lastChangeMs < 300) return;
        _lastChangeMs = now;

        validateAndProcessFile(files[0]);
        // keep input cleared so user can later click choose file and the change will fire
        setTimeout(() => {
            try { imageInput.value = ""; } catch (err) { /* ignore */ }
        }, 200);
    }
}

// attach listeners once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Remove any previously attached listeners (safe no-op)
    imageInput.removeEventListener('change', onImageInputChange);
    uploadArea.removeEventListener('click', onUploadAreaClick);
    uploadArea.removeEventListener('dragover', onUploadAreaDragOver);
    uploadArea.removeEventListener('dragleave', onUploadAreaDragLeave);
    uploadArea.removeEventListener('drop', onUploadAreaDrop);

    // Attach listeners
    imageInput.addEventListener('change', onImageInputChange);
    uploadArea.addEventListener('click', onUploadAreaClick);
    uploadArea.addEventListener('dragover', onUploadAreaDragOver);
    uploadArea.addEventListener('dragleave', onUploadAreaDragLeave);
    uploadArea.addEventListener('drop', onUploadAreaDrop);

    // Prevent page-level drag/drop from navigating away
    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => e.preventDefault());
});

// rest of your helpers (unchanged except small touches)
function validateAndProcessFile(file) {
    hideError();
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'];
    if (!allowed.includes(file.type)) return showError('Invalid file type.');
    if (file.size > 10 * 1024 * 1024) return showError('File must be under 10MB.');
    selectedFile = file;
    displayImagePreview(file);
    enableButtons();
}

function displayImagePreview(file) {
    const reader = new FileReader();
    reader.onload = e => {
        preview.innerHTML = `
            <div class="preview-container">
                <img src="${e.target.result}" class="img-fluid" alt="Preview">
                <div class="image-overlay" onclick="removeImage()"><i class="fas fa-times"></i></div>
            </div>
        `;
        uploadArea.style.display = 'none';
    };
    reader.readAsDataURL(file);
}

function enableButtons() {
    [predictBtn, xaiBtn].forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('btn-secondary');
    });
}

function disableButtons() {
    [predictBtn, xaiBtn].forEach(btn => btn.disabled = true);
}

function removeImage() {
    selectedFile = null;
    preview.innerHTML = '';
    uploadArea.style.display = 'block';
    disableButtons();
    hideResult();
    hideError();
    try { imageInput.value = ""; } catch (err) { /* ignore */ }
}

// predictImage, displayResults, setLoadingState, showError, hideError, hideResult
// keep as you already implemented them — unchanged
// (copy your existing functions here)

async function predictImage(mode) {
    if (!selectedFile || isProcessing) return;

    hideError();
    hideResult();
    isProcessing = true;
    setLoadingState(true, mode);

    try {
        const endpoint = mode === 'explain'
            ? 'https://prasanta4-my-model-deployment.hf.space/explain'
            : 'https://prasanta4-my-model-deployment.hf.space/predict';

        const formData = new FormData();
        formData.append('file', selectedFile);

        const response = await fetch(endpoint, { method: 'POST', body: formData });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        displayResults(data, mode);
    } catch (err) {
        console.error(err);
        showError('Failed to analyze. Please try again.');
    } finally {
        isProcessing = false;
        setLoadingState(false, mode);
    }
}

function displayResults(data, mode) {
    const confidence = Math.round((data.confidence_score ?? 0) * 100);

    let xaiImagesHTML = '';
    if (mode === 'explain' && data.xai) {
        const xaiMethods = ['gradcam', 'shap', 'lime'];
        xaiImagesHTML = `
            <div class="text-center mt-4">
                <h5>Explainability Maps</h5>
                <div class="row justify-content-center mt-3">
                    ${xaiMethods
                        .filter(m => data.xai[m])
                        .map(
                            m => `
                            <div class="col-md-4 mb-3">
                                <div class="card shadow-sm">
                                    <div class="card-header text-capitalize fw-bold bg-light">${m}</div>
                                    <div class="card-body p-2">
                                        <img src="data:image/png;base64,${data.xai[m]}" 
                                             class="img-fluid rounded" 
                                             alt="${m} visualization">
                                    </div>
                                </div>
                            </div>
                        `
                        )
                        .join('')}
                </div>
            </div>
        `;
    }

    result.innerHTML = `
        <div class="result-card">
            <div class="result-header">
                <i class="fas fa-chart-line"></i>
                <h4 class="mb-0">${mode === 'explain' ? 'XAI Analysis Results' : 'AI Analysis Results'}</h4>
            </div>
            <div class="result-item">
                <span class="result-label"><i class="fas fa-diagnosis me-2"></i>Predicted Class:</span>
                <span class="result-value">${data.predicted_class}</span>
            </div>
            <div class="result-item">
                <span class="result-label"><i class="fas fa-percentage me-2"></i>Confidence:</span>
                <span class="result-value">${confidence}%</span>
            </div>
            ${xaiImagesHTML}
        </div>
    `;
    result.style.display = 'block';
}

function setLoadingState(loading, mode) {
    const btn = mode === 'explain' ? xaiBtn : predictBtn;
    const text = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner-border');
    if (loading) {
        text.textContent = 'Analyzing...';
        spinner.classList.remove('d-none');
        disableButtons();
    } else {
        text.textContent = mode === 'explain' ? 'Analyze with XAI' : 'Analyze Image';
        spinner.classList.add('d-none');
        enableButtons();
    }
}

function showError(msg) {
    errorMessage.textContent = msg;
    error.classList.remove('d-none');
}

function hideError() { error.classList.add('d-none'); }
function hideResult() { result.style.display = 'none'; }
