# Feed filter: Your AI Shield for a Better LinkedIn Feed 🛡️

Tired of wading through a sea of humble-brags, unrelated emotional stories, and engagement-bait on LinkedIn? **Feed filter** is here to reclaim your feed! 

It's a smart Chrome extension that uses the power of AI to automatically detect and filter out low-value, cringey, and unprofessional posts, leaving you with a cleaner, more focused, and genuinely valuable professional network.

![View Counter](https://shields.io/badge/views-132-blue?style=for-the-badge)
![Download Counter](https://shields.io/badge/downloads-20-green?style=for-the-badge)
![Feed filter Demo](images/icon.png)

## 🧩 How to Install the Extension from Source (Unpacked)

1. [Download the ZIP directly](https://github.com/manvith12/linkedin-blocker/archive/refs/tags/v1.0.0.zip).
2. Extract the ZIP file to a folder on your system.
3. Open `chrome://extensions/` in your Chromium-based browser (Chrome, Edge, Brave, etc.).
4. **Enable "Developer mode"** (toggle in the top right corner).
5. Click **"Load unpacked"** and select the extracted folder.
6. The extension will now be installed and active.

✅ No `.crx` needed — full control with source installation.

## ✨ Key Features

*   🧠 **AI-Powered Filtering:** Uses a powerful AI model (via the Groq API) to analyze post content in real-time and decide if it's worth your time.
*   😎 **Two Powerful Modes:** Choose how you want to handle the cringe.
    *   **🌫️ Blur Mode:** Hides cringe posts behind a tasteful blur. You can still click to view if curiosity gets the best of you.
    *   **💥 Vanish Mode:** Makes cringe posts disappear completely from your feed, as if they never existed.
*   📊 **Track Your Sanity:** The popup shows you how many cringe posts you've dodged and an estimate of the time you've saved.
*   🎨 **Sleek, Modern UI:** A beautiful, intuitive interface with smooth animations, glassmorphism effects, and cool gradients. It's a pleasure to use!
*   🔒 **Privacy First:** Your Groq API key is stored securely and only on your local machine using Chrome's storage. We don't collect or have access to any of your data. Period.

## ⚙️ How It Works

Feed filter works by observing your LinkedIn feed as you scroll.

1.  When new posts appear, the extension grabs the text content.
2.  It sends this text to the Groq AI API for analysis against a carefully crafted set of "cringe criteria".
3.  If the AI flags a post as cringe, the extension either **blurs** it or **removes** it from the page, depending on the mode you've selected.
4.  All of this happens in a fraction of a second, creating a seamless and clean browsing experience.

## 🚀 Installation & Setup

You can get Feed filter running in just a few minutes.

### 1. Load the Extension

1.  **Get the Code:** Download this repository as a ZIP file and unzip it, or clone it using `git clone`.
2.  **Open Chrome Extensions:** Open Google Chrome and navigate to `chrome://extensions`.
3.  **Enable Developer Mode:** Find the "Developer mode" toggle in the top-right corner and switch it **on**.
4.  **Load the Extension:** Click the **Load unpacked** button and select the `linkedin-blocker` folder (the one containing `manifest.json`). The Feed filter icon should now appear in your Chrome toolbar.

### 2. Configure the API Key

Feed filter needs an API key from [**Groq**](https://console.groq.com/keys) to work its magic. They offer a generous free tier that is more than enough for personal use.

1.  **Get a Groq API Key:** Sign up or log in to Groq and create a new API key.
2.  **Open Settings:** Click on the Feed filter icon in your Chrome toolbar, then click the **gear (⚙️) icon** to open the settings page.
3.  **Save Your Key:** Paste your Groq API key into the input field and click "Save". You're all set!

## 📖 How to Use

Using Feed filter is simple:

*   **Main Toggle:** Click the Feed filter icon in your toolbar to open the popup. Use the main toggle to turn the filter on or off at any time.
*   **Switch Modes:** Click the slider in the popup to instantly switch between "Blur" and "Vanish" modes.
*   **View Stats:** The popup shows you real-time stats on dodged posts and time saved.
*   **Go to LinkedIn:** Navigate to your [LinkedIn feed](https://www.linkedin.com/feed/) and watch the magic happen! The extension will start filtering posts automatically.


## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
