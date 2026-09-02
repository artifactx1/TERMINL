/**
 * The one door into the wallet stack from page code.
 *
 * appkit-config.js is client-only and aliased away on the server, so it is
 * reached through a dynamic import rather than a static one — the same trick
 * ArtifactX's wallet modal uses. WalletProviders starts this download at
 * module evaluation, so by the time anyone clicks the chunk is already here.
 */
export const walletModule = () =>
  (typeof window === "undefined" ? Promise.reject(new Error("client only")) : import("./appkit-config"));

export const openWallet = (options) => walletModule().then((m) => m.openWallet(options));
export const hasAppKit = () => walletModule().then((m) => m.hasAppKit()).catch(() => false);
