import { Jimp } from "jimp";

async function main() {
  const image = await Jimp.read("MOH_Logo.png");
  const bg = new Jimp({ width: image.bitmap.width, height: image.bitmap.height, color: 0xffffffff });
  bg.composite(image, 0, 0);
  await bg.write("MOH_Logo_bg.png");
  console.log("Image saved successfully");
}

main().catch(console.error);
