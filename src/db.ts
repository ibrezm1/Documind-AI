import Dexie, { type Table } from 'dexie';

export interface Book {
  id: string; // UUID string
  title: string;
  totalPages: number;
  currentPage: number;
  pages: string[]; // Page-by-page extracted text content (1-indexed based)
  fileData: ArrayBuffer; // Binary contents of the PDF file to render pages visually
  createdAt: number;
}

export interface ChatMessage {
  id: string; // UUID string
  bookId: string;
  sender: 'user' | 'assistant';
  text: string;
  pageNumber: number; // page number the user was on when they asked/replied
  highlightedText?: string; // snippet context if any
  timestamp: number;
}

export class PdfChatDatabase extends Dexie {
  books!: Table<Book>;
  messages!: Table<ChatMessage>;

  constructor() {
    super('PdfChatDatabase');
    this.version(1).stores({
      books: 'id, title, currentPage, createdAt',
      messages: 'id, bookId, sender, timestamp',
    });
  }
}

export const db = new PdfChatDatabase();
