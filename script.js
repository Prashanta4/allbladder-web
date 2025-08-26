async function predictImage() {
    const imageInput = document.getElementById('imageInput');
    const preview = document.getElementById('preview');
    const result = document.getElementById('result');
    const error = document.getElementById('error');

    // Clear previous results
    preview.innerHTML = '';
    result.innerHTML = '';
    error.innerHTML = '';

    if (!imageInput.files[0]) {
        error.innerHTML = 'Please select an image.';
        return;
    }

    // Show image preview
    const img = document.createElement('img');
    img.src = URL.createObjectURL(imageInput.files[0]);
    preview.appendChild(img);

    // Prepare form data
    const formData = new FormData();
    formData.append('file', imageInput.files[0]);

    try {
        const response = await fetch('https://prasanta4-my-model-deployment.hf.space/predict', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed with status ${response.status}: ${errorText}`);
        }

        const data = await response.json();

        // Check for required fields
        if (!data || !data.filename || !data.predicted_class || !data.confidence_score) {
            throw new Error('Invalid API response: Missing required fields (filename, predicted_class, confidence_score)');
        }

        result.innerHTML = `
            <h4>Prediction Result</h4>
            <p><strong>Filename:</strong> ${data.filename}</p>
            <p><strong>Predicted Class:</strong> ${data.predicted_class}</p>
            <p><strong>Confidence Score:</strong> ${(data.confidence_score * 100).toFixed(2)}%</p>
        `;
    } catch (err) {
        error.innerHTML = `Error: ${err.message}`;
        console.error('API Error:', err);
    }
}
