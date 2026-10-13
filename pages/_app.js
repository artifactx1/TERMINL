import "../styles/globals.css";
import "@farcaster/auth-kit/styles.css";
import WalletProviders from "../components/WalletProviders";
import {useEffect} from "react";
import {useRouter} from "next/router";
import {campaignRequest,campaignEvent} from "../lib/arcade/campaign-client";

export default function App({ Component, pageProps }) {
  const router=useRouter();
  useEffect(()=>{if(router.pathname!=='/os'&&!router.pathname.startsWith('/os/'))return;
    campaignRequest('/session').then(()=>campaignEvent('arcade_view')).catch(()=>{});
  },[router.pathname]);
  return (
    <WalletProviders>
      <Component {...pageProps} />
    </WalletProviders>
  );
}
