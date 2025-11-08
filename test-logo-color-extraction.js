// Test script to verify color extraction with the provided logo URL
const { Vibrant } = require('node-vibrant/node');

async function testLogoColorExtraction() {
  try {
    console.log('Testing color extraction with the provided logo URL...');

    // The correct logo URL that should be used consistently
    const logoUrl = 'https://firebasestorage.googleapis.com/v0/b/oh-app-bcf24.appspot.com/o/company_logos%2FmlQu3MEGrcdhWVEAJZPYBGSFLbx1%2F1753334275475_Login.png?alt=media&token=645590e5-6ca9-4783-9d90-6ace8f545495';

    console.log('Fetching logo from URL:', logoUrl);

    // Fetch the image from the URL
    const response = await fetch(logoUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    console.log('Content type:', contentType);

    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error(`Invalid content type: ${contentType}. Expected image/*`);
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log('Image buffer size:', arrayBuffer.byteLength, 'bytes');

    const imageBuffer = Buffer.from(arrayBuffer);

    // Test color extraction using node-vibrant
    console.log('Extracting colors from logo...');
    const palette = await Vibrant.from(imageBuffer).getPalette();

    if (palette) {
      console.log('✅ Palette extracted successfully!');
      console.log('Available swatches:', Object.keys(palette));

      // Check each swatch and find the best one
      const swatches = ['Vibrant', 'Muted', 'DarkVibrant', 'DarkMuted', 'LightVibrant', 'LightMuted'];
      let bestSwatch = null;
      let bestColor = null;

      for (const swatchName of swatches) {
        const swatch = palette[swatchName];
        if (swatch) {
          console.log(`${swatchName}:`, {
            rgb: swatch.rgb,
            hex: swatch.hex,
            population: swatch.population
          });

          // Use Vibrant as primary, but keep track of alternatives
          if (swatchName === 'Vibrant') {
            bestSwatch = swatch;
            bestColor = swatch.hex;
          } else if (!bestSwatch && swatch.population > 0) {
            // Fallback to any swatch with population if Vibrant is not available
            bestSwatch = swatch;
            bestColor = swatch.hex;
          }
        } else {
          console.log(`${swatchName}: Not available`);
        }
      }

      if (bestColor) {
        console.log('🎨 Best extracted color:', bestColor);
        console.log('✅ Color extraction test PASSED');
        return bestColor;
      } else {
        console.log('❌ No suitable color found');
        return null;
      }
    } else {
      console.log('❌ Failed to extract palette');
      return null;
    }

  } catch (error) {
    console.error('❌ Error during color extraction test:', error.message);
    return null;
  }
}

// Helper function to convert RGB to hex (for comparison)
function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

// Run the test
testLogoColorExtraction()
  .then((color) => {
    console.log('Test completed. Extracted color:', color);
    process.exit(color ? 0 : 1);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });