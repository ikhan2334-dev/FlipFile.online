const worker = new Worker('worker.js');

worker.postMessage({
  file: fileData,
  action: 'compress',
  options: { quality: 0.8 }
});

worker.onmessage = (event) => {
  if (event.data.success) {
    // Handle success
  } else {
    // Handle error
  }
};
