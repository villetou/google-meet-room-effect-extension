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

    sendMessageToCurrentTab(
        { action: 'SET_TAB_STATE', state },
        function (newState) {
            onTabStateUpdate(newState)
        }
    )
}

function onTabStateUpdate(state) {
    document.getElementById('enabled').checked = state.enabled
}

function enableUI() {
    document.getElementById('enabled').disabled = false
}

// Initial load -> fetch state, update and enable UI, add event listeners
document.addEventListener('DOMContentLoaded', function () {
    sendMessageToCurrentTab({ action: 'GET_TAB_STATE' }, function (state) {
        onTabStateUpdate(state)
        enableUI()
    })

    document
        .getElementById('enabled')
        .addEventListener('change', sendStateUpdate)
})
