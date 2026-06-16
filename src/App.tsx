import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { Sidebar } from './components/Sidebar';
import { PdfReader } from './components/PdfReader';
import { ChatInterface } from './components/ChatInterface';
import { SettingsModal, type Settings } from './components/SettingsModal';
import { 
  Menu, 
  BookOpen, 
  MessageSquare, 
  AlertCircle, 
  Cpu, 
  PanelLeftOpen, 
  PanelLeftClose, 
  MessageSquareOff,
  Settings as SettingsIcon
} from 'lucide-react';
import './App.css';

const LOCAL_STORAGE_KEY = 'pdf_chat_assistant_settings';

const DEFAULT_SETTINGS: Settings = {
  apiKey: 'sk-or-test',
  model: 'google/gemini-2.5-flash',
  theme: 'system',
};

function App() {
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'reader' | 'chat'>('reader');

  // Sidebar and Chat collapsible states
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);

  // Load settings from localStorage
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Highlight Selection Bridge
  const [selectionContext, setSelectionContext] = useState<string | null>(null);
  const [selectionAction, setSelectionAction] = useState<'ask' | 'summarize' | null>(null);

  // Reactively fetch active book details
  const activeBook = useLiveQuery(
    async () => {
      if (!activeBookId) return undefined;
      return await db.books.get(activeBookId);
    },
    [activeBookId]
  );

  // Fetch the first book if active book is deleted or not set
  useEffect(() => {
    const checkActiveBook = async () => {
      if (activeBookId) {
        const exists = await db.books.get(activeBookId);
        if (!exists) {
          setActiveBookId(null);
        }
      }
    };
    checkActiveBook();
  }, [activeBook, activeBookId]);

  // Sync theme configurations
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const isDark =
        settings.theme === 'dark' ||
        (settings.theme === 'system' && mediaQuery.matches);
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme();

    if (settings.theme === 'system') {
      mediaQuery.addEventListener('change', applyTheme);
      return () => mediaQuery.removeEventListener('change', applyTheme);
    }
  }, [settings.theme]);

  // Save settings handler
  const handleSaveSettings = (newSettings: Settings) => {
    setSettings(newSettings);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newSettings));
  };

  // Selection Quick Action Callback
  const handleAskAi = (text: string, action?: 'ask' | 'summarize') => {
    setSelectionContext(text);
    setSelectionAction(action || 'ask');
    // If chat pane is collapsed, expand it so the user can interact
    if (isChatCollapsed) {
      setIsChatCollapsed(false);
    }
    // If on mobile layout, switch active tab to chat
    setActiveTab('chat');
  };

  const handleClearSelectionContext = () => {
    setSelectionContext(null);
    setSelectionAction(null);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      
      {/* Desktop Sidebar Panel (Collapsible with smooth transitions) */}
      <div 
        className={`hidden md:block h-full shrink-0 transition-all duration-300 ease-in-out border-r border-gray-200/50 dark:border-gray-800/50 ${
          isSidebarCollapsed ? 'w-0 overflow-hidden border-r-0 opacity-0' : 'w-72 md:w-80 opacity-100'
        }`}
      >
        <Sidebar
          activeBookId={activeBookId}
          onSelectBook={(id) => {
            setActiveBookId(id);
            setSelectionContext(null);
            setSelectionAction(null);
          }}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      </div>

      {/* Mobile Drawer Slide-out Sidebar Sheet */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
          />
          {/* Drawer content */}
          <div className="relative flex flex-col w-72 max-w-xs bg-slate-50 dark:bg-slate-950 border-r border-gray-200 dark:border-gray-800 shadow-2xl animate-in slide-in-from-left duration-200 h-full">
            <Sidebar
              activeBookId={activeBookId}
              onSelectBook={(id) => {
                setActiveBookId(id);
                setIsSidebarOpen(false);
                setSelectionContext(null);
                setSelectionAction(null);
              }}
              onOpenSettings={() => {
                setIsSettingsOpen(true);
                setIsSidebarOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Main Splitscreen Layout Panel */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Top Navbar / Header Controls */}
        <header className="flex items-center justify-between px-6 py-4 bg-white/40 dark:bg-slate-900/10 border-b border-gray-200/50 dark:border-gray-800/50 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile Drawer Toggle */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 md:hidden transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Desktop Sidebar Collapsible Trigger */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden md:flex p-1.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
              title={isSidebarCollapsed ? "Show Library Sidebar" : "Hide Library Sidebar"}
            >
              {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>

            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
              <span className="text-sm font-bold text-gray-950 dark:text-white flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                PDF Workspace
              </span>
              <span className="hidden md:inline text-xs text-gray-400">•</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px] md:max-w-xs">
                {activeBook ? activeBook.title : 'No document loaded'}
              </span>
            </div>
          </div>

          {/* Collapsible Chat & Settings Controls */}
          <div className="flex items-center gap-3">
            {activeBook && (
              <button
                onClick={() => setIsChatCollapsed(!isChatCollapsed)}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors text-xs font-semibold"
                title={isChatCollapsed ? "Show AI Companion" : "Hide AI Companion"}
              >
                {isChatCollapsed ? (
                  <>
                    <MessageSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>Show Chat</span>
                  </>
                ) : (
                  <>
                    <MessageSquareOff className="w-4 h-4 text-gray-400" />
                    <span>Hide Chat</span>
                  </>
                )}
              </button>
            )}

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block text-[11px] font-semibold text-gray-400 dark:text-gray-500 font-mono">
                Model: {settings.model.split('/').pop()}
              </span>
              {!settings.apiKey && (
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-400 animate-pulse hover:bg-yellow-500/20 transition-all font-semibold cursor-pointer"
                  title="Click to configure OpenRouter API Key"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  Configure API Key
                </button>
              )}
            </div>

            {/* Persistent Settings Toggle Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
              title="Open AI Settings"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Tab Selection Row (Mobile Layouts < 768px) */}
        <div className="flex border-b border-gray-200/50 dark:border-gray-800/50 bg-white/20 dark:bg-black/10 md:hidden shrink-0">
          <button
            onClick={() => setActiveTab('reader')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'reader'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 dark:text-gray-400'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Reader Pane
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'chat'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 dark:text-gray-400'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            AI Companion
          </button>
        </div>

        {/* Core Layout Containers */}
        <main className="flex-1 p-4 md:p-6 overflow-hidden min-h-0">
          
          {/* Desktop & Tablet side-by-side layout (md screens +) */}
          <div className="hidden md:block h-full w-full">
            {activeBook ? (
              <div className={`grid gap-6 h-full w-full transition-all duration-300 ease-in-out ${
                isChatCollapsed ? 'grid-cols-1' : 'grid-cols-2'
              }`}>
                <PdfReader
                  book={activeBook}
                  onAskAi={handleAskAi}
                />
                {!isChatCollapsed && (
                  <ChatInterface
                    bookId={activeBook.id}
                    bookTitle={activeBook.title}
                    currentPage={activeBook.currentPage}
                    currentPageText={activeBook.pages[activeBook.currentPage] || ''}
                    settings={settings}
                    selectionContext={selectionContext}
                    selectionAction={selectionAction}
                    onClearSelectionContext={handleClearSelectionContext}
                  />
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl bg-white/20 dark:bg-slate-900/10">
                <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-700 mb-3" />
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">No Book Loaded</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mt-1">
                  Upload a PDF in the sidebar to extract its contents and start asking questions page-by-page.
                </p>
              </div>
            )}
          </div>

          {/* Mobile single panel switcher layout */}
          <div className="md:hidden h-full w-full">
            {activeBook ? (
              activeTab === 'reader' ? (
                <PdfReader
                  book={activeBook}
                  onAskAi={handleAskAi}
                />
              ) : (
                <ChatInterface
                  bookId={activeBook.id}
                  bookTitle={activeBook.title}
                  currentPage={activeBook.currentPage}
                  currentPageText={activeBook.pages[activeBook.currentPage] || ''}
                  settings={settings}
                  selectionContext={selectionContext}
                  selectionAction={selectionAction}
                  onClearSelectionContext={handleClearSelectionContext}
                />
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl bg-white/20 dark:bg-slate-900/10">
                <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-700 mb-3" />
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">No Book Loaded</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mt-1">
                  Click the Menu icon to import or select a PDF and get started.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Global AI settings Modal popup */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />
    </div>
  );
}

export default App;
