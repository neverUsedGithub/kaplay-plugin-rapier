# kaplay-physics-rapier

This plugin integrates the Rapier physics engine into KAPLAY, including rigidbodies and joints
and some pre-made utility functions like `jump()` and `isGrounded()`.

## Installation

```sh
mpm i kaplay-physics-rapier
```

## Usage

```ts
import rapierPlugin, { load } from "kaplay-physics-rapier";
import kaplay from "kaplay";

await load();

const k = kaplay({
  plugins: [ rapierPlugin() ],
});
```