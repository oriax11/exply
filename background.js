// Notion AI Note Capture - Background Service Worker

// 1. Initialize Context Menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "captureAndExplain",
      title: "Capture & Explain",
      contexts: ["selection"],
    });
  });

  // Initialize storage if empty
  chrome.storage.local.get(["queue", "recent"], (data) => {
    if (!data.queue) chrome.storage.local.set({ queue: [] });
    if (!data.recent) chrome.storage.local.set({ recent: [] });
  });
});

// 2. Handle Context Menu Click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "captureAndExplain") {
    captureFlow(tab.id);
  }
});

async function captureFlow(tabId) {
  try {
    // Request full context from content script
    const pageData = await chrome.tabs.sendMessage(tabId, {
      action: "getCaptureContext",
    });
    if (!pageData || !pageData.word) return;

    // Add to queue
    const capture = {
      ...pageData,
      timestamp: Date.now(),
      status: "pending",
    };

    await addToQueue(capture);

    // Attempt processing immediately
    processCapture(capture);
  } catch (err) {
    console.error("Capture failed", err);
  }
}

async function addToQueue(item) {
  const data = await chrome.storage.local.get("queue");
  const queue = data.queue || [];
  queue.push(item);
  await chrome.storage.local.set({ queue });
}

// 3. AI Enrichment (Gemini)
async function callGemini(word, context) {
  const { geminiKey } = await chrome.storage.local.get("geminiKey");
  if (!geminiKey) throw new Error("Missing Gemini Key");

  const prompt = `
    Explain the following word/concept found in this context:
    Word: "${word}"
    Context: "${context}"
    
    Provide a learning-focused explanation in JSON format with these exact keys:
    - definition: concise definition
    - why_it_matters: significance of this concept
    - example: a practical example
    - related_concepts: array of 3 related terms
    - difficulty: number 1-5
    - study_tip: one short tip for remembering this
    
    Keep the total response under 300 words. JSON only.
  `;

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            response_mime_type: "application/json",
            thinking_config: {
              include_thoughts: false,
              thinking_budget: -1, // Dynamic thinking for better reasoning
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(
        err.error?.message ||
          `Gemini API Call Failed with status ${response.status}`
      );
    }

    const data = await response.json();

    if (data.promptFeedback?.blockReason) {
      throw new Error(
        `Gemini blocked the prompt: ${data.promptFeedback.blockReason}`
      );
    }

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("Gemini returned no candidates.");
    }

    const candidate = data.candidates[0];
    if (
      candidate.finishReason !== "STOP" &&
      candidate.finishReason !== "MAX_TOKENS"
    ) {
      throw new Error(`Gemini finished with reason: ${candidate.finishReason}`);
    }

    if (
      !candidate.content ||
      !candidate.content.parts ||
      candidate.content.parts.length === 0
    ) {
      throw new Error("Invalid content structure in Gemini response.");
    }

    // Filter parts to find the text part (ignoring thoughts if they were returned)
    const textPart = candidate.content.parts.find((p) => p.text);
    if (!textPart) {
      throw new Error("No text content found in Gemini response.");
    }

    let textResponse = textPart.text;

    // Clean up markdown code blocks if present
    if (textResponse.includes("```json")) {
      textResponse = textResponse
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
    }

    return JSON.parse(textResponse);
  } catch (err) {
    console.error("Gemini Error:", err);
    throw err;
  }
}

// 4. Save to Notion
async function saveToNotion(capture, enriched) {
  const { notionToken, notionPageId } = await chrome.storage.local.get([
    "notionToken",
    "notionPageId",
  ]);
  if (!notionToken || !notionPageId)
    throw new Error("Missing Notion credentials");

  const notionData = {
    parent: { page_id: notionPageId },
    properties: {
      title: [
        {
          text: {
            content: capture.word,
          },
        },
      ],
    },
    children: [
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            { text: { content: `Definition: ${enriched.definition}` } },
          ],
        },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            { text: { content: `Why It Matters: ${enriched.why_it_matters}` } },
          ],
        },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ text: { content: `Example: ${enriched.example}` } }],
        },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              text: {
                content: `Related Concepts: ${enriched.related_concepts.join(
                  ", "
                )}`,
              },
            },
          ],
        },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ text: { content: `Source URL: ${capture.url}` } }],
        },
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              text: {
                content: `Original Context: ${capture.context.substring(
                  0,
                  2000
                )}`,
              },
            },
          ],
        },
      },
    ],
  };

  const response = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${notionToken}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify(notionData),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || "Notion Save Failed");
  }
}

// 5. Main Processing Loop
async function processCapture(capture) {
  try {
    const enriched = await callGemini(capture.word, capture.context);
    await saveToNotion(capture, enriched);

    // Move from queue to recent
    const data = await chrome.storage.local.get(["queue", "recent"]);
    const newQueue = (data.queue || []).filter(
      (item) => item.timestamp !== capture.timestamp
    );
    const newRecent = [capture, ...(data.recent || [])].slice(0, 10);

    await chrome.storage.local.set({ queue: newQueue, recent: newRecent });

    console.log(`Successfully captured and saved: ${capture.word}`);
  } catch (err) {
    console.error("Process failed", err);
    // Keep in queue but mark as failed? For now, we just leave it for manual sync
  }
}

// Listener for manual sync from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "processQueue") {
    chrome.storage.local.get("queue", async (data) => {
      const queue = data.queue || [];
      for (const item of queue) {
        await processCapture(item);
      }
      sendResponse({ status: "done" });
    });
    return true;
  }
});
