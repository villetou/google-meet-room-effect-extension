const icons = {
    enabled: {
        24: 'icons/icon-24.png',
        48: 'icons/icon-48.png',
        64: 'icons/icon-64.png',
        128: 'icons/icon-128.png',
        256: 'icons/icon-256.png',
    },
    disabled: {
        24: 'icons/icon-off-24.png',
        48: 'icons/icon-off-48.png',
        64: 'icons/icon-off-64.png',
        128: 'icons/icon-off-128.png',
        256: 'icons/icon-off-256.png',
    },
}

function onMessage(msg, sender) {
    switch (msg.action) {
        default:
            break
        case 'CONTENT_SCRIPT_LOADED': {
            chrome.pageAction.show(sender.tab.id)
            chrome.pageAction.setPopup({
                tabId: sender.tab.id,
                popup: 'popup/settings.html',
            })
        }
        case 'CONTENT_STATE_UPDATED': {
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
        }
    }
}

chrome.runtime.onMessage.addListener(onMessage)
