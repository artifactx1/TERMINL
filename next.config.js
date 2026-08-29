/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  images: {
    /*
     * Every source render is a 2048px PNG around 2 MB. A gallery of them at
     * full size never paints — the optimizer is what makes an art-first page
     * viable, so the art must be routed through it everywhere except the hero.
     */
    remotePatterns: [{ protocol: "https", hostname: "arweave.net" }],
    imageSizes: [96, 128, 160, 200, 256, 320, 384],
    /* The hero renders around 760px and takes a 2x candidate from deviceSizes. */
    deviceSizes: [640, 828, 1080, 1200, 1920],
    formats: ["image/webp"],
    minimumCacheTTL: 31536000,
  },
  experimental: {
    /*
     * In development the site previews art straight out of the locked
     * collection, which is several gigabytes of PNG sitting outside this repo.
     * The tracer must not pull that into a deployment — in production the art
     * is served from Arweave, not from disk.
     */
    outputFileTracingExcludes: {
      "/": ["../ELEMENT/nft-projects/**"],
      "/api/token": ["../ELEMENT/nft-projects/**"],
    },
  },
};
