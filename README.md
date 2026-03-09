# Notion AI Note Capture (Vibe Coded) 🚀

**⚠️ DISCLAIMER: This project is vibe coded. It is for testing purposes only and is not a serious project.**

This is a Chrome Extension designed to capture concepts from the web, enrich them using the **Gemini 2.5 Flash** reasoning model, and sync them to a **Notion** workspace using the latest **OAuth 2.0** flow and **2025-09-03** API architecture.

## Features
- **Capture & Explain:** Right-click any text to send it to the AI for a professional design-system-focused explanation.
- **Gemini 2.5 Flash:** Utilizes the latest reasoning models with thinking capabilities for deep concept analysis.
- **Architecture 2026:** Implements a dual-layer Notion sync:
  1.  **Database Entry:** Logs the capture in a "Design System Best Practices 2026" database.
  2.  **Page Generation:** Automatically generates a clean, standalone page in a specific folder.
- **OAuth 2.0:** Secure authentication with Notion (Public Integration flow).
- **Simulation Mode:** Built-in test suite to verify the entire pipeline without manual browsing.

## Setup
1.  **AI:** Get a Gemini API Key from [Google AI Studio](https://aistudio.google.com).
2.  **Notion:**
    - Create a Public Integration at [Notion Integrations](https://www.notion.so/my-integrations).
    - Use the Client ID and Client Secret in the extension settings.
    - Set the redirect URI to `https://exply.`.
    - Complete the OAuth handshake in the extension settings page.
3.  **Configure:** Provide your Database ID and Parent Page ID in the settings.

## Note
This project was built to test the boundaries of AI-driven development and Notion's 2026 API standards. Use at your own risk, and remember: it's all about the vibes.
