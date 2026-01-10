// worker.js
import { compressPDF } from './pdf-processor.js';

self.addEventListener('message', async (event) => {
  const { file, action, options } = event.data;
  
  try {
    const result = await compressPDF(file, options);
    self.postMessage({ success: true, result });
  } catch (error) {
    self.postMessage({ success: false, error: error.message });
  }
});
