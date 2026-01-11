// tools.js

async function convertImagesToPdf(images) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const dataUrl = await readFileAsDataURL(image);
        const img = await loadImage(dataUrl);

        // Calculate dimensions to fit A4 (210x297 mm) in points (1 mm = 2.83465 points)
        const A4_WIDTH = 210 * 2.83465;
        const A4_HEIGHT = 297 * 2.83465;

        let width = img.width;
        let height = img.height;

        // Scale the image to fit A4
        const scale = Math.min(A4_WIDTH / width, A4_HEIGHT / height);
        width *= scale;
        height *= scale;

        // Add a page for the first image only if it's not the first page
        if (i > 0) {
            pdf.addPage();
        }

        pdf.addImage(dataUrl, 'JPEG', 0, 0, width, height);
    }

    return pdf.output('blob');
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = dataUrl;
    });
}
