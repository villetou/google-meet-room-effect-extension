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
    document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
        false
    )

    sources.map((audioElement) => {
        audioChain.disconnect(audioElement)
    })

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

// Global objects
let ctx
let audioChain

async function runExtension() {
    // Initialize global objects
    ctx = new AudioContext()
    audioChain = await createReverbAudioChain(ctx)

    ctx.suspend().then(function () {
        console.log("Effect chain's audio context suspended by default")
    })

    // App state
    let sources = []
    let extensionEnabled = false

    // TODO: Make async -> check docs how msg listening and sendResponse behaves when async...
    function receiveNewState({ enabled }) {
        enabled ?
            enableEffect(audioChain).then(function (nodes) {
                sources = nodes
                if (nodes.length > 0) {
                    extensionEnabled = true
                }
            }) :
            disableEffect(audioChain, sources).then(function () {
                sources = []
                extensionEnabled = false
            })
    }

    chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
        console.log(msg, sender)
        if (sender.tab) return

        switch (msg.action) {
            default:
                break
            case 'TOGGLE_EXTENSION': {

            }
            case 'GET_TAB_STATE': {
                sendResponse({ enabled: extensionEnabled })
            }
            case 'SET_TAB_STATE': {
                receiveNewState(msg.state)
                sendResponse(msg.state)
            }
        }
    })

    chrome.runtime.sendMessage({ action: 'CONTENT_SCRIPT_LOADED' })
}

runExtension()
