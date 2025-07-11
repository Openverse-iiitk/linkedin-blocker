document.addEventListener("DOMContentLoaded", function () {
    // check the stored API key when popup opens
    chrome.storage.sync.get("groqApiKey", function (data) {
        const errorCard = document.querySelector(".error-card");

        if (data.groqApiKey) {
            errorCard.style.display = "none";
        }
    });

    // toggle switch for feed filter
    const toggleSwitch = document.getElementById("toggle-switch");

    // Load initial state from Chrome storage
    chrome.storage.sync.get("isEnabled", function (data) {
        toggleSwitch.checked = data.isEnabled ?? false; // Default to false
    });

    // Listen for toggle changes
    toggleSwitch.addEventListener("change", function () {
        chrome.storage.sync.set({ isEnabled: toggleSwitch.checked });
        
        // Send message to content script to update settings
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "settingsUpdated" });
        });
    });

    // Load and display stats
    chrome.storage.sync.get(["cringeCount", "timeSavedInMinutes"], function (data) {
        document.getElementById("cringe-count").innerText = data.cringeCount || 0;
        document.getElementById("time-saved").innerText = Math.ceil(data.timeSavedInMinutes || 0) + "m";
    });

    // Load filter mode setting
    chrome.storage.sync.get("filterMode", function (data) {
        const filterMode = data.filterMode || "blur"; // Default to blur if not set
        const toggleSlider = document.querySelector('.toggle-slider');

        if (filterMode === "remove") {
            toggleSlider.classList.add('remove');
            toggleSlider.classList.remove('blur');
            document.getElementById('mode-description').textContent =
                "💥 Vanish cringe completely";
        } else {
            toggleSlider.classList.add('blur');
            toggleSlider.classList.remove('remove');
            document.getElementById('mode-description').textContent =
                "🌫️ Blurs cringe until you decide";
        }
    });

    // Listen for filter mode changes
    const toggleSlider = document.querySelector('.toggle-slider');
    toggleSlider.addEventListener('click', function () {
        const currentMode = this.classList.contains('blur') ? 'blur' : 'remove';
        const newMode = currentMode === 'blur' ? 'remove' : 'blur';

        this.classList.remove(currentMode);
        this.classList.add(newMode);

        // Update description
        if (newMode === 'remove') {
            document.getElementById('mode-description').textContent =
                "💥 Vanish cringe completely";
        } else {
            document.getElementById('mode-description').textContent =
                "🌫️ Blurs cringe until you decide";
        }

        chrome.storage.sync.set({ filterMode: newMode });
        
        // Send message to content script to update settings
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "settingsUpdated" });
        });
        
        console.log(`Filter mode changed to: ${newMode}`);
    });

    // take user to the settings page
    const settingsButton = document.querySelector('.settings-icon');
    settingsButton.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    document.getElementById('setup-api-btn')?.addEventListener('click', () => {
        chrome.runtime.openOptionsPage(); // or window.open('settings.html')
    });
});