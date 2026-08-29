/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
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
