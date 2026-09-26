import Head from "next/head";
import ArcadeHub from "../components/arcade/ArcadeHub";

export default function OS() {
  return <><Head>
    <title>TERMINL Arcade — Your bags can wait.</title>
    <meta name="description" content="Drive the Lambo. Fight your group chat. Kickflip the food court. Free TERMINL games, no mint or wallet required." />
    <link rel="icon" href="/favicon-32.png" />
    <meta name="theme-color" content="#060907" />
  </Head><ArcadeHub /></>;
}
