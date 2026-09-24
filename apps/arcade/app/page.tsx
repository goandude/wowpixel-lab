import { redirect } from "next/navigation";

/**
 * The arcade is a fully static site (verbatim port of
 * https://goandude.github.io/404-arcade/arcade.html) served from
 * /arcade/* in `public/`. The app root just forwards there.
 */
export default function ArcadeRoot() {
  redirect("/arcade/arcade.html");
}
