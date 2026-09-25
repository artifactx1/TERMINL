import {chromium} from 'playwright';
import sharp from 'sharp';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 for(const game of ['mall-rat','rug-exe']){
  await page.goto(`http://127.0.0.1:4000/os/${game}`);await page.getByRole('button',{name:game==='mall-rat'?'BREAK IN →':'ENTER THE PROTOCOL →'}).click();await page.waitForTimeout(4200);
  if(game==='rug-exe'){await page.keyboard.down('w');await page.keyboard.down('f');await page.waitForTimeout(800);await page.keyboard.up('w');await page.keyboard.up('f');}
  await page.screenshot({path:`artifacts/after-hours-v2/${game}-final.png`});
  const image=await page.locator('main').screenshot();await sharp(image).resize(800,425,{fit:'cover'}).png().toFile(`public/arcade/after-hours/${game}-preview.png`);
 }
 console.log({errors});
}finally{await browser.close();}
