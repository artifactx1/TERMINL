import Head from 'next/head';
import {arcadeShare,arcadeShareImage,canonicalArcadeUrl} from '../../lib/arcade/share.mjs';

export default function ArcadeMeta({card='arcade',title,description,path,image,alt,noindex=false}){
  const defaults=arcadeShare(card);
  const pageTitle=title||defaults.title,pageDescription=description||defaults.description;
  const canonical=canonicalArcadeUrl(path||defaults.path),shareImage=image||arcadeShareImage(card);
  const imageAlt=alt||`${pageTitle} social preview`;
  return <Head>
    <title>{pageTitle}</title>
    <meta name='description' content={pageDescription}/>
    <meta name='theme-color' content='#081009'/>
    {noindex&&<meta name='robots' content='noindex,nofollow'/>}
    <link rel='canonical' href={canonical}/>
    <meta property='og:type' content='website'/>
    <meta property='og:site_name' content='TERMINL Arcade'/>
    <meta property='og:locale' content='en_US'/>
    <meta property='og:title' content={pageTitle}/>
    <meta property='og:description' content={pageDescription}/>
    <meta property='og:url' content={canonical}/>
    <meta property='og:image' content={shareImage}/>
    <meta property='og:image:secure_url' content={shareImage}/>
    <meta property='og:image:type' content='image/png'/>
    <meta property='og:image:width' content='1200'/>
    <meta property='og:image:height' content='630'/>
    <meta property='og:image:alt' content={imageAlt}/>
    <meta name='twitter:card' content='summary_large_image'/>
    <meta name='twitter:title' content={pageTitle}/>
    <meta name='twitter:description' content={pageDescription}/>
    <meta name='twitter:image' content={shareImage}/>
    <meta name='twitter:image:alt' content={imageAlt}/>
  </Head>;
}
