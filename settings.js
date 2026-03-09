document.addEventListener('DOMContentLoaded', () => {
  const fields = ['geminiKey', 'notionToken', 'notionClientId', 'notionClientSecret', 'notionRedirectUri', 'notionDbId', 'notionParentPageId'];
  const saveBtn = document.getElementById('saveBtn');
  const authBtn = document.getElementById('authBtn');
  const exchangeBtn = document.getElementById('exchangeBtn');
  const saveStatus = document.getElementById('saveStatus');
  const tokenStatus = document.getElementById('tokenStatus');
  const NOTION_VERSION = "2025-09-03";

  // Load existing keys
  chrome.storage.local.get(fields, (data) => {
    fields.forEach(f => {
      const el = document.getElementById(f);
      if (el && data[f]) el.value = data[f];
    });
    if (data.notionToken) {
      tokenStatus.textContent = 'Connected (OAuth Token Stored)';
      tokenStatus.style.color = '#48bb78';
    }
  });

  saveBtn.addEventListener('click', () => {
    const vals = {};
    fields.forEach(f => {
      const el = document.getElementById(f);
      if (el) vals[f] = el.value.trim();
    });

    chrome.storage.local.set(vals, () => {
      saveStatus.textContent = 'Settings saved!';
      setTimeout(() => { saveStatus.textContent = ''; }, 3000);
    });
  });

  // OAuth Step 1: Redirect to Authorize
  authBtn.addEventListener('click', () => {
    const clientId = document.getElementById('notionClientId').value;
    const redirectUri = document.getElementById('notionRedirectUri').value;
    const authUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.open(authUrl, '_blank');
  });

  // OAuth Step 2: Exchange Code for Access Token
  exchangeBtn.addEventListener('click', async () => {
    const clientId = document.getElementById('notionClientId').value;
    const clientSecret = document.getElementById('notionClientSecret').value;
    const redirectUri = document.getElementById('notionRedirectUri').value;
    const code = document.getElementById('notionAuthCode').value.trim();

    if (!clientId || !clientSecret || !code) {
      alert('Missing Client ID, Secret, or Auth Code.');
      return;
    }

    exchangeBtn.textContent = 'Exchanging...';

    try {
      // Per Notion Docs, we must use Basic Auth for the token endpoint
      const basicAuth = btoa(`${clientId}:${clientSecret}`);
      
      const res = await fetch('https://api.notion.com/v1/oauth/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri
        })
      });

      const data = await res.json();

      if (res.ok) {
        const token = data.access_token;
        chrome.storage.local.set({ notionToken: token }, () => {
          tokenStatus.textContent = 'Connected (OAuth Token Stored)';
          tokenStatus.style.color = '#48bb78';
          exchangeBtn.textContent = 'Token Saved ✓';
          console.log('[OAuth Success] Access Token successfully stored.');
        });
      } else {
        throw new Error(data.error_description || data.error || 'Token Exchange Failed');
      }
    } catch (e) {
      console.error('[OAuth Error]', e);
      alert(`Error: ${e.message}`);
      exchangeBtn.textContent = 'Retry Exchange';
    }
  });

  // Test API Connections
  document.getElementById('testNotion').addEventListener('click', async () => {
    const { notionToken } = await chrome.storage.local.get("notionToken");
    const dbId = document.getElementById('notionDbId').value;
    const pageId = document.getElementById('notionParentPageId').value;
    const btn = document.getElementById('testNotion');

    if (!notionToken) {
      alert('No access token found. Complete Step 1 and 2.');
      return;
    }

    btn.textContent = 'Testing Token...';
    try {
      const dbRes = await fetch(`https://api.notion.com/v1/databases/${dbId}`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${notionToken}`, 
          'Notion-Version': NOTION_VERSION 
        }
      });
      
      const pgRes = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${notionToken}`, 
          'Notion-Version': NOTION_VERSION 
        }
      });

      if (dbRes.ok && pgRes.ok) {
        btn.textContent = 'All Access OK ✓';
        btn.style.backgroundColor = '#48bb78';
      } else {
        throw new Error(`DB Status: ${dbRes.status}, Page Status: ${pgRes.status}`);
      }
    } catch (e) {
      console.error(e);
      btn.textContent = 'Access Error ✗';
      btn.style.backgroundColor = '#f56565';
    }
  });

  // Simulation Trigger
  document.getElementById('runSimulation').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'runSimulation' });
    alert('Simulation triggered.');
  });
});
