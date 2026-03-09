document.addEventListener('DOMContentLoaded', () => {
  const fields = ['geminiKey', 'notionToken', 'notionDbId', 'notionParentPageId'];
  const saveBtn = document.getElementById('saveBtn');
  const saveStatus = document.getElementById('saveStatus');
  const NOTION_VERSION = "2025-09-03";

  // Load existing keys
  chrome.storage.local.get(fields, (data) => {
    fields.forEach(f => {
      if (data[f]) document.getElementById(f).value = data[f];
    });
  });

  saveBtn.addEventListener('click', () => {
    const vals = {};
    fields.forEach(f => {
      vals[f] = document.getElementById(f).value.trim();
    });

    chrome.storage.local.set(vals, () => {
      saveStatus.textContent = 'Settings saved!';
      setTimeout(() => { saveStatus.textContent = ''; }, 3000);
    });
  });

  // Simulation Trigger
  document.getElementById('runSimulation').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'runSimulation' }, (res) => {
      alert('Simulation started. Check Background Console for logs.');
    });
  });

  // Test Gemini
  document.getElementById('testGemini').addEventListener('click', async () => {
    const key = document.getElementById('geminiKey').value;
    const btn = document.getElementById('testGemini');
    btn.textContent = 'Testing...';
    
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-goog-api-key': key
        },
        body: JSON.stringify({ 
          contents: [{ parts: [{ text: "hi" }] }],
          generationConfig: { 
            response_mime_type: "application/json",
            thinking_config: { include_thoughts: false, thinking_budget: 0 }
          }
        })
      });
      if (res.ok) {
        btn.textContent = 'Connection OK ✓';
        btn.style.backgroundColor = '#48bb78';
      } else {
        throw new Error('Failed');
      }
    } catch (e) {
      btn.textContent = 'Error ✗';
      btn.style.backgroundColor = '#f56565';
    }
    setTimeout(() => { btn.textContent = 'Test Gemini'; btn.style.backgroundColor = ''; }, 3000);
  });

  // Test Notion
  document.getElementById('testNotion').addEventListener('click', async () => {
    const token = document.getElementById('notionToken').value;
    const dbId = document.getElementById('notionDbId').value;
    const pageId = document.getElementById('notionParentPageId').value;
    const btn = document.getElementById('testNotion');
    btn.textContent = 'Testing...';
    
    try {
      // Test DB
      const dbRes = await fetch(`https://api.notion.com/v1/databases/${dbId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}`, 'Notion-Version': NOTION_VERSION }
      });
      
      // Test Page
      const pgRes = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}`, 'Notion-Version': NOTION_VERSION }
      });

      if (dbRes.ok && pgRes.ok) {
        btn.textContent = 'All Connections OK ✓';
        btn.style.backgroundColor = '#48bb78';
      } else {
        throw new Error(`DB: ${dbRes.status}, Page: ${pgRes.status}`);
      }
    } catch (e) {
      console.error(e);
      btn.textContent = 'Error ✗';
      btn.style.backgroundColor = '#f56565';
    }
    setTimeout(() => { btn.textContent = 'Test Notion Connections'; btn.style.backgroundColor = ''; }, 3000);
  });
});
