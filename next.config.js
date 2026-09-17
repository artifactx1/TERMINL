/** @type {import('next').NextConfig} */
module.exports = {
  distDir: process.env.TERMINL_NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  /* One canonical host. The arcade authority allowlists the site origin and the
   * WalletConnect metadata names it, so a visitor on www must land on the apex
   * before either of those checks runs. */
  async redirects() {
    return [
      { source: "/:path*", has: [{ type: "host", value: "www.terminl.net" }], destination: "https://terminl.net/:path*", permanent: true },
    ];
  },
  /* Baseline browser hardening. No CSP yet: the wallet SDKs inject styles,
   * frames and workers that need a measured allowlist before one can be enforced. */
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      ],
    }];
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      /* Reown AppKit touches window/navigator/IndexedDB at module load. It
       * never has to run during SSR, so the server bundle resolves it to a
       * no-op; the client bundle loads it normally. Same list as ArtifactX. */
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        "@reown/appkit": false,
        "@reown/appkit/react": false,
        "@reown/appkit-adapter-wagmi": false,
        "@reown/appkit-wallet": false,
        "@reown/appkit-controllers": false,
        "@reown/appkit-scaffold-ui": false,
        "@reown/appkit-utils": false,
        "@reown/appkit-polyfills": false,
        "@reown/appkit-common": false,
      };
    }
    /* viem's transitive `ox` package has a dynamic require in chains this
     * site never uses. Harmless, and it floods the build log otherwise. */
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      (w) => /Critical dependency: the request of a dependency is an expression/.test(w?.message || "")
        && /node_modules[\\/](?:viem|ox)[\\/]/.test(w?.module?.resource || ""),
    ];
    return config;
  },
  images: {
    /*
     * `npm run snapshot` already reduces each piece to a 1200px webp, so this
     * is only deriving the smaller grid and marquee variants. The widths below
     * are the ones the page actually renders at.
     */
    remotePatterns: [
      // The published images live beside the rest of the ELEMENT media.
      { protocol: "https", hostname: "storage.googleapis.com", pathname: "/curent-marketplace/**" },
    ],
    imageSizes: [96, 128, 160, 200, 256, 320, 384],
    /* The hero renders around 760px and takes a 2x candidate from deviceSizes. */
    deviceSizes: [640, 828, 1080, 1200, 1920],
    formats: ["image/webp"],
    minimumCacheTTL: 31536000,
  },
};
