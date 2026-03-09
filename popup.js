document.addEventListener('DOMContentLoaded', () => {
  const geminiStatus = document.getElementById('geminiStatus');
  const notionStatus = document.getElementById('notionStatus');
  const queueCount = document.getElementById('queueCount');
  const recentList = document.getElementById('recentList');
  const settingsBtn = document.getElementById('settingsBtn');
  const syncBtn = document.getElementById('syncBtn');
  const clearBtn = document.getElementById('clearBtn');

  // Load state from storage
  function updateUI() {
    chrome.storage.local.get(['geminiKey', 'notionToken', 'notionPageId', 'queue', 'recent'], (data) => {
      // Check connection status (simple existence check for keys)
      if (data.geminiKey) {
        geminiStatus.classList.remove('offline');
        geminiStatus.classList.add('online');
      }
      if (data.notionToken && data.notionPageId) {
        notionStatus.classList.remove('offline');
        notionStatus.classList.add('online');
      }

      // Update queue count
      const queue = data.queue || [];
      queueCount.textContent = queue.length;

      // Update recent list
      const recent = data.recent || [];
      recentList.innerHTML = '';
      if (recent.length === 0) {
        recentList.innerHTML = '<li class="empty-msg">No recent captures yet.</li>';
      } else {
        recent.forEach(item => {
          const li = document.createElement('li');
          li.className = 'recent-item';
          li.innerHTML = `
            <span>${item.word}</span>
            <small style="color: #a0aec0">${new Date(item.timestamp).toLocaleTimeString()}</small>
          `;
          recentList.appendChild(li);
        });
      }
    });
  }

  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  syncBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'processQueue' }, () => {
      updateUI();
    });
  });

  clearBtn.addEventListener('click', () => {
    chrome.storage.local.set({ queue: [] }, () => {
      updateUI();
    });
  });

  updateUI();
  // Poll for updates if background script is working
  setInterval(updateUI, 2000);
});
