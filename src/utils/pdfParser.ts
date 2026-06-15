import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure pdfjs worker to use the local bundled file URL managed by Vite.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface ExtractedPDF {
  title: string;
  totalPages: number;
  pages: string[]; // 1-indexed (index 0 will be empty, pages[1] is page 1 text)
}

/**
 * Extracts text from a PDF file page-by-page entirely in the browser.
 * @param file The PDF File object uploaded by the user
 * @param onProgress Optional progress callback (0 - 100)
 */
export async function parsePdf(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ExtractedPDF> {
  const arrayBuffer = await file.arrayBuffer();
  // Clone the ArrayBuffer to prevent browser worker thread from detaching the original reference
  const bufferCopy = arrayBuffer.slice(0);
  
  // Initialize the PDF loading task
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(bufferCopy),
    useSystemFonts: true,
    disableFontFace: true,
  });

  // Monitor loading progress (first 40% of overall progress)
  loadingTask.onProgress = (progressData: { loaded: number; total: number }) => {
    if (progressData.total > 0 && onProgress) {
      const percent = Math.round((progressData.loaded / progressData.total) * 40);
      onProgress(percent);
    }
  };

  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const pagesText: string[] = ['']; // index 0 is empty to keep text 1-indexed

  // Parse text page-by-page (remaining 60% of progress)
  for (let i = 1; i <= totalPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Combine text items into a coherent page text block
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      pagesText.push(pageText.trim());
    } catch (err) {
      console.error(`Error parsing text from page ${i}:`, err);
      pagesText.push(`[Error: Failed to parse text for page ${i}]`);
    }

    if (onProgress) {
      const percent = 40 + Math.round((i / totalPages) * 60);
      onProgress(percent);
    }
  }

  return {
    title: file.name.replace(/\.pdf$/i, ''),
    totalPages,
    pages: pagesText,
  };
}
