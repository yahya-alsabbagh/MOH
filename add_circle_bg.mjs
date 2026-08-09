import { Jimp } from "jimp";

async function main() {
  const image = await Jimp.read("MOH_Logo.png");
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  
  // Create a transparent background
  const bg = new Jimp({ width, height, color: 0x00000000 });
  
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(centerX, centerY);

  // Draw a white circle
  bg.scan(0, 0, width, height, function (x, y, idx) {
    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // If inside the circle, make it solid white
    if (distance <= radius) {
      this.bitmap.data[idx + 0] = 255; // R
      this.bitmap.data[idx + 1] = 255; // G
      this.bitmap.data[idx + 2] = 255; // B
      this.bitmap.data[idx + 3] = 255; // Alpha
    }
  });

  // Composite the original image on top of the white circle
  bg.composite(image, 0, 0);
  
  await bg.write("MOH_Logo_circle_bg.png");
  console.log("Circular white background image saved successfully");
}

main().catch(console.error);
