import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Book } from '../db';
import { parsePdf } from '../utils/pdfParser';
import { 
  FileText, 
  Trash2, 
  Settings as SettingsIcon, 
  Loader2, 
  BookOpen, 
  UploadCloud 
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface SidebarProps {
  activeBookId: string | null;
  onSelectBook: (bookId: string) => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeBookId,
  onSelectBook,
  onOpenSettings,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Reactively fetch books ordered by creation date
  const books = useLiveQuery(
    async () => {
      const allBooks = await db.books.toArray();
      return allBooks.sort((a, b) => b.createdAt - a.createdAt);
    },
    []
  );

  // Handles parsing a PDF File and adding it to IndexedDB
  const handlePdfFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setUploadError('Only PDF files are supported.');
      return;
    }

    setUploadError(null);
    setUploadProgress(0);

    try {
      const fileData = await file.arrayBuffer();
      const parsedData = await parsePdf(file, (progress) => {
        setUploadProgress(progress);
      });

      const bookId = crypto.randomUUID();
      const newBook: Book = {
        id: bookId,
        title: parsedData.title,
        totalPages: parsedData.totalPages,
        currentPage: 1,
        pages: parsedData.pages,
        fileData,
        createdAt: Date.now(),
      };

      await db.books.add(newBook);
      onSelectBook(bookId);

      // Play confetti on success
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 }
      });
      
      setUploadProgress(null);
    } catch (err) {
      console.error('Error importing book:', err);
      setUploadError('Failed to parse PDF. Make sure the file is not corrupted.');
      setUploadProgress(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlePdfFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handlePdfFile(file);
  };

  const handleDeleteBook = async (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this PDF? This will clear all its pages and chat history.')) {
      await db.books.delete(bookId);
      await db.messages.where({ bookId }).delete();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/10 dark:bg-slate-950/20 border-r border-gray-200/50 dark:border-gray-800/50 w-72 md:w-80 shrink-0">
      {/* Brand Header */}
      <div className="flex items-center gap-3 p-6 border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="p-2 rounded-xl bg-purple-600/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
          <BookOpen className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white leading-none">
            DocuMind AI
          </h1>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Local PDF Companion
          </span>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div className="p-4">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative overflow-hidden cursor-pointer group flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl transition-all duration-300 ${
            isDragging
              ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/20'
              : 'border-gray-300 dark:border-gray-800 hover:border-purple-400 dark:hover:border-purple-500/60 bg-white/40 dark:bg-slate-900/20'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf"
            className="hidden"
          />

          {uploadProgress !== null ? (
            <div className="flex flex-col items-center gap-2 text-purple-600 dark:text-purple-400 py-3">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-sm font-semibold">Extracting text...</span>
              <div className="w-32 bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 mt-1 overflow-hidden">
                <div 
                  className="bg-purple-600 h-1.5 rounded-full transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500">{uploadProgress}%</span>
            </div>
          ) : (
            <div className="text-center space-y-2 py-2">
              <div className="flex justify-center text-gray-400 group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors">
                <UploadCloud className="w-8 h-8" />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Import new PDF
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Drag & drop or click to browse
              </p>
            </div>
          )}
        </div>
        {uploadError && (
          <p className="mt-2 text-xs text-center text-red-500 font-medium">
            {uploadError}
          </p>
        )}
      </div>

      {/* Book List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-2 mb-3">
          Your Library ({books?.length || 0})
        </div>

        {books === undefined ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-gray-200/50 dark:border-gray-800/50 rounded-2xl bg-white/20 dark:bg-slate-900/10">
            <FileText className="w-8 h-8 mx-auto text-gray-400/80 mb-2" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Library is empty</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Upload a PDF to get started</p>
          </div>
        ) : (
          books.map((book) => {
            const isActive = book.id === activeBookId;
            return (
              <div
                key={book.id}
                onClick={() => onSelectBook(book.id)}
                className={`group relative flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/10'
                    : 'bg-white/40 dark:bg-slate-900/20 hover:bg-white/70 dark:hover:bg-slate-900/40 text-gray-700 dark:text-gray-300 border border-transparent hover:border-gray-200/50 dark:hover:border-gray-800/50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 pr-4">
                  <FileText className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-purple-500 dark:text-purple-400'}`} />
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${isActive ? 'text-white' : 'text-gray-950 dark:text-gray-100'}`}>
                      {book.title}
                    </p>
                    <p className={`text-xs ${isActive ? 'text-purple-200' : 'text-gray-400 dark:text-gray-500'}`}>
                      {book.totalPages} {book.totalPages === 1 ? 'page' : 'pages'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={(e) => handleDeleteBook(e, book.id)}
                  className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white ${
                    isActive ? 'text-purple-200 hover:bg-purple-700' : 'text-gray-400 hover:bg-red-50 dark:hover:bg-red-950/20'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Settings Row */}
      <div className="p-4 border-t border-gray-200/50 dark:border-gray-800/50 bg-white/20 dark:bg-black/10 backdrop-blur-md">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <SettingsIcon className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200" />
            <span className="text-sm font-medium">Settings & API Keys</span>
          </div>
          <span className="text-xs bg-gray-200/60 dark:bg-gray-800 px-2 py-0.5 rounded-md text-gray-500 dark:text-gray-400 font-mono">v1.0</span>
        </button>
      </div>
    </div>
  );
};
