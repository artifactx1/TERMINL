// Build the static 1200×630 share card for /wl from published TERMINL art.
import sharp from 'sharp';

const width=1200,height=630;
const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="1200" height="630" fill="#060907"/>
  <path d="M610 0h590v630H610z" fill="#0b160d"/>
  <path d="M610 0v630M704 0v630M798 0v630M892 0v630M986 0v630M1080 0v630M1174 0v630M610 80h590M610 174h590M610 268h590M610 362h590M610 456h590M610 550h590" stroke="#203624" stroke-width="1"/>
  <path d="M607 0v630" stroke="#7dff5c" stroke-width="3"/>
  <text x="54" y="105" font-family="monospace" font-size="51" font-weight="700" letter-spacing="12" fill="#ffffff">TERMINL</text>
  <rect x="56" y="130" width="106" height="5" fill="#7dff5c"/>
  <text x="54" y="207" font-family="monospace" font-size="26" font-weight="700" letter-spacing="3" fill="#7dff5c">WL APPLICATION</text>
  <text x="50" y="315" font-family="monospace" font-size="72" font-weight="900" fill="#ffffff">YOUR WALLET.</text>
  <text x="50" y="399" font-family="monospace" font-size="72" font-weight="900" fill="#ffffff">YOUR SHOT.</text>
  <rect x="54" y="450" width="499" height="2" fill="#324c36"/>
  <text x="54" y="502" font-family="monospace" font-size="29" font-weight="700" fill="#7dff5c">DRAW: OCT 26, 2026</text>
  <text x="54" y="546" font-family="monospace" font-size="20" fill="#bbc9bc">Apply at terminl.net/wl</text>
  <path d="M632 591h540" stroke="#7dff5c" stroke-width="4"/>
  <path d="M630 595h548" stroke="#314e35" stroke-width="14"/>
</svg>`);

const max=await sharp('public/arcade/og/margin-call-max.png').resize({height:490}).png().toBuffer();
const brian=await sharp('public/arcade/og/buy-high-brian.png').resize({height:550}).png().toBuffer();
await sharp(svg).composite([
  {input:max,left:917,top:92},
  {input:brian,left:654,top:37},
]).png({palette:true,quality:90,effort:8}).toFile('public/wl-og.png');
console.log('Wrote public/wl-og.png (1200×630)');
