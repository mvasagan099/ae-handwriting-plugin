/**
 * Generate a minimal valid TTF font for testing
 * Run: node scripts/generate-font.js
 */

const fs = require('fs');
const path = require('path');

// Use opentype.js to create a minimal font
const opentype = require('opentype.js');

const fontsToGenerate = [
  'Sacramento-Regular',
  'DancingScript-Regular',
  'GreatVibes-Regular',
  'Caveat-Regular',
  'Pacifico-Regular'
];

fontsToGenerate.forEach(fontName => {
  // Create a minimal font with basic glyphs
  const font = new opentype.Font({
    familyName: fontName.split('-')[0],
    styleName: 'Regular',
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    glyphs: (function() {
      const g = [
        new opentype.Glyph({
          name: '.notdef',
          unicode: 0,
          advanceWidth: 500,
          path: new opentype.Path() // Empty path or simple square
        }),
        new opentype.Glyph({
          name: 'space',
          unicode: 0x20,
          advanceWidth: 250,
          path: new opentype.Path(),
        })
      ];
      
      // Generate a simple cursive "loop" for all printable ASCII characters
      for (let i = 33; i <= 126; i++) {
        const char = String.fromCharCode(i);
        const path = new opentype.Path();
        // A cursive lowercase "e" like loop
        path.moveTo(50, 0);
        path.bezierCurveTo(400, 0, 400, 500, 250, 500);
        path.bezierCurveTo(100, 500, 50, 250, 250, 250);
        path.bezierCurveTo(450, 250, 500, 0, 550, 0);
        
        g.push(new opentype.Glyph({
          name: char,
          unicode: i,
          advanceWidth: 600,
          path: path
        }));
      }
      return g;
    })(),
  });

  const outputPath = path.join(__dirname, '../public/assets/fonts', `${fontName}.ttf`);
  const buffer = Buffer.from(font.toArrayBuffer());
  fs.writeFileSync(outputPath, buffer);
  console.log(`Created valid TTF font at: ${outputPath}`);
});

