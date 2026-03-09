// Notion AI Note Capture - Background Service Worker (Architecture: Design System 2026)

// 1. Initialize Context Menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "captureAndExplain",
      title: "Capture & Explain",
      contexts: ["selection"],
    });
  });

  chrome.storage.local.get(["queue", "recent"], (data) => {
    if (!data.queue) chrome.storage.local.set({ queue: [] });
    if (!data.recent) chrome.storage.local.set({ recent: [] });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "captureAndExplain") {
    captureFlow(tab.id);
  }
});

async function captureFlow(tabId) {
  try {
    const pageData = await chrome.tabs.sendMessage(tabId, { action: "getCaptureContext" });
    if (!pageData || !pageData.word) return;

    const capture = { ...pageData, timestamp: Date.now(), status: "pending" };
    await addToQueue(capture);
    processCapture(capture);
  } catch (err) {
    console.error("[Capture Error]:", err);
  }
}

async function addToQueue(item) {
  const data = await chrome.storage.local.get("queue");
  const queue = data.queue || [];
  queue.push(item);
  await chrome.storage.local.set({ queue });
}

// 2. AI Enrichment (Gemini 2.5 Flash)
async function callGemini(word, context) {
  const { geminiKey } = await chrome.storage.local.get("geminiKey");
  if (!geminiKey) throw new Error("Missing Gemini Key");

  const prompt = `
    Explain the following word/concept for a Design System Knowledge Base:
    Word: "${word}"
    Context: "${context}"
    
    Provide a professional explanation in JSON format with:
    - definition: concise definition
    - why_it_matters: significance
    - example: practical example
    - related_concepts: array of 3 terms
    - difficulty: 1-5
    - study_tip: short tip
    
    JSON only.
  `;

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { response_mime_type: "application/json", thinking_config: { include_thoughts: false, thinking_budget: -1 } },
    }),
  });

  const data = await response.json();
  const text = data.candidates[0].content.parts.find(p => p.text).text;
  return JSON.parse(text);
}

// 3. Notion Integration (Architecture 2026)

const NOTION_VERSION = "2025-09-03";

async function saveToDatabase(capture, enriched) {
  const { notionToken, notionDbId } = await chrome.storage.local.get(["notionToken", "notionDbId"]);
  if (!notionToken || !notionDbId) throw new Error("Missing Notion credentials (DB)");

  console.log(`[Notion] Saving entry: "${capture.word}" to Database ${notionDbId}`);

  // Construct Markdown string from enriched data
  const markdownContent = `
### Definition
${enriched.definition}

### Why It Matters
${enriched.why_it_matters}

### Example
${enriched.example}

### Related Concepts
${enriched.related_concepts.join(", ")}

### Study Tip
${enriched.study_tip}
  `.trim();

  const payload = {
    parent: { database_id: notionDbId },
    properties: {
      "Title": { title: [{ text: { content: capture.word } }] },
      "URL": { url: capture.url },
      "Summary": { rich_text: [{ text: { content: enriched.definition.substring(0, 2000) } }] },
      "Markdown": { rich_text: [{ text: { content: markdownContent.substring(0, 2000) } }] },
      "Created": { date: { start: new Date().toISOString() } }
    }
  };

  console.log("[Notion API Call] POST /v1/pages (Database Entry)");
  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${notionToken}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("[Notion Error]", data);
    throw new Error(data.message || "Failed to save to database");
  }

  console.log(`[Notion Success] Database Row Created: ${data.id}`);
  console.log(`[Markdown Preview] Length: ${markdownContent.length} chars\n${markdownContent.substring(0, 100)}...`);
  
  return data.id;
}

async function fetchDatabaseRow(rowId) {
  const { notionToken } = await chrome.storage.local.get("notionToken");
  console.log(`[Notion API Call] GET /v1/pages/${rowId}`);
  
  const res = await fetch(`https://api.notion.com/v1/pages/${rowId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${notionToken}`,
      "Notion-Version": NOTION_VERSION
    }
  });

  const data = await res.json();
  if (!res.ok) throw new Error("Failed to fetch database row");
  return data;
}

async function generatePageFromDatabase(rowId) {
  const { notionToken, notionParentPageId } = await chrome.storage.local.get(["notionToken", "notionParentPageId"]);
  if (!notionToken || !notionParentPageId) throw new Error("Missing Parent Page ID for generation");

  const row = await fetchDatabaseRow(rowId);
  const title = row.properties.Title.title[0].plain_text;
  const markdown = row.properties.Markdown.rich_text[0].plain_text;

  console.log(`[Notion] Generating standalone page for: "${title}" under folder ${notionParentPageId}`);

  const payload = {
    parent: { page_id: notionParentPageId },
    properties: {
      title: [{ text: { content: title } }]
    },
    children: [
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ text: { content: markdown } }]
        }
      }
    ]
  };

  console.log("[Notion API Call] POST /v1/pages (Standalone Page)");
  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${notionToken}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("[Notion Error]", data);
    throw new Error("Failed to generate standalone page");
  }

  console.log(`[Notion Success] Page Generated: ${data.id}`);
  console.log(`[URL]: ${data.url}`);
  
  return { id: data.id, url: data.url };
}

// 4. Main Loop
async function processCapture(capture) {
  try {
    const enriched = await callGemini(capture.word, capture.context);
    
    // Save to Database
    const rowId = await saveToDatabase(capture, enriched);
    
    // Auto-generate page (Simulation requirement)
    const page = await generatePageFromDatabase(rowId);

    console.log("--- FINAL SUMMARY ---");
    console.log(`Database row created with ID: ${rowId}`);
    console.log(`Generated page created with ID: ${page.id} and URL: ${page.url}`);
    console.log("----------------------");

    const data = await chrome.storage.local.get(["queue", "recent"]);
    const newQueue = (data.queue || []).filter(item => item.timestamp !== capture.timestamp);
    const newRecent = [capture, ...(data.recent || [])].slice(0, 10);
    await chrome.storage.local.set({ queue: newQueue, recent: newRecent });
  } catch (err) {
    console.error("[Process Error]:", err.message);
  }
}

// 5. Simulation Trigger
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "runSimulation") {
    const examples = [
      { word: "The Future of AI in Web Development", url: "https://www.notion.so/The-Future-of-AI-in-Web-Development-31ef940a41268028bb70d53a1c1dcd5e?pvs=21", context: "AI is reshaping how we build and maintain design systems." },
      { word: "Getting Started with Notion API", url: "https://www.notion.so/Getting-Started-with-Notion-API-31ef940a41268016a385d000f8788279?pvs=21", context: "The Notion API allows for powerful integrations with external tools." }
    ];
    
    examples.forEach(ex => processCapture(ex));
    sendResponse({ status: "Simulations started" });
  }
  return true;
});
