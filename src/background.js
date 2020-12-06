const icons = {
    enabled: {
        16: 'icons/icon-16.png',
        24: 'icons/icon-24.png',
        32: 'icons/icon-32.png',
        48: 'icons/icon-48.png',
        64: 'icons/icon-64.png',
        128: 'icons/icon-128.png',
        256: 'icons/icon-256.png',
    },
    disabled: {
        16: 'icons/icon-off-16.png',
        24: 'icons/icon-off-24.png',
        32: 'icons/icon-off-32.png',
        48: 'icons/icon-off-48.png',
        64: 'icons/icon-off-64.png',
        128: 'icons/icon-off-128.png',
        256: 'icons/icon-off-256.png',
    },
}

function onMessage(msg, sender, sendResponse) {
    switch (msg.action) {
        default:
            break
        case 'CONTENT_SCRIPT_LOADED':
            chrome.pageAction.show(sender.tab.id)
            chrome.pageAction.setPopup({
                tabId: sender.tab.id,
                popup: 'popup/settings.html',
            })
            break
        case 'REQUEST_CONTENT_STATE_UPDATE':
            if (!msg.state || typeof msg.state.enabled === 'undefined') return

            const tabId = sender && sender.tab ? sender.tab.id : msg.tabId

            if (tabId) {
                chrome.tabs.sendMessage(tabId, {
                    action: 'SET_TAB_STATE',
                    state: msg.state,
                })
            }
            break
        case 'CONTENT_STATE_UPDATED':
            if (!msg.state || typeof msg.state.enabled === 'undefined') return

            msg.state.enabled
                ? chrome.pageAction.setIcon({
                      tabId: sender.tab.id,
                      path: icons.enabled,
                  })
                : chrome.pageAction.setIcon({
                      tabId: sender.tab.id,
                      path: icons.disabled,
                  })
            break
        case 'GET_TAB_STATE':
            sendResponse(sender.tab.id)
            break
    }
}

chrome.runtime.onMessage.addListener(onMessage)
