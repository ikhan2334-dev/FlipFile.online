// main.js

let selectedFiles = [];
let selectedTool = null;

// When files are selected via drag-and-drop or file input
function handleFiles(files) {
    selectedFiles = Array.from(files);
    displaySelectedFiles();
    showToolSelection();
}

// Display the selected files
function displaySelectedFiles() {
    const list = document.querySelector('.selected-files-list');
    list.innerHTML = '';
    selectedFiles.forEach(file => {
        const li = document.createElement('li');
        li.textContent = file.name;
        list.appendChild(li);
    });
    document.querySelector('.selected-files-section').style.display = 'block';
}

// Show the tool selection section
function showToolSelection() {
    document.querySelector('.tool-selection-section').style.display = 'block';
}

// When a tool is selected
document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        selectedTool = btn.dataset.tool;
        showProcessingOptions(selectedTool);
    });
});

// Show processing options based on the tool
function showProcessingOptions(tool) {
    const options = document.querySelector('.processing-options');
    options.innerHTML = '';
    let html = '';
    switch (tool) {
        case 'image-to-pdf':
            html = '<p>No options available for Image to PDF. Click Process to convert.</p>';
            break;
        // ... other tools
    }
    options.innerHTML = html;
    document.querySelector('.processing-section').style.display = 'block';
}

// Process the files when the process button is clicked
document.querySelector('.process-btn').addEventListener('click', async () => {
    if (!selectedTool) {
        alert('Please select a tool');
        return;
    }
    if (selectedFiles.length === 0) {
        alert('Please select files');
        return;
    }

    let resultBlob;
    switch (selectedTool) {
        case 'image-to-pdf':
            resultBlob = await convertImagesToPdf(selectedFiles);
            break;
        // ... other tools
    }

    // Show download link
    const downloadBtn = document.querySelector('.download-btn');
    const url = URL.createObjectURL(resultBlob);
    downloadBtn.href = url;
    downloadBtn.download = 'converted.pdf';
    document.querySelector('.download-section').style.display = 'block';
});
