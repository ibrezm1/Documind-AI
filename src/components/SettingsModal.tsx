import React, { useState, useEffect } from 'react';
import { 
  X, 
  Key, 
  Sparkles, 
  Sun, 
  Moon, 
  Monitor, 
  Eye, 
  EyeOff, 
  Search, 
  Check, 
  ChevronDown 
} from 'lucide-react';

export interface Settings {
  apiKey: string;
  model: string;
  theme: 'light' | 'dark' | 'system';
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (newSettings: Settings) => void;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [model, setModel] = useState(settings.model);
  const [theme, setTheme] = useState(settings.theme);
  const [showKey, setShowKey] = useState(false);

  // Custom search dropdown states
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Sync state with incoming props
  useEffect(() => {
    setApiKey(settings.apiKey);
    setModel(settings.model);
    setTheme(settings.theme);
    setIsDropdownOpen(false);
    setSearchQuery('');
  }, [settings, isOpen]);

  // Fetch OpenRouter models dynamically
  useEffect(() => {
    if (!isOpen) return;

    const fetchModels = async () => {
      setLoadingModels(true);
      try {
        const response = await fetch('https://openrouter.ai/api/v1/models');
        if (!response.ok) throw new Error('Network response failed');
        const json = await response.json();
        
        const mappedModels: OpenRouterModel[] = json.data || [];

        const isFree = (m: OpenRouterModel) => {
          return m.id.endsWith(':free') || 
                 (Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0);
        };

        // Sort: Free models first, then sort alphabetically
        const sorted = mappedModels.sort((a, b) => {
          const aFree = isFree(a);
          const bFree = isFree(b);
          if (aFree && !bFree) return -1;
          if (!aFree && bFree) return 1;
          return a.name.localeCompare(b.name);
        });

        setModels(sorted);
      } catch (err) {
        console.error('Failed to load OpenRouter models dynamically:', err);
        // Fallback models in case of network offline states
        const fallback: OpenRouterModel[] = [
          { id: 'google/gemini-2.5-flash', name: 'Google: Gemini 2.5 Flash', context_length: 1000000, pricing: { prompt: '0.0', completion: '0.0' } },
          { id: 'google/gemini-2.5-pro', name: 'Google: Gemini 2.5 Pro', context_length: 1000000, pricing: { prompt: '0.0000015', completion: '0.0000045' } },
          { id: 'deepseek/deepseek-chat', name: 'DeepSeek: V3 (Chat)', context_length: 64000, pricing: { prompt: '0.00000014', completion: '0.00000028' } },
          { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B Instruct (Free)', context_length: 131072, pricing: { prompt: '0.0', completion: '0.0' } },
          { id: 'meta-llama/llama-3-8b-instruct:free', name: 'Llama 3 8B Instruct (Free)', context_length: 8192, pricing: { prompt: '0.0', completion: '0.0' } },
        ];
        setModels(fallback);
      } finally {
        setLoadingModels(false);
      }
    };

    fetchModels();
  }, [isOpen]);

  if (!isOpen) return null;

  const isFreeModel = (m: OpenRouterModel) => {
    return m.id.endsWith(':free') || 
           (Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0);
  };

  const filteredModels = models.filter((m) => {
    const query = searchQuery.toLowerCase();
    return (m.name || '').toLowerCase().includes(query) || (m.id || '').toLowerCase().includes(query);
  });

  const selectedModel = models.find((m) => m.id === model);
  const selectedModelName = selectedModel ? (selectedModel.name || selectedModel.id) : model;
  const isSelectedFree = selectedModel ? isFreeModel(selectedModel) : model.endsWith(':free');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ apiKey, model, theme });
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={() => setIsDropdownOpen(false)}
    >
      <div 
        className="w-full max-w-md overflow-hidden transition-all duration-300 rounded-2xl glass border border-white/20 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
            <Key className="w-5 h-5 text-purple-500" />
            AI Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* API Key */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex justify-between">
              <span>OpenRouter API Key</span>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
              >
                Get a key
              </a>
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-or-..."
                className="w-full pl-3 pr-10 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-black/35 text-gray-950 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              API key is kept strictly in local browser storage.
            </p>
          </div>

          {/* Custom Searchable Model Selection Dropdown */}
          <div className="space-y-2 relative">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-500" />
              Assistant AI Model
            </label>

            <div className="relative">
              {/* Dropdown trigger button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDropdownOpen(!isDropdownOpen);
                }}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-black/35 text-gray-950 dark:text-white text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm font-semibold cursor-pointer"
              >
                <span className="truncate flex items-center gap-2">
                  {selectedModelName}
                  {isSelectedFree && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 font-bold uppercase shrink-0">
                      Free
                    </span>
                  )}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown popover overlay menu */}
              {isDropdownOpen && (
                <div 
                  className="absolute z-50 left-0 right-0 mt-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Search filter input */}
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-black/10">
                    <Search className="w-4 h-4 text-gray-400 shrink-0" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search OpenRouter models..."
                      className="w-full bg-transparent border-none text-xs text-gray-950 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none outline-none py-1"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded-md font-mono"
                      >
                        clear
                      </button>
                    )}
                  </div>

                  {/* Scrollable list */}
                  <div className="max-h-56 overflow-y-auto py-1.5 divide-y divide-gray-50 dark:divide-gray-850">
                    {loadingModels ? (
                      <div className="text-center py-6 text-xs text-gray-400 dark:text-gray-500 flex flex-col items-center gap-2">
                        <span className="w-4 h-4 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                        Loading model index...
                      </div>
                    ) : filteredModels.length === 0 ? (
                      <div className="text-center py-6 text-xs text-gray-400 dark:text-gray-500">
                        No models match your search
                      </div>
                    ) : (
                      filteredModels.map((m) => {
                        const active = model === m.id;
                        const free = isFreeModel(m);
                        const contextLimit = m.context_length ? `${Math.round(m.context_length / 1000)}k` : '';

                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setModel(m.id);
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2 flex items-center justify-between hover:bg-purple-500/5 dark:hover:bg-purple-500/10 transition-colors ${
                              active 
                                ? 'bg-purple-500/10 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold' 
                                : 'text-gray-750 dark:text-gray-300'
                            }`}
                          >
                            <div className="min-w-0 pr-4">
                              <div className="truncate text-xs flex items-center gap-1.5">
                                {m.name || m.id}
                                {active && <Check className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />}
                              </div>
                              <div className="truncate text-[10px] text-gray-400 dark:text-gray-500 font-mono mt-0.5">{m.id}</div>
                            </div>
                            
                            <div className="flex items-center gap-1.5 shrink-0">
                              {contextLimit && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-500 font-mono font-medium">
                                  {contextLimit}
                                </span>
                              )}
                              {free ? (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-green-500/15 border border-green-500/30 text-green-600 dark:text-green-400 font-bold uppercase tracking-wider">
                                  Free
                                </span>
                              ) : (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-gray-500/10 text-gray-400 dark:text-gray-500 font-mono">
                                  Paid
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Theme Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Display Theme
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['light', 'dark', 'system'] as const).map((t) => {
                const isActive = theme === t;
                const Icon = t === 'light' ? Sun : t === 'dark' ? Moon : Monitor;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTheme(t)}
                    className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl border text-sm capitalize transition-all duration-200 ${
                      isActive
                        ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 font-medium'
                        : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{t}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Save & Close Button */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-medium shadow-md shadow-purple-600/20 transition-all duration-200"
            >
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
