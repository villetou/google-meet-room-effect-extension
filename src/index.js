async function loadImpulseBuffer(audioCtx) {
    // load impulse response from file

    const pathToImpulse = 'impulses/villetou_small_room_filtered.wav'
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

async function createSimpleAudioChain(ctx) {
        // Create dry signal chain
        const dry = ctx.createGain()
        dry.connect(ctx.destination)
    
        // Create parallel chain for distant chatter effect
        // Src -> Lowpass filter -> Reverb (Convolver) -> Output 
    
        const wetInput = ctx.createGain()
        wetInput.gain.value = 0.5
    
        const reverb = ctx.createConvolver()
        reverb.buffer = await loadImpulseBuffer(ctx)
    
        const wet = ctx.createGain()
    
        // Connect rest of the effect chain to output
        wetInput.connect(reverb).connect(wet).connect(ctx.destination)
    
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
            }
        }
}

async function initializeExtension() {

    if (!document.querySelector('[aria-label="Leave call"]')) return null;

    console.log('Loading background chatter extension!')

    const ctx = new AudioContext()

    const audioChain = await createSimpleAudioChain(ctx)

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