import type { RapierPlugin } from ".";

declare global {
  const physics: RapierPlugin["physics"];
}
