function sendMessageToCurrentTab(msg, callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const currTab = tabs[0]
        if (currTab) {
            chrome.tabs.sendMessage(currTab.id, msg, callback)
        }
    })
}

function sendStateUpdate() {
    const state = {
        enabled: document.getElementById('enabled').checked,
    }

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const currTab = tabs[0]
        if (currTab) {
            chrome.runtime.sendMessage({ action: 'REQUEST_CONTENT_STATE_UPDATE', tabId: currTab.id, state })
        }
    })
}

function onTabStateUpdate(state) {
    document.getElementById('enabled').checked = state.enabled
    document.body.className = state.enabled ? 'enabled' : 'disabled'
}

function enableUI() {
    document.getElementById('enabled').disabled = false
}

function onMessage(msg, sender, sendResponse) {
    switch (msg.action) {
        default:
            break
        case 'CONTENT_STATE_UPDATED':
            if (!msg.state || typeof msg.state.enabled === 'undefined') return

            onTabStateUpdate(msg.state)
            break
    }
}

// Initial load -> fetch state, update and enable UI, add event listeners
document.addEventListener('DOMContentLoaded', function () {
    sendMessageToCurrentTab({ action: 'GET_TAB_STATE' }, function (state) {
        onTabStateUpdate(state)
        enableUI()
    })

    document.getElementById('enabled').addEventListener('change', sendStateUpdate)

    chrome.runtime.onMessage.addListener(onMessage)
})
