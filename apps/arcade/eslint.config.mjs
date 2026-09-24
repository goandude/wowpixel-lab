import base from "@wowpixel-lab/config/eslint.config.mjs";

export default [
  ...base,
  // Vendored verbatim game files — third-party assets, not our code.
  { ignores: ["public/**"] },
];
