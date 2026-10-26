const { app, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const source = path.join(root, 'src', 'Logo', 'MOOPRESS Color Logo.png');
const SIZES = [16, 24, 32, 48, 64, 128, 256];

function toIco(pngs) {
  const header = Buffer.alloc(6 + pngs.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.data)]);
}

app.whenReady().then(() => {
  const img = nativeImage.createFromPath(source);
  if (img.isEmpty()) throw new Error(`Could not read ${source}`);
  fs.mkdirSync(path.join(root, 'build'), { recursive: true });
  fs.writeFileSync(path.join(root, 'build', 'icon.png'), img.resize({ width: 512, height: 512, quality: 'best' }).toPNG());
  const pngs = SIZES.map((size) => ({ size, data: img.resize({ width: size, height: size, quality: 'best' }).toPNG() }));
  fs.writeFileSync(path.join(root, 'build', 'icon.ico'), toIco(pngs));
  console.log('Wrote build/icon.png and build/icon.ico');
  app.quit();
});
