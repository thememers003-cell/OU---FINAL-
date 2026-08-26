// ============================================================
// Real-Time High-Res PDF & Document Page Image Renderer
// Renders actual visual pages of PDFs & converted DOCX to Canvas/Data URLs
// ============================================================

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

/**
 * Dynamically load PDF.js from official CDN if not already in window
 */
export async function loadPdfJs(): Promise<any> {
  if (typeof window === 'undefined') return null;

  if (window.pdfjsLib) {
    return window.pdfjsLib;
  }

  return new Promise((resolve) => {
    const existingScript = document.getElementById('pdfjs-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve(window.pdfjsLib);
        }
      });
      return;
    }

    const script = document.createElement('script');
    script.id = 'pdfjs-script';
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      } else {
        resolve(null);
      }
    };
    script.onerror = () => {
      console.warn('Could not load PDF.js from CDN');
      resolve(null);
    };
    document.head.appendChild(script);
  });
}

/**
 * Render the first N pages of a PDF File, Blob, or URL into high-resolution image data URLs
 */
export async function renderPdfPages(
  source: File | Blob | ArrayBuffer | string,
  maxPages: number = 10,
  scale: number = 1.3
): Promise<string[]> {
  try {
    const pdfjs = await loadPdfJs();
    if (!pdfjs) return [];

    let loadingTask: any;

    if (typeof source === 'string') {
      loadingTask = pdfjs.getDocument(source);
    } else if (source instanceof ArrayBuffer) {
      loadingTask = pdfjs.getDocument({ data: source });
    } else if (source instanceof Blob) {
      const arrayBuffer = await source.arrayBuffer();
      loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    } else {
      return [];
    }

    const pdfDoc = await loadingTask.promise;
    const numPages = Math.min(pdfDoc.numPages, maxPages);
    const pageImages: string[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) continue;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      pageImages.push(dataUrl);
    }

    return pageImages;
  } catch (err) {
    console.warn('Failed to render PDF pages to images:', err);
    return [];
  }
}
