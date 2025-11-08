const { Vibrant } = require('node-vibrant/node');
const fs = require('fs');

async function testColorExtraction() {
  try {
    console.log('Testing color extraction with a sample logo...');

    // Test with one of the logo files
    const imagePath = 'public/boohk-logo.svg';
    console.log('Reading image file:', imagePath);

    if (!fs.existsSync(imagePath)) {
      console.log('Image file not found, trying alternative paths...');
      const alternativePaths = [
        'public/boohk-logo.svg',
        'public/boohk-logo.svg',
        './public/placeholder-logo.svg'
      ];

      let foundPath = null;
      for (const path of alternativePaths) {
        if (fs.existsSync(path)) {
          foundPath = path;
          console.log('Found alternative image:', path);
          break;
        }
      }

      if (!foundPath) {
        console.log('No suitable image files found for testing');
        return;
      }

      imagePath = foundPath;
    }

    // Read the image file as buffer
    const imageBuffer = fs.readFileSync(imagePath);
    console.log('Image buffer size:', imageBuffer.length, 'bytes');

    // Test color extraction
    console.log('Extracting colors...');
    const palette = await Vibrant.from(imageBuffer).getPalette();

    if (palette) {
      console.log('Palette extracted successfully!');
      console.log('Available swatches:', Object.keys(palette));

      // Check each swatch
      const swatches = ['Vibrant', 'Muted', 'DarkVibrant', 'DarkMuted', 'LightVibrant', 'LightMuted'];
      for (const swatchName of swatches) {
        const swatch = palette[swatchName];
        if (swatch) {
          console.log(`${swatchName}:`, {
            rgb: swatch.rgb,
            hex: swatch.hex,
            population: swatch.population
          });
        } else {
          console.log(`${swatchName}: Not available`);
        }
      }
    } else {
      console.log('Failed to extract palette');
    }

  } catch (error) {
    console.error('Error during color extraction test:', error);
  }
}

testColorExtraction();