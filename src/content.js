async function loadImpulseBuffer(ctx) {
    // load impulse response from file

    const pathToImpulse = 'impulses/villetou_small_room_filtered.wav'
    let url = ''

    if (typeof browser !== 'undefined') {
        url = browser.runtime.getURL(pathToImpulse)
    } else if (typeof chrome !== 'undefined') {
        url = chrome.runtime.getURL(pathToImpulse)
    }

    const response = await fetch(url)
    const arraybuffer = await response.arrayBuffer()
    return await ctx.decodeAudioData(arraybuffer)
}

async function createReverbAudioChain(ctx) {
    // Create dry signal chain
    const dry = ctx.createGain()
    dry.connect(ctx.destination)

    // Create parallel chain for distant chatter effect
    // Input gain -> Reverb -> Output

    const wetInput = ctx.createGain()
    wetInput.gain.value = 0.5

    const wet = ctx.createGain()

    // TODO: Make this configurable from a settings popup
    const useReverb = true

    if (useReverb) {
        const reverb = ctx.createConvolver()
        reverb.buffer = await loadImpulseBuffer(ctx)

        // Connect effect chain to output
        wetInput.connect(reverb).connect(wet).connect(ctx.destination)
    } else {
        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 1400

        // Connect effect chain to output
        wetInput.connect(filter).connect(wet).connect(ctx.destination)
    }

    return {
        ctx: ctx,
        connect: (srcNode) => {
            srcNode.connect(dry)
            srcNode.connect(wetInput)
        },
        disconnect: (srcNode) => {
            srcNode.disconnect(dry)
            srcNode.disconnect(wetInput)
        },
        toBack: (time) => {
            wet.gain.linearRampToValueAtTime(1.0, ctx.currentTime + time)
            dry.gain.linearRampToValueAtTime(0.0, ctx.currentTime + time)
        },
        toFront: (time) => {
            wet.gain.linearRampToValueAtTime(0.0, ctx.currentTime + time)
            dry.gain.linearRampToValueAtTime(1.0, ctx.currentTime + time)
        },
    }
}

function handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
        // Tab unfocused, take audio to back
        audioChain.toBack(1.5)
    } else {
        // Tab focused, bring audio to front
        audioChain.toFront(1.5)
    }
}

async function enableEffect(audioChain) {
    if (!document.querySelector('[aria-label="Leave call"]')) return null

    console.log('Enabling background chatter effect')

    ctx.resume().then(function () {
        console.log("Effect chain's audio context resumed")
    })

    audioChain.toFront(1.0)
    document.addEventListener('visibilitychange', handleVisibilityChange, false)

    const audioElements = document.getElementsByTagName('audio')

    return Array.from(audioElements).map((audioElement) => {
        node = audioChain.ctx.createMediaStreamSource(audioElement.srcObject)
        audioChain.connect(node)
        audioElement.muted = true
        audioElement.volume = 0
        audioElement.pause()

        return node
    })
}

async function disableEffect(audioChain, sources) {
    console.log('Disabling background chatter effect')

    audioChain.toFront(1.0)
    document.removeEventListener('visibilitychange', handleVisibilityChange, false)

    if (sources && sources.length) {
        sources &&
            sources.map((audioElement) => {
                audioChain.disconnect(audioElement)
            })
    }

    const audioElements = document.getElementsByTagName('audio')

    ctx.suspend().then(function () {
        console.log("Effect chain's audio context suspended")
    })

    Array.from(audioElements).forEach((audioElement) => {
        audioElement.muted = false
        audioElement.volume = 1.0
        audioElement.play()
    })
}

async function injectButton() {
    // Inject css
    const injectStyle = document.createElement('style')
    injectStyle.innerHTML = `
        .bg-chatter-button-image-container {
            overflow: show;
            width:24px;height:24px;
        }
        .bg-chatter-button-image {
            height: 24px;
            width: 24px;
        }
        .bg-chatter-show-enabled,
        .bg-chatter-show-disabled {
            display: none;
        }

        .bg-chatter-enabled .bg-chatter-show-enabled,
        .bg-chatter-disabled .bg-chatter-show-disabled
        {
            display: block;
        }
    `
    document.head.append(injectStyle)

    // Inject html
    const url = chrome.runtime.getURL('templates/button.html')
    const iconOffSrc = chrome.runtime.getURL('icons/icon-off-128.png')
    const iconOnSrc = chrome.runtime.getURL('icons/icon-128.png')
    const template = await fetch(url)
    const inject = document.createElement('div')
    let templateText = await template.text()

    templateText = templateText.replace('${imgOffSrc}', iconOffSrc)
    templateText = templateText.replace('${imgOnSrc}', iconOnSrc)

    inject.innerHTML = templateText
    const dividers = document.getElementsByClassName('qO3Z3c')
    if (dividers[0]) {
        dividers[0].parentElement.replaceChild(inject, dividers[0])
    }

    // Inject event listeners
    const button = document.getElementById('bg-chatter-button')

    button.addEventListener(
        'click',
        function () {
            chrome.runtime.sendMessage({
                action: 'REQUEST_CONTENT_STATE_UPDATE',
                state: { enabled: !extensionState.enabled },
            })
        },
        false
    )

    chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
        // Should listen to 'CONTENT_STATE_UPDATED' but it doesn't seem to come through to the tabs
        if (msg.action === 'SET_TAB_STATE') {
            const buttonCtrl = document.getElementById('bg-chatter-button-ctrl')

            if (buttonCtrl && msg.state.enabled === true) {
                buttonCtrl.className = 'bg-chatter-enabled'
            } else if (buttonCtrl && msg.state.enabled === false) {
                buttonCtrl.className = 'bg-chatter-disabled'
            }
        }
    })
}

async function injectButtonLoop() {
    // #lcsclient Seems to load after the buttons are rendered
    if (document.getElementsByClassName('NzPR9b').length > 0) {
        injectButton()
    } else {
        setTimeout(injectButtonLoop, 1000)
    }
}

// Global objects
let ctx
let audioChain
let extensionState = {
    enabled: false,
}

async function runExtension() {
    // Initialize global objects
    ctx = new AudioContext()
    audioChain = await createReverbAudioChain(ctx)
    ctx.suspend().then(function () {
        console.log("Effect chain's audio context suspended by default")
    })

    // App state
    let sources = []

    // TODO: Make async? -> check docs how msg listening and sendResponse behaves when async
    function applyNewState({ enabled }) {
        enabled
            ? enableEffect(audioChain).then(function (nodes) {
                  sources = nodes
                  if (nodes && nodes.length > 0) {
                      extensionState = {
                          enabled: true,
                      }
                  }
              })
            : disableEffect(audioChain, sources).then(function () {
                  sources = []
                  extensionState = {
                      enabled: false,
                  }
              })
    }

    chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
        if (sender.tab) return

        switch (msg.action) {
            default:
                break
            case 'GET_TAB_STATE':
                sendResponse({ ...extensionState })
                break
            case 'SET_TAB_STATE':
                applyNewState(msg.state)
                chrome.runtime.sendMessage({
                    action: 'CONTENT_STATE_UPDATED',
                    state: msg.state,
                })
                break
        }
    })

    chrome.runtime.sendMessage({ action: 'CONTENT_SCRIPT_LOADED' })
    injectButtonLoop()
}

runExtension()
