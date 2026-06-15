import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { db, type Book } from '../db';
import { ChevronLeft, ChevronRight, MessageSquare, Sparkles, BookOpen, Loader2, AlertCircle } from 'lucide-react';

// Import PDF.js stylesheet for standard text selection overlays
import 'pdfjs-dist/web/pdf_viewer.css';

interface PdfReaderProps {
  book: Book;
  onAskAi: (text: string, quickAction?: 'ask' | 'summarize') => void;
}

export const PdfReader: React.FC<PdfReaderProps> = ({ book, onAskAi }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pageInput, setPageInput] = useState(String(book.currentPage));
  const [bubblePos, setBubblePos] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [resizeKey, setResizeKey] = useState(0);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Trigger page re-rendering on window size alterations (rotations or viewport adjustments)
  useEffect(() => {
    const handleResize = () => {
      setResizeKey((prev) => prev + 1);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync page input when active page changes
  useEffect(() => {
    setPageInput(String(book.currentPage));
    setBubblePos(null);
    setSelectedText('');
    
    // Scroll container back to top when page changes
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [book.id, book.currentPage]);

  // Load PDF document from binary fileData saved in IndexedDB
  useEffect(() => {
    let active = true;
    setPdfDoc(null);
    setPdfError(null);
    setLoadingPdf(true);

    const loadDoc = async () => {
      try {
        if (!book.fileData) {
          throw new Error("Missing binary file data. This PDF was imported prior to the visual rendering update.");
        }
        // Clone the ArrayBuffer to prevent browser worker thread from detaching the original cache reference
        const bufferCopy = book.fileData.slice(0);
        // Load the document using PDF.js wrapped inside a Uint8Array view for safe binary execution
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bufferCopy) });
        const pdf = await loadingTask.promise;
        if (active) {
          setPdfDoc(pdf);
          setLoadingPdf(false);
        }
      } catch (err: any) {
        console.error('Error loading PDF document:', err);
        if (active) {
          setPdfError(err.message || 'Failed to initialize PDF parsing.');
          setPdfDoc(null);
          setLoadingPdf(false);
        }
      }
    };

    loadDoc();

    return () => {
      active = false;
    };
  }, [book.id, book.fileData]);

  // Render visual page canvas and text selection layer overlay
  useEffect(() => {
    if (!pdfDoc) return;

    let active = true;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(book.currentPage);
        if (!active) return;

        // Cancel previous rendering task if running to prevent overlays
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        // Calculate responsive scale based on parent container width
        const container = containerRef.current;
        let scale = 1.2;
        if (container) {
          const padding = window.innerWidth < 640 ? 16 : 48; // smaller padding on mobile devices
          const containerWidth = container.clientWidth - padding;
          const unscaledViewport = page.getViewport({ scale: 1.0 });
          scale = containerWidth / unscaledViewport.width;
          // Clamp scale: readable min 0.55, crisp max 1.5
          scale = Math.min(Math.max(scale, 0.55), 1.5);
        }

        const viewport = page.getViewport({ scale });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Sync relative container layout sizes
        const wrapper = canvas.parentElement;
        if (wrapper) {
          wrapper.style.width = `${viewport.width}px`;
          wrapper.style.height = `${viewport.height}px`;
        }

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        if (!active) return;

        // Generate selectable text overlay matching layout coordinates
        const textLayerDiv = textLayerRef.current;
        if (textLayerDiv) {
          textLayerDiv.innerHTML = '';
          textLayerDiv.style.width = `${viewport.width}px`;
          textLayerDiv.style.height = `${viewport.height}px`;

          const textContent = await page.getTextContent();
          if (!active) return;

          // Instantiate modern PDF.js TextLayer builder
          const textLayer = new pdfjsLib.TextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport: viewport,
          });
          await textLayer.render();
        }
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error('Error rendering page canvas:', err);
        }
      }
    };

    renderPage();

    return () => {
      active = false;
    };
  }, [pdfDoc, book.currentPage, resizeKey]);

  const updatePage = async (newPage: number) => {
    if (newPage < 1 || newPage > book.totalPages) return;
    await db.books.update(book.id, { currentPage: newPage });
  };

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };

  const handlePageInputBlur = () => {
    const pageNum = parseInt(pageInput);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= book.totalPages) {
      updatePage(pageNum);
    } else {
      setPageInput(String(book.currentPage));
    }
  };

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handlePageInputBlur();
    }
  };

  // Track text selections inside the Text Layer overlay
  const handleSelection = () => {
    const selection = window.getSelection();
    if (!selection) return;

    const text = selection.toString().trim();
    if (!text) {
      setBubblePos(null);
      setSelectedText('');
      return;
    }

    const range = selection.getRangeAt(0);
    const textLayer = textLayerRef.current;
    
    // Check if the highlighted text belongs to the rendered text layer
    if (textLayer && textLayer.contains(range.commonAncestorContainer)) {
      const rect = range.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setBubblePos({
          x: rect.left + rect.width / 2,
          y: rect.top - 10,
        });
        setSelectedText(text);
      }
    } else {
      setBubblePos(null);
      setSelectedText('');
    }
  };

  // Clear selections on blank clicks
  useEffect(() => {
    const handleDocumentClick = () => {
      const selection = window.getSelection();
      if (!selection || selection.toString().trim() === '') {
        setBubblePos(null);
        setSelectedText('');
      }
    };
    
    document.addEventListener('mouseup', handleDocumentClick);
    return () => {
      document.removeEventListener('mouseup', handleDocumentClick);
    };
  }, []);

  const triggerAction = (action: 'ask' | 'summarize') => {
    if (selectedText) {
      onAskAi(selectedText, action);
      window.getSelection()?.removeAllRanges();
      setBubblePos(null);
      setSelectedText('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white/40 dark:bg-slate-900/20 backdrop-blur-md rounded-2xl border border-gray-200/50 dark:border-gray-800/50 overflow-hidden relative">
      {/* Header Info Panel */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/50 dark:border-gray-800/50 bg-white/20 dark:bg-black/10">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate max-w-xs md:max-w-md">
            {book.title}
          </span>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
          Original Document Layout
        </div>
      </div>

      {/* Scrollable Visual Viewport Container */}
      <div
        ref={containerRef}
        onMouseUp={handleSelection}
        className="flex-1 overflow-auto p-6 flex justify-center bg-slate-100 dark:bg-slate-950/60"
      >
        {loadingPdf ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Loading visual layout...</span>
          </div>
        ) : pdfError ? (
          <div className="flex flex-col items-center justify-center py-20 text-center max-w-sm px-6 space-y-3 text-red-500">
            <AlertCircle className="w-8 h-8 text-red-500/80 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Failed to render PDF page</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{pdfError}</p>
            </div>
            {pdfError.includes("Missing binary") && (
              <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                To fix this, please delete and re-import this PDF from the sidebar library.
              </p>
            )}
          </div>
        ) : pdfDoc ? (
          <div className="relative border border-gray-200 dark:border-gray-800/80 shadow-lg bg-white select-text h-fit max-w-full">
            {/* Page Canvas Rendering */}
            <canvas ref={canvasRef} className="block max-w-full" />
            
            {/* Interactive Text Selection Layer Overlay */}
            <div 
              ref={textLayerRef} 
              className="textLayer absolute inset-0 select-text overflow-hidden" 
              style={{ 
                pointerEvents: 'auto',
                mixBlendMode: 'multiply'
              }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-red-500 text-sm font-medium">
            Failed to render PDF.
          </div>
        )}
      </div>

      {/* Floating Action Bubble */}
      {bubblePos && selectedText && (
        <div
          className="fixed z-40 flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 dark:bg-slate-950 text-white shadow-xl border border-slate-700/50 animate-in fade-in slide-in-from-bottom-2 duration-150"
          style={{
            left: `${bubblePos.x}px`,
            top: `${bubblePos.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => triggerAction('ask')}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg hover:bg-white/10 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
            Ask AI
          </button>
          <div className="w-[1px] h-4 bg-slate-700/80" />
          <button
            onClick={() => triggerAction('summarize')}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg hover:bg-white/10 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
            Summarize
          </button>
        </div>
      )}

      {/* Bottom Pagination Controls */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200/50 dark:border-gray-800/50 bg-white/20 dark:bg-black/10 backdrop-blur-md">
        <button
          onClick={() => updatePage(book.currentPage - 1)}
          disabled={book.currentPage <= 1 || loadingPdf}
          className="flex items-center gap-1 py-1.5 px-3 text-sm font-semibold rounded-xl border border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-slate-900/30 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Page</span>
          <input
            type="text"
            value={pageInput}
            onChange={handlePageInputChange}
            onBlur={handlePageInputBlur}
            onKeyDown={handlePageInputKeyDown}
            disabled={loadingPdf}
            className="w-12 py-1 text-center font-semibold rounded-lg border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-slate-900/40 text-gray-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            of {book.totalPages}
          </span>
        </div>

        <button
          onClick={() => updatePage(book.currentPage + 1)}
          disabled={book.currentPage >= book.totalPages || loadingPdf}
          className="flex items-center gap-1 py-1.5 px-3 text-sm font-semibold rounded-xl border border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-slate-900/30 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent transition-all"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
