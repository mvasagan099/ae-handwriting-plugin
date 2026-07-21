const fs = require('fs');
const { generatePreviewSvg } = require('./engine/animation/animationGenerator.ts');
const { defaultSettings } = require('./shared/types.ts');
const opentype = require('opentype.js');

async function run() {
  const font = opentype.loadSync('public/assets/fonts/BlackOpsOne-Regular.ttf');
  const svgString = await generatePreviewSvg({
    font: font,
    settings: { ...defaultSettings, text: 'hiii' },
  });
  fs.writeFileSync('test.svg', svgString);
  console.log('Saved to test.svg, length:', svgString.length);
}
run();
