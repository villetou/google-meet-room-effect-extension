function sendMessageToCurrentTab(msg, callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const currTab = tabs[0]
        if (currTab) {
            chrome.tabs.sendMessage(currTab.id, msg, callback)
        }
    })
}

// Saves options to chrome.storage
function sendStateUpdate() {
    const state = {
        enabled: document.getElementById('enabled').checked,
    }

    sendMessageToCurrentTab(
        { action: 'SET_TAB_STATE', state },
        function (newState) {
            onTabStateUpdate(newState)
        }
    )

    //   chrome.storage.local.set({ enabled }, function () {
    //     console.log("saved state: ", enabled);
    //   });
}

function onTabStateUpdate(state) {
    document.getElementById('enabled').checked = state.enabled
    //   chrome.storage.local.get(["enabled"], function (items) {
    //     document.getElementById("enabled").checked = items.enabled;
    //   });
}

function enableUI() {
    document.getElementById('enabled').disabled = false
}

document.addEventListener('DOMContentLoaded', function () {
    // Initial load -> fetch state, update and enable UI
    sendMessageToCurrentTab({ action: 'GET_TAB_STATE' }, function (state) {
        onTabStateUpdate(state)
        enableUI()
    })

    // Add event listeners
    document
        .getElementById('enabled')
        .addEventListener('change', sendStateUpdate)
})
