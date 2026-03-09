document.addEventListener('DOMContentLoaded', () => {
  const fields = ['geminiKey', 'notionToken', 'notionPageId', 'ollamaUrl'];
  const saveBtn = document.getElementById('saveBtn');
  const saveStatus = document.getElementById('saveStatus');

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
            thinking_config: {
              include_thoughts: false,
              thinking_budget: 0 // No thinking for simple test
            }
          }
        })
      });
      if (res.ok) {
        btn.textContent = 'Connection OK ✓';
        btn.style.backgroundColor = '#48bb78';
      } else {
        const err = await res.json();
        console.error('Gemini Test Error:', err);
        throw new Error('Failed');
      }
    } catch (e) {
      btn.textContent = 'Error ✗';
      btn.style.backgroundColor = '#f56565';
    }
    setTimeout(() => {
      btn.textContent = 'Test Gemini';
      btn.style.backgroundColor = '';
    }, 3000);
  });

  // Test Notion
  document.getElementById('testNotion').addEventListener('click', async () => {
    const token = document.getElementById('notionToken').value;
    const pageId = document.getElementById('notionPageId').value;
    const btn = document.getElementById('testNotion');
    btn.textContent = 'Testing...';
    
    try {
      const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Notion-Version': '2025-09-03'
        }
      });
      if (res.ok) {
        btn.textContent = 'Connection OK ✓';
        btn.style.backgroundColor = '#48bb78';
      } else {
        const err = await res.json();
        console.error('Notion Test Error:', err);
        throw new Error('Failed');
      }
    } catch (e) {
      btn.textContent = 'Error ✗';
      btn.style.backgroundColor = '#f56565';
    }
    setTimeout(() => {
      btn.textContent = 'Test Notion';
      btn.style.backgroundColor = '';
    }, 3000);
  });
});
