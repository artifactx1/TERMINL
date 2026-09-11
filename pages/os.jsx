import Head from "next/head";
import TerminlOS from "../components/os/TerminlOS";

export default function OS({ machines }) {
  return <><Head>
    <title>TERMINL OS — Rug Runner</title>
    <meta name="description" content="Grab green. Dodge red. Bank before the rug. Race your friends' ghosts through a 45-second meme coin meltdown." />
    <link rel="icon" href="/favicon-32.png" />
    <meta name="theme-color" content="#060907" />
  </Head><TerminlOS machines={machines} /></>;
}

export async function getStaticProps() {
  // Only the already-public showcase enters the OS. Never read the locked collection.
  const { default: data } = await import("../data/site.json");
  return { props: { machines: data.showcase.slice(0, 6) } };
}
