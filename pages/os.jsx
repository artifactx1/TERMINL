import Head from "next/head";
import ArcadeHub from "../components/arcade/ArcadeHub";

export default function OS() {
  return <><Head>
    <title>TERMINL Arcade — Wen Lambo, Rekt Rumble & Moon Mission</title>
    <meta name="description" content="Race in Wen Lambo, fight in Rekt Rumble, or take on Moon Mission's ten-level campaign. Free to play. Solo and online. No wallet required." />
    <link rel="icon" href="/favicon-32.png" />
    <meta name="theme-color" content="#060907" />
  </Head><ArcadeHub /></>;
}
