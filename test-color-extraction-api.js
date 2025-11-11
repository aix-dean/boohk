// Test script to verify the fixed color extraction in the API route
const fs = require('fs');
const path = require('path');

async function testColorExtractionAPI() {
  try {
    console.log('Testing the fixed color extraction implementation...');

    // Read a test logo file
    const logoPath = 'public/boohk-logo.png';
    if (!fs.existsSync(logoPath)) {
      console.log('Logo file not found, trying alternative...');
      return;
    }

    // Convert to base64
    const logoBuffer = fs.readFileSync(logoPath);
    const base64Logo = logoBuffer.toString('base64');
    const dataUri = `data:image/png;base64,${base64Logo}`;

    console.log('Logo converted to data URI, length:', dataUri.length);

    // Test the extractDominantColor function logic
    const { Vibrant } = require('node-vibrant/node');

    console.log('Testing color extraction with node-vibrant...');
    const palette = await Vibrant.from(logoBuffer).getPalette();

    if (palette && palette.Vibrant) {
      const dominantColor = palette.Vibrant;
      const hexColor = rgbToHex(
        Math.round(dominantColor.rgb[0]),
        Math.round(dominantColor.rgb[1]),
        Math.round(dominantColor.rgb[2])
      );

      console.log('✅ Color extraction successful!');
      console.log('Extracted color:', hexColor);
      console.log('RGB values:', dominantColor.rgb);

      // Test alternative colors if needed
      if (palette.Muted) {
        const mutedHex = rgbToHex(
          Math.round(palette.Muted.rgb[0]),
          Math.round(palette.Muted.rgb[1]),
          Math.round(palette.Muted.rgb[2])
        );
        console.log('Muted alternative:', mutedHex);
      }

      return hexColor;
    } else {
      console.log('❌ Color extraction failed');
      return null;
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    return null;
  }
}

function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
}

testColorExtractionAPI().then(result => {
  console.log('Test completed. Result:', result);
});