async function loadImpulseBuffer(audioCtx) {
    // load impulse response from file

    const pathToImpulse = 'impulses/252846__kijjaz__20141025-ir-new-office-02.wav'
    let url = ''

    if (typeof browser !== 'undefined') {
        url = browser.runtime.getURL(pathToImpulse)
    } else if (typeof chrome !== 'undefined') {
        url = chrome.runtime.getURL(pathToImpulse)
    }

    let response = await fetch(url)
    let arraybuffer = await response.arrayBuffer()
    return await audioCtx.decodeAudioData(arraybuffer)
}

async function createAudioChain(ctx) {
    // Create dry signal chain
    const dry = ctx.createGain()
    dry.connect(ctx.destination)

    // Create parallel chain for distant chatter effect
    // Src -> Lowpass filter -> Reverb (Convolver) -> Output 

    const wetInput = ctx.createGain()

    wetInput.gain.value = 0.5

    const panRight = ctx.createStereoPanner()
    panRight.pan.value = 0.8

    const delayRight = ctx.createDelay()
    delayRight.delayTime.value = 0.02

    const panLeft = ctx.createStereoPanner()
    panLeft.pan.value = -0.8

    const preFilter = ctx.createBiquadFilter()
    preFilter.type = 'bandpass'
    preFilter.frequency.value = 1400
    preFilter.Q.value = 4

    const reverbPredelay = ctx.createDelay()
    reverbPredelay.delayTime.value = 0.1

    const reverb = ctx.createConvolver()
    reverb.buffer = await loadImpulseBuffer(ctx)

    const wet = ctx.createGain()
    const effectGain = ctx.createGain()
    effectGain.gain.value = 0.04

    // Create passthrough chain to pass a bit of dry sound through when out of focus
    const dryPassthroughGain = ctx.createGain()
    const dryPassthroughFilter = ctx.createBiquadFilter()

    dryPassthroughGain.gain.value = 0.2
    dryPassthroughFilter.type = 'lowpass'
    dryPassthroughFilter.frequency.value = 1000
    dryPassthroughFilter.Q.value = 0.7

    // -- Make connections --
    // Split wet input to panning nodes, merge panned signals to preFilter
    wetInput.connect(panRight).connect(delayRight).connect(preFilter)
    wetInput.connect(panLeft).connect(preFilter)

    // Connect rest of the effect chain to output
    preFilter.connect(reverbPredelay).connect(reverb).connect(effectGain).connect(wet).connect(ctx.destination)

    // Add chain for dry passthrough
    panRight.connect(dryPassthroughGain)
    panLeft.connect(dryPassthroughGain)

    dryPassthroughGain.connect(dryPassthroughFilter).connect(wet)

    return {
        connect: (srcNode) => {
            srcNode.connect(dry)
            srcNode.connect(wetInput)
        },
        toBack: (time) => {
            console.log(time)
            wet.gain.linearRampToValueAtTime(1.0, ctx.currentTime + time)
            dry.gain.linearRampToValueAtTime(0.0, ctx.currentTime + time)
        },
        toFront: (time) => {
            console.log(time)
            wet.gain.linearRampToValueAtTime(0.0, ctx.currentTime + time)
            dry.gain.linearRampToValueAtTime(1.0, ctx.currentTime + time)
        },
        filter: preFilter
    }
}

async function initializeExtension() {

    if (!document.querySelector('[aria-label="Leave call"]')) return null;

    console.log('Loading background chatter extension!')

    const ctx = new AudioContext()

    const audioChain = await createAudioChain(ctx)

    const audioElements = document.getElementsByTagName('audio')

    Array.from(audioElements).map(audioElement => {
        node = ctx.createMediaStreamSource(audioElement.srcObject)
        audioChain.connect(node)
        audioElement.muted = true
        audioElement.volume = 0
        audioElement.pause()
        console.log('Detected audio element!')
    })

    audioChain.toFront(1.0)

    function handleVisibilityChange() {

        if (document.visibilityState === 'hidden') {
            // Tab unfocused, take audio to back
            console.log("Out of focus")
            audioChain.toBack(1.0)
        } else {
            // Tab focused, bring audio to front
            console.log("Tab focused")
            audioChain.toFront(1.0)
        }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange, false)

    return audioChain
}

async function initLoop() {
    const audioChain = await initializeExtension()
    if (!audioChain) {
        setTimeout(initLoop, 1000)
    }
}

initLoop()