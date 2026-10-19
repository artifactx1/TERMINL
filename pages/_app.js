import "../styles/globals.css";
import "@farcaster/auth-kit/styles.css";
import WalletProviders from "../components/WalletProviders";
import {useEffect} from "react";
import {useRouter} from "next/router";
import Head from "next/head";
import { BotIdClient } from "botid/client";
import {campaignRequest,campaignEvent} from "../lib/arcade/campaign-client";

export default function App({ Component, pageProps }) {
  const router=useRouter();
  useEffect(()=>{
    campaignRequest('/session').then(()=>{
      void campaignRequest('/events',{name:'site_view',path:router.pathname}).catch(()=>{});
      if(router.pathname==='/os'||router.pathname.startsWith('/os/'))campaignEvent('arcade_view');
    }).catch(()=>{});
  },[router.pathname]);
  return (
    <WalletProviders>
      <Head><BotIdClient protect={[{path:'/api/campaign/wl/apply',method:'POST',advancedOptions:{checkLevel:'basic'}}]}/><link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png"/><link rel="icon" href="/favicon-16.png" sizes="16x16" type="image/png"/><link rel="apple-touch-icon" href="/apple-touch-icon.png"/><link rel="manifest" href="/site.webmanifest"/></Head>
      <Component {...pageProps} />
    </WalletProviders>
  );
}
