const img = new Image();
img.onload = function() {
    const pdf = new jsPDF({
        unit: 'pt',
        format: [img.width * 0.75, img.height * 0.75]
    });
    pdf.addImage(img, 'JPEG', 0, 0, img.width * 0.75, img.height * 0.75);
    // Then for the next image, we add a new page
};
img.src = dataURL;
