import { generatePreviewSvg } from './engine/animation/animationGenerator.ts';
import opentype from 'opentype.js';
import * as fs from 'fs';

const opentypeObj = require('opentype.js');
const font = opentypeObj.loadSync('public/assets/fonts/Caveat-Regular.ttf');
generatePreviewSvg({
  font: font,
  settings: {
    text: 'hii',
    fontFamily: 'BlackOpsOne',
    style: 'elegant',
    inkColor: '#1a1a2e',
    strokeWidth: 3,
    writingSpeed: 5,
    penType: 'fountain',
    paperBackground: 'cream',
    animateHand: false,
    filledText: false,
    randomizePenPressure: true,
    smoothCurves: true,
    naturalPauses: true,
    autoCameraZoom: false,
  }
}).then(svg => {
  fs.writeFileSync('test_output.svg', svg);
  console.log("Success! File written.");
}).catch(err => console.error(err));
