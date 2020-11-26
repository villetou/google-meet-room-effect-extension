
function onMessage(msg, sender, sendResponse) {
    console.log(sender)
    console.log("received message!", msg)

    if (msg.action === 'CONTENT_SCRIPT_LOADED') {
        chrome.pageAction.show(sender.tab.id)
    }
}

chrome.runtime.onMessage.addListener(onMessage);

chrome.pageAction.onClicked.addListener(function(tab) {
    chrome.tabs.sendMessage(tab.id, {action: 'TOGGLE_EXTENSION'});
});