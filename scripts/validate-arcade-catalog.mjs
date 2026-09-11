/**
 * PRIVATE OFFLINE CHECK. Never imported by application/build code. Reads locked
 * metadata but emits aggregates only; never writes traits, IDs, names, or art.
 * Do not run this as part of a public deployment. --require-full fails closed
 * when the private catalog is unavailable in a CI checkout.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const publicSite=JSON.parse(await fs.readFile(path.join(root,'data/site.json'),'utf8'));
const supplied=process.argv.find(arg=>arg.startsWith('--catalog='))?.slice('--catalog='.length);
const source=supplied||process.env.TERMINL_PRIVATE_CATALOG||path.resolve(root,'../ELEMENT/nft-projects/tickerbots/v2/output/collection-2048-terminl/bulk-upload.json');
let catalog;
try{catalog=JSON.parse(await fs.readFile(source,'utf8'));}catch{
  console.log(JSON.stringify({ok:!process.argv.includes('--require-full'),scope:'public-only',fullCatalogValidated:false,reason:'Private metadata is unavailable; no collection contents were exported.'}));
  if(process.argv.includes('--require-full'))process.exitCode=1;
}
if(catalog){
  const publicRoster=publicSite.cast||publicSite.degens||[];
  const publicNames=new Set(publicRoster.map(x=>x.name));
  const compatibleNames=new Set(['Margin Call Max','Diamond Hands Pepe']);
  const stats={count:Array.isArray(catalog)?catalog.length:0,schemaErrors:0,duplicateNames:0,invalidAttributes:0,duplicateTraitCategories:0,missingRequiredTraitCategories:0,publicRosterReferences:0,compatibleBaseRigReferences:0,safeFallbackReferences:0,privateTraitsExported:0,privateImagesCopied:0};
  const seen=new Set();
  if(Array.isArray(catalog))for(const token of catalog){
    if(!token||typeof token.name!=='string'||!token.name||typeof token.description!=='string'||typeof token.image!=='string'||!token.image||!Array.isArray(token.attributes)){stats.schemaErrors++;continue;}
    if(seen.has(token.name))stats.duplicateNames++;seen.add(token.name);
    const categories=new Set();let companion='';
    for(const attribute of token.attributes){
      if(!attribute||typeof attribute.trait_type!=='string'||!attribute.trait_type||!['string','number'].includes(typeof attribute.value)||typeof attribute.value==='number'&&!Number.isFinite(attribute.value)){stats.invalidAttributes++;continue;}
      if(categories.has(attribute.trait_type))stats.duplicateTraitCategories++;categories.add(attribute.trait_type);
      if(attribute.trait_type==='Companion'&&typeof attribute.value==='string')companion=attribute.value;
    }
    // Prop, companion and effect slots are intentionally optional in this
    // collection's snapshot contract; absence must not be reported as damage.
    for(const category of ['Background','Chassis','Chassis Finish','Screen / Face'])if(!categories.has(category))stats.missingRequiredTraitCategories++;
    if(publicNames.has(companion))stats.publicRosterReferences++;
    if(compatibleNames.has(companion))stats.compatibleBaseRigReferences++;
    else stats.safeFallbackReferences++;
  }
  const ok=stats.count===2048&&!stats.schemaErrors&&!stats.duplicateNames&&!stats.invalidAttributes&&!stats.duplicateTraitCategories&&!stats.missingRequiredTraitCategories;
  // This does not grant ownership or apply cosmetic traits at runtime. Until an
  // authenticated ownership adapter exists, everyone freely chooses a base rig.
  console.log(JSON.stringify({ok,scope:'private-aggregate-only',fullCatalogValidated:true,expected:2048,...stats,mapping:'Two public canonical base rigs. All other identities use user-selected public base rig; private traits are never guessed or sent to clients.',ownershipCosmeticsImplemented:false},null,2));
  if(!ok)process.exitCode=1;
}
