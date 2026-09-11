import Head from "next/head";
import TerminlOS from "../components/os/TerminlOS";

export default function OS({ machines, arcadeLabs }) {
  return <><Head>
    <title>TERMINL OS — The Arcade</title>
    <meta name="description" content="Two games. One questionable operating system. Bank before the rug in Rug Runner or jump, stomp, and reach the rocket in Moon Mission." />
    <link rel="icon" href="/favicon-32.png" />
    <meta name="theme-color" content="#060907" />
  </Head><TerminlOS machines={machines} arcadeLabs={arcadeLabs} /></>;
}

export async function getStaticProps() {
  // Only the already-public showcase enters the OS. Never read the locked collection.
  const { default: data } = await import("../data/site.json");
  return { props: { machines: data.showcase.slice(0, 6), arcadeLabs: process.env.ARCADE_LABS === "1" } };
}
