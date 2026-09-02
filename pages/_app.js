import "../styles/globals.css";
import WalletProviders from "../components/WalletProviders";

export default function App({ Component, pageProps }) {
  return (
    <WalletProviders>
      <Component {...pageProps} />
    </WalletProviders>
  );
}
