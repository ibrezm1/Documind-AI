export interface ChatContext {
  bookTitle: string;
  pageNumber: number;
  pageText: string;
  highlightedText?: string;
}

export interface Settings {
  apiKey: string;
  model: string;
}

/**
 * Streams completion chunks from OpenRouter API using Async Generator.
 * Supports standard stream backpressures and error reporting.
 */
export async function* streamChatCompletion(
  userPrompt: string,
  history: { sender: 'user' | 'assistant'; text: string }[],
  context: ChatContext,
  settings: Settings
): AsyncGenerator<string, void, unknown> {
  const { apiKey, model } = settings;
  if (!apiKey) {
    throw new Error('API Key is missing. Please set it in Settings (cog icon in bottom-left).');
  }

  // Handle local test/mock API Key requests for demo mode
  if (apiKey === 'sk-or-test' || apiKey === 'test') {
    const isQuiz = userPrompt.toLowerCase().includes('quiz');
    const isSummary = userPrompt.toLowerCase().includes('summarize');
    
    let mockResponse = `Hello! I am your local AI companion. Since you are using the **test API Key**, I am running in local offline demo mode. 

Here is what I can extract from the context of **Page ${context.pageNumber}** of **"${context.bookTitle}"**:

1. **Active Page Context**: I have successfully read the page text (${context.pageText ? `${context.pageText.length} characters` : 'empty'}).
2. **Your Selection**: ${context.highlightedText ? `You highlighted: *"${context.highlightedText}"*` : 'No text highlighted currently.'}

*To connect to a live LLM model and stream real completions, click the Settings icon in the header and enter a valid OpenRouter API Key.*`;

    if (isQuiz) {
      mockResponse = `Here is your **5-question multiple-choice quiz** based on the document text:

**Q1: Which feature allows you to upload reference photos for better image generation?**
* A. Quick edit mode
* B. Reference photo upload
* C. Text-to-image prompt
* D. Style adjustment
*Hint: The option name describes the action of submitting a photo.*

**Q2: What does the generated photo appear in after upload?**
* A. The side panel
* B. The chat window
* C. A separate viewer
* D. The toolbar
*Hint: It is the main scrolling log container.*

**Q3: Which menu gives you access to Gemini image-creation features?**
* A. Tools menu
* B. Settings menu
* C. Edit menu
* D. View menu
*Hint: It contains helper functions and tools.*

**Q4: For which of the following is Nano Banana Pro explicitly mentioned as ideal?**
* A. Writing code
* B. Creating infographics for clubs
* C. Managing databases
* D. Translating documents
*Hint: Think of visual illustrations and flyers.*

**Q5: Which phrase describes the way you can refine an image output?**
* A. “Make it bigger”
* B. “Change the theme”
* C. Iterate on your prompt
* D. “Remove background”
*Hint: It means editing and repeating your typed request.*

*Please reply in the chat with your selections (e.g. Q1-B, Q2-A...) and I will grade them!*`;
    } else if (isSummary) {
      mockResponse = `### Page ${context.pageNumber} Executive Summary:

* **Document**: "${context.bookTitle}"
* **Visual Sizing**: Successfully parsed and rendered at optimal viewport size.
* **Selection Context**: ${context.highlightedText ? `Active focus selection: *"${context.highlightedText}"*` : 'None.'}

#### Core Concepts Introduced:
1. **Offline Persistence**: Retains PDF text and raw binaries in IndexedDB for fully local browser companion workloads.
2. **TextLayer Overlays**: Aligns selectable divs on top of raw HTML5 canvas rendering contexts.
3. **Responsive Splitscreen Panels**: Supports collapsing columns for mobile drawer panels and wide desktop reading grids.

*You can type any specific questions about the contents in the text box below.*`;
    }

    // Stream the mock text response out word-by-word with a slight delay
    const words = mockResponse.split(' ');
    for (const word of words) {
      await new Promise((resolve) => setTimeout(resolve, 30));
      yield word + ' ';
    }
    return;
  }

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];

  // 1. Inject context in System Prompt
  const systemPrompt = `You are a helpful, knowledgeable AI assistant helping the user read the document/book "${context.bookTitle}".
The user is currently reading Page ${context.pageNumber}.

Here is the exact text of the current page (Page ${context.pageNumber}):
"""
${context.pageText || '[No text extracted on this page]'}
"""
${
  context.highlightedText
    ? `\nAdditionally, the user has highlighted/selected this specific phrase or section from this page:\n"""\n${context.highlightedText}\n"""\nWhen answering, pay close attention to this highlighted snippet if relevant to the query.`
    : ''
}

Instructions:
- Answer the user's queries based on the provided page context, historical dialogue, and general understanding.
- Cite specific elements from the page text or book where applicable.
- Always write responses using standard Markdown formatting (bold, italic, numbered lists, bullet lists, markdown tables, and code snippets).
- If the question cannot be answered from the page, state that and use your general knowledge, but clarify you are using general knowledge.`;

  messages.push({ role: 'system', content: systemPrompt });

  // 2. Inject recent chat conversation history (up to last 10 messages for context size efficiency)
  const recentHistory = history.slice(-10);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text,
    });
  }

  // 3. Inject current user request
  messages.push({ role: 'user', content: userPrompt });

  // 4. Send API fetch request
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'PDF Chat Assistant',
    },
    body: JSON.stringify({
      model: model || 'google/gemini-2.5-flash',
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    let errorMessage = `OpenRouter request failed: ${response.status} ${response.statusText}`;
    try {
      const errorJson = await response.json();
      if (errorJson.error?.message) {
        errorMessage = errorJson.error.message;
      }
    } catch (_) {
      // JSON parse failed; fallback to status text
    }
    throw new Error(errorMessage);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Failed to get ReadableStream reader from the API response.');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const cleanedLine = line.trim();
        if (!cleanedLine) continue;

        if (cleanedLine.startsWith('data: ')) {
          const dataStr = cleanedLine.slice(6);
          if (dataStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(dataStr);
            const textChunk = parsed.choices?.[0]?.delta?.content;
            if (textChunk) {
              yield textChunk;
            }
          } catch (_) {
            // Buffer parsing error (usually incomplete chunks), skip and wait
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
