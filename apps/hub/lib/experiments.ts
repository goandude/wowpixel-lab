import type { CardStatus } from "@wowpixel-lab/ui";

export type Experiment = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  status: CardStatus;
  href: string;
};

/**
 * Add new experiments here — they render on the hub automatically.
 * `href` is the public URL of the deployed test app.
 */
export const experiments: Experiment[] = [
  {
    slug: "arcade",
    name: "404 Arcade",
    tagline: "Bytecade 404 — tiny browser games",
    description:
      "The original 404-page arcade collection: breakout, flappy, space invaders, a racer, word scramble and more. Instant play, no install, works offline.",
    status: "live",
    href: "https://arcade.lab.wowpixel.app",
  },
];
