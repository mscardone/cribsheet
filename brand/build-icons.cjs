const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const shape = (body, fold) => `<path fill="${body}" d="M111 12C71 11 31 42 20 87C7 137 25 189 65 207C105 225 157 209 177 166C186 147 187 133 175 127C163 120 147 130 133 136C112 146 88 138 78 120C66 98 78 72 99 58L120 44C137 33 131 14 111 12Z"/><circle fill="${body}" cx="137" cy="91" r="31"/><path fill="${fold}" d="M54 184C83 185 108 166 132 145C150 130 165 121 177 128C187 134 184 147 176 156C150 184 115 199 84 194C70 192 60 189 54 184Z"/>`;
const svg = (viewBox, content) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${content}</svg>\n`;
(async () => {
  fs.writeFileSync(path.join(__dirname,'cribsheet-symbol-ivory.svg'), svg('0 0 200 220', shape('#F5F3EC','#A7CEC7')));
  fs.writeFileSync(path.join(__dirname,'cribsheet-symbol-teal.svg'), svg('0 0 200 220', shape('#145C60','#A7CEC7')));
  const icon = svg('0 0 512 512', '<rect width="512" height="512" fill="#145C60"/><g transform="translate(106 91) scale(1.5)">'+shape('#F5F3EC','#A7CEC7')+'</g>');
  fs.writeFileSync(path.join(__dirname,'cribsheet-app-icon.svg'), icon);
  // Browser favicon has its own rounded tile. Installed icons have full-bleed backgrounds; the OS supplies the mask.
  const favicon = icon.replace('<rect width="512" height="512"', '<rect rx="112" width="512" height="512"');
  fs.writeFileSync(path.join(root,'favicon.svg'), favicon);
  for (const [file,size] of [['favicon-192.png',192],['favicon-512.png',512],['apple-touch-icon.png',180]]) {
    await sharp(Buffer.from(icon)).resize(size,size).png().toFile(path.join(root,file));
  }
  const sizes = [16,32,48];
  const images = await Promise.all(sizes.map(s => sharp(Buffer.from(favicon)).resize(s,s).png().toBuffer()));
  const header = Buffer.alloc(6 + sizes.length*16);
  header.writeUInt16LE(1,2); header.writeUInt16LE(sizes.length,4);
  let offset = header.length;
  images.forEach((img,i) => { const at=6+i*16; header[at]=sizes[i]; header[at+1]=sizes[i]; header.writeUInt16LE(1,at+4); header.writeUInt16LE(32,at+6); header.writeUInt32LE(img.length,at+8); header.writeUInt32LE(offset,at+12); offset+=img.length; });
  fs.writeFileSync(path.join(root,'favicon.ico'),Buffer.concat([header,...images]));
  console.log('Generated SVG, PNG, and ICO CribSheet assets.');
})();
