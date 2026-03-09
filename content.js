// Listen for selection changes or context menu requests
// In MV3, we can get selection directly from the contextMenus API in background.js
// But we use content.js to capture surrounding context for better AI explanations

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCaptureContext') {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const word = selection.toString().trim();
      
      if (!word) {
        sendResponse(null);
        return;
      }

      // Find the closest meaningful container (paragraph, div, section, etc.)
      let container = range.commonAncestorContainer;
      if (container.nodeType === Node.TEXT_NODE) {
        container = container.parentElement;
      }
      
      // Grab text around the selection
      // We take the innerText of the parent container as context
      const context = container.innerText || container.textContent || "";
      
      sendResponse({
        word: word,
        context: context.substring(0, 2000), // Grab up to 2000 chars
        url: window.location.href,
        title: document.title
      });
    } else {
      sendResponse(null);
    }
  }
  return true;
});
