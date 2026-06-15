import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ChatMessage } from '../db';
import { streamChatCompletion, type Settings } from '../utils/openRouter';
import { 
  Send, 
  Trash2, 
  Sparkles, 
  Paperclip, 
  User, 
  Bot, 
  X,
  MessageSquare
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';

interface ChatInterfaceProps {
  bookId: string | null;
  bookTitle: string;
  currentPage: number;
  currentPageText: string;
  settings: Settings;
  selectionContext: string | null;
  selectionAction: 'ask' | 'summarize' | null;
  onClearSelectionContext: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  bookId,
  bookTitle,
  currentPage,
  currentPageText,
  settings,
  selectionContext,
  selectionAction,
  onClearSelectionContext,
}) => {
  const [input, setInput] = useState('');
  const [activeSelection, setActiveSelection] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Sync selectionContext from props
  useEffect(() => {
    if (selectionContext) {
      if (selectionAction === 'summarize') {
        // Automatically trigger summary query
        handleSend(`Please summarize this selected text.`, selectionContext);
        onClearSelectionContext();
      } else if (selectionAction === 'ask') {
        // Set as active selection context and focus typing area
        setActiveSelection(selectionContext);
        onClearSelectionContext();
        // Focus text area
        const textarea = document.getElementById('chat-textarea');
        if (textarea) textarea.focus();
      }
    }
  }, [selectionContext, selectionAction]);

  // Load chat history for the active book
  const messages = useLiveQuery(
    async () => {
      if (!bookId) return [];
      return await db.messages
        .where('bookId')
        .equals(bookId)
        .sortBy('timestamp');
    },
    [bookId]
  );

  // Scroll to bottom helper
  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Scroll on new messages or active streaming
  useEffect(() => {
    scrollToBottom(isStreaming ? 'auto' : 'smooth');
  }, [messages, streamingText, isStreaming]);

  const handleSend = async (customPrompt?: string, forcedSelection?: string | null) => {
    const promptToSend = (customPrompt || input).trim();
    if (!promptToSend || !bookId) return;

    if (!customPrompt) setInput('');
    setErrorMsg(null);
    setIsStreaming(true);
    setStreamingText('');

    const currentSelection = forcedSelection !== undefined ? forcedSelection : activeSelection;
    setActiveSelection(null); // Clear active selection context badge

    // 1. Save User Message
    const userMessageId = crypto.randomUUID();
    const userMessage: ChatMessage = {
      id: userMessageId,
      bookId,
      sender: 'user',
      text: promptToSend,
      pageNumber: currentPage,
      highlightedText: currentSelection || undefined,
      timestamp: Date.now(),
    };

    await db.messages.add(userMessage);

    // 2. Fetch history context
    const history = messages || [];
    const context = {
      bookTitle,
      pageNumber: currentPage,
      pageText: currentPageText,
      highlightedText: currentSelection || undefined,
    };

    // 3. Start Streaming Completion
    let finalAssistantText = '';
    try {
      const textChunks = streamChatCompletion(
        promptToSend,
        history,
        context,
        settings
      );

      for await (const chunk of textChunks) {
        finalAssistantText += chunk;
        setStreamingText(finalAssistantText);
      }

      // 4. Save completed Assistant Message
      if (finalAssistantText.trim()) {
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          bookId,
          sender: 'assistant',
          text: finalAssistantText,
          pageNumber: currentPage,
          highlightedText: currentSelection || undefined,
          timestamp: Date.now(),
        };
        await db.messages.add(assistantMessage);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'An error occurred while streaming response.');
    } finally {
      setIsStreaming(false);
      setStreamingText('');
    }
  };

  const handleClearHistory = async () => {
    if (bookId && confirm('Are you sure you want to clear chat history for this book?')) {
      await db.messages.where({ bookId }).delete();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!bookId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-white/40 dark:bg-slate-900/20 backdrop-blur-md rounded-2xl border border-gray-200/50 dark:border-gray-800/50">
        <MessageSquare className="w-12 h-12 text-purple-500/40 mb-3 animate-pulse" />
        <h3 className="text-base font-bold text-gray-900 dark:text-white">AI Companion Chat</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs mt-1">
          Select or import a PDF from the sidebar library to enable active reading context and chat queries.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white/40 dark:bg-slate-900/20 backdrop-blur-md rounded-2xl border border-gray-200/50 dark:border-gray-800/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/50 dark:border-gray-800/50 bg-white/20 dark:bg-black/10">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Assistant Chat
          </span>
        </div>

        {messages && messages.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-red-50 dark:hover:bg-red-950/20 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Chat
          </button>
        )}
      </div>

      {/* Messages Thread Container */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
      >
        {messages?.length === 0 && !streamingText && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 dark:text-gray-500 py-12 px-4 space-y-3">
            <Sparkles className="w-8 h-8 text-purple-500/40" />
            <div>
              <p className="text-sm font-semibold">Start your companion chat</p>
              <p className="text-xs max-w-xs mt-1">
                Ask questions about page {currentPage}, get summaries, or highlight text inside the reading pane for quick queries!
              </p>
            </div>
            {/* Suggestion Chips */}
            <div className="flex flex-wrap justify-center gap-2 pt-2 max-w-sm">
              <button
                onClick={() => handleSend(`Can you summarize what this page is about?`)}
                className="text-xs py-1.5 px-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-purple-400 bg-white/50 dark:bg-slate-900/40 hover:bg-purple-50/20 text-gray-600 dark:text-gray-400 transition-colors"
              >
                Summarize current page
              </button>
              <button
                onClick={() => handleSend(`What are the key terms mentioned here?`)}
                className="text-xs py-1.5 px-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-purple-400 bg-white/50 dark:bg-slate-900/40 hover:bg-purple-50/20 text-gray-600 dark:text-gray-400 transition-colors"
              >
                Key terms check
              </button>
            </div>
          </div>
        )}

        {/* Message List */}
        {messages?.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}
            >
              {/* Avatar Row */}
              <div className={`flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 ${isUser ? 'flex-row-reverse' : ''}`}>
                <div 
                  className={`p-1 rounded-md shrink-0 ${
                    isUser 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-white/60 dark:bg-slate-800 text-purple-600 dark:text-purple-400 border border-gray-200/50 dark:border-gray-700/50'
                  }`}
                >
                  {isUser ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                </div>
                <span>{isUser ? 'You' : 'Assistant'}</span>
              </div>

              {/* Message Bubble */}
              <div className={`space-y-1.5 max-w-[95%] ${isUser ? 'text-right' : 'text-left'}`}>
                <div 
                  className={`px-4 py-2.5 rounded-2xl shadow-sm text-left ${
                    isUser
                      ? 'bg-purple-600 text-white rounded-tr-none'
                      : 'bg-white/70 dark:bg-slate-900/60 border border-gray-200/50 dark:border-gray-800/30 text-gray-900 dark:text-gray-150 rounded-tl-none'
                  }`}
                >
                  {isUser ? (
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  ) : (
                    <div className="text-sm leading-relaxed prose dark:prose-invert max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkMath, remarkGfm]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          p({ children }) {
                            return <p className="mb-2 last:mb-0">{children}</p>;
                          },
                          ul({ children }) {
                            return <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>;
                          },
                          ol({ children }) {
                            return <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>;
                          },
                          li({ children }) {
                            return <li className="text-xs md:text-sm">{children}</li>;
                          },
                          code({ className, children, ...props }) {
                            const inline = !className;
                            return inline ? (
                              <code className="bg-gray-150 dark:bg-slate-850 px-1 py-0.5 rounded text-xs font-mono text-purple-600 dark:text-purple-400" {...props}>
                                {children}
                              </code>
                            ) : (
                              <pre className="bg-gray-100 dark:bg-slate-950 p-3 rounded-xl overflow-x-auto my-2 border border-gray-200/50 dark:border-gray-800/60">
                                <code className={`${className} text-xs font-mono`} {...props}>
                                  {children}
                                </code>
                              </pre>
                            );
                          },
                          table({ children }) {
                            return (
                              <div className="overflow-x-auto my-3 rounded-lg border border-gray-200 dark:border-gray-850">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-850 text-xs text-left">
                                  {children}
                                </table>
                              </div>
                            );
                          },
                          thead({ children }) {
                            return <thead className="bg-gray-55 dark:bg-slate-850 text-gray-700 dark:text-gray-300 font-bold">{children}</thead>;
                          },
                          th({ children }) {
                            return <th className="px-3 py-2 border-b border-gray-200 dark:border-gray-850">{children}</th>;
                          },
                          td({ children }) {
                            return <td className="px-3 py-1.5 border-b border-gray-150 dark:border-gray-850 text-gray-600 dark:text-gray-400">{children}</td>;
                          },
                        }}
                      >
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>

                {/* Selection details badge */}
                {(msg.highlightedText || msg.pageNumber) && (
                  <div className={`flex flex-wrap items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500 ${isUser ? 'justify-end' : ''}`}>
                    <span>Page {msg.pageNumber} Context</span>
                    {msg.highlightedText && (
                      <>
                        <span>•</span>
                        <span className="italic truncate max-w-xs border-b border-dotted border-gray-300 dark:border-gray-700" title={msg.highlightedText}>
                          Selected: "{msg.highlightedText}"
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Live Streaming Message Display */}
        {streamingText && (
          <div className="flex flex-col gap-1 items-start">
            {/* Avatar Row */}
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500">
              <div className="p-1 rounded-md shrink-0 bg-white/60 dark:bg-slate-800 text-purple-600 dark:text-purple-400 border border-gray-200/50 dark:border-gray-700/50">
                <Bot className="w-3 h-3" />
              </div>
              <span>Assistant</span>
            </div>

            {/* Message Bubble */}
            <div className="space-y-1.5 max-w-[95%] text-left animate-in fade-in-30">
              <div className="px-4 py-2.5 rounded-2xl rounded-tl-none shadow-sm bg-white/70 dark:bg-slate-900/60 border border-gray-200/50 dark:border-gray-800/30 text-gray-900 dark:text-gray-150">
                <div className="text-sm leading-relaxed prose dark:prose-invert max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath, remarkGfm]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      p({ children }) { return <p className="mb-2 last:mb-0">{children}</p>; },
                      ul({ children }) { return <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>; },
                      ol({ children }) { return <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>; },
                      li({ children }) { return <li className="text-xs md:text-sm">{children}</li>; },
                      code({ className, children, ...props }) {
                        const inline = !className;
                        return inline ? (
                          <code className="bg-gray-150 dark:bg-slate-850 px-1 py-0.5 rounded text-xs font-mono text-purple-600 dark:text-purple-400" {...props}>
                            {children}
                          </code>
                        ) : (
                          <pre className="bg-gray-100 dark:bg-slate-950 p-3 rounded-xl overflow-x-auto my-2 border border-gray-200/50 dark:border-gray-800/60">
                            <code className={`${className} text-xs font-mono`} {...props}>
                              {children}
                            </code>
                          </pre>
                        );
                      },
                      table({ children }) {
                        return (
                          <div className="overflow-x-auto my-3 rounded-lg border border-gray-200 dark:border-gray-850">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-850 text-xs text-left">
                              {children}
                            </table>
                          </div>
                        );
                      },
                      thead({ children }) {
                        return <thead className="bg-gray-55 dark:bg-slate-850 text-gray-700 dark:text-gray-300 font-bold">{children}</thead>;
                      },
                      th({ children }) {
                        return <th className="px-3 py-2 border-b border-gray-200 dark:border-gray-850">{children}</th>;
                      },
                      td({ children }) {
                        return <td className="px-3 py-1.5 border-b border-gray-150 dark:border-gray-850 text-gray-600 dark:text-gray-400">{children}</td>;
                      },
                    }}
                  >
                    {streamingText}
                  </ReactMarkdown>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                <span>Streaming response...</span>
              </div>
            </div>
          </div>
        )}

        {/* Thinking Indicator */}
        {isStreaming && !streamingText && (
          <div className="flex flex-col gap-1 items-start">
            {/* Avatar Row */}
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500">
              <div className="p-1 rounded-md shrink-0 bg-white/60 dark:bg-slate-800 text-purple-600 dark:text-purple-400 border border-gray-200/50 dark:border-gray-700/50">
                <Bot className="w-3 h-3" />
              </div>
              <span>Assistant</span>
            </div>

            {/* Bubble */}
            <div className="px-4 py-3 rounded-2xl rounded-tl-none shadow-sm bg-white/70 dark:bg-slate-900/60 border border-gray-200/50 dark:border-gray-800/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce-custom delay-0" />
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce-custom delay-100" />
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce-custom delay-200" />
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="p-3.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-500/10 rounded-xl border border-red-500/20 text-center animate-shake">
            {errorMsg}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Tray */}
      <div className="p-4 border-t border-gray-200/50 dark:border-gray-800/50 bg-white/20 dark:bg-black/10 backdrop-blur-md space-y-2.5">
        {/* Selected text context active indicator */}
        {activeSelection && (
          <div className="flex items-center justify-between p-2 rounded-xl bg-purple-500/10 dark:bg-purple-400/10 border border-purple-500/20 dark:border-purple-400/20 animate-in fade-in slide-in-from-bottom-1 duration-150">
            <div className="flex items-center gap-2 min-w-0">
              <Paperclip className="w-3.5 h-3.5 text-purple-500 shrink-0" />
              <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wider shrink-0">
                Context Active:
              </span>
              <span className="text-xs truncate italic text-gray-600 dark:text-gray-400 pr-2">
                "{activeSelection}"
              </span>
            </div>
            <button
              onClick={() => setActiveSelection(null)}
              className="p-1 rounded-full text-purple-500 hover:text-purple-700 hover:bg-purple-50/20 dark:hover:bg-purple-400/20 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Suggestion Chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none select-none">
          <button
            onClick={() => handleSend("Explain the main points of this page in simple terms.")}
            disabled={isStreaming}
            className="shrink-0 text-[11px] font-semibold py-1.5 px-3 rounded-full border border-gray-200 dark:border-gray-800 hover:border-purple-500 hover:bg-purple-50/10 dark:hover:bg-purple-950/10 text-gray-700 dark:text-gray-400 disabled:opacity-40 transition-all cursor-pointer flex items-center gap-1 bg-white/40 dark:bg-slate-900/30"
          >
            <span>💡</span> Explain page
          </button>
          <button
            onClick={() => handleSend("Create a 5-question multiple-choice quiz based on the text on this page to test my understanding. Do not present the quiz in a table format; present it as standard text list format. For each question, include a helpful hint. Do not show the correct answers initially, and prompt me to write my answers in chat so you can grade them.")}
            disabled={isStreaming}
            className="shrink-0 text-[11px] font-semibold py-1.5 px-3 rounded-full border border-gray-200 dark:border-gray-800 hover:border-purple-500 hover:bg-purple-50/10 dark:hover:bg-purple-950/10 text-gray-700 dark:text-gray-400 disabled:opacity-40 transition-all cursor-pointer flex items-center gap-1 bg-white/40 dark:bg-slate-900/30"
          >
            <span>🧠</span> Quiz me
          </button>
          <button
            onClick={() => handleSend("Summarize the key takeaways and main concepts of this page.")}
            disabled={isStreaming}
            className="shrink-0 text-[11px] font-semibold py-1.5 px-3 rounded-full border border-gray-200 dark:border-gray-800 hover:border-purple-500 hover:bg-purple-50/10 dark:hover:bg-purple-950/10 text-gray-700 dark:text-gray-400 disabled:opacity-40 transition-all cursor-pointer flex items-center gap-1 bg-white/40 dark:bg-slate-900/30"
          >
            <span>📋</span> Summarize
          </button>
          <button
            onClick={() => handleSend("Extract and define the key terms and concepts introduced on this page.")}
            disabled={isStreaming}
            className="shrink-0 text-[11px] font-semibold py-1.5 px-3 rounded-full border border-gray-200 dark:border-gray-800 hover:border-purple-500 hover:bg-purple-50/10 dark:hover:bg-purple-950/10 text-gray-700 dark:text-gray-400 disabled:opacity-40 transition-all cursor-pointer flex items-center gap-1 bg-white/40 dark:bg-slate-900/30"
          >
            <span>🔍</span> Define terms
          </button>
        </div>

        {/* Text Area Form */}
        <div className="flex items-end gap-2 bg-white/60 dark:bg-black/35 border border-gray-200 dark:border-gray-800 rounded-2xl p-1.5 focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-transparent transition-all">
          <textarea
            id="chat-textarea"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              activeSelection 
                ? "Ask about this selection..." 
                : `Ask a question about page ${currentPage}...`
            }
            disabled={isStreaming}
            className="flex-1 max-h-32 min-h-[40px] py-2 px-3 bg-transparent text-sm text-gray-950 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none resize-none disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isStreaming}
            className="p-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:hover:bg-purple-600 shadow-md shadow-purple-600/10 transition-all cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
