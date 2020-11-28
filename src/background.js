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
    }
}

chrome.runtime.onMessage.addListener(onMessage)