/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
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
