const path = require('path')
const sharp = require('sharp')

function resizeToIcons(inputPath, outputPathFormat) {
    const sizes = [16, 24, 32, 48, 64, 128, 256, 512]

    return Promise.all(
        sizes.map((size) =>
            sharp(path.resolve(__dirname, inputPath))
                .resize(size, size)
                .toFile(path.resolve(__dirname, outputPathFormat.replace('%s', size)))
        )
    )
}

async function main() {
    await resizeToIcons('../icons/icon.svg', '../icons/icon-%s.png')
    await resizeToIcons('../icons/icon-off.svg', '../icons/icon-off-%s.png')
}

main()
