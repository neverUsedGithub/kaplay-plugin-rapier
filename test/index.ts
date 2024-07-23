import kaplay, { type AreaComp, type GameObj, type PosComp } from "kaplay";
import rapierPlugin, { load, type RapierBodyComp } from "../src";

await load();

const k = kaplay({
  plugins: [rapierPlugin()],
  debugKey: "r",
});

const draggable: GameObj<RapierBodyComp | PosComp | AreaComp>[] = [];

k.debug.inspect = true;

k.setGravity(200);

k.add([
  k.rect(k.width(), 50),
  k.pos(0, k.height() - 50),
  k.physics.body({ isStatic: true }),
]);

k.add([
  k.rect(50, 200),
  k.pos(0, k.height() - 50 - 200),
  k.physics.body({ isStatic: true }),
]).bounciness = 1;

k.add([
  k.rect(50, 200),
  k.pos(k.width() - 50, k.height() - 50 - 200),
  k.physics.body({ isStatic: true }),
]).bounciness = 1;

const player = k.add([
  k.rect(25, 25),
  k.color(k.GREEN),
  k.pos(k.width() / 2, 0),
  k.anchor("center"),
  k.physics.body({ jumpPower: 200 }),
  k.area(),
]);

player.lockRotation(true);

draggable.push(player);

k.onKeyPress("space", () => {
  if (player.isGrounded()) player.jump();
});

k.onKeyPress("enter", () => {
  k.debug.log(player.velocity);

  player.velocity.y = -200;
});

k.onUpdate(() => {
  const body = player.getRigidBody();
  const direction = k.vec2(0, 0);
  const SPEED = 500 * k.dt();

  if (k.isKeyDown("left")) direction.x -= 1;
  if (k.isKeyDown("right")) direction.x += 1;

  const impulse = {
    x: direction.x * SPEED,
    y: 0,
  };

  body.applyImpulse(impulse, true);
});

k.loop(1, () => {
  const circle = k.add([
    //
    k.pos(k.width() / 2, 100),
    k.circle(20),
    k.area(),
    k.anchor("center"),
    k.physics.body(),
    k.offscreen({ destroy: true }),
  ]);

  circle.addForce(k.vec2(k.rand(1, -1), 0));
  circle.bounciness = 1;

  draggable.push(circle);
});

k.onMousePress(() => {
  for (const circle of draggable) {
    if (circle.isHovering()) {
      const mouse = k.add([
        //
        k.physics.body(),
        k.pos(k.mousePos()),
        "dragging",
      ]);

      mouse.onUpdate(() => mouse.translate(k.mousePos()));

      k.add([
        k.physics.joint({
          joint: {
            type: "spring",
            damping: 2,
            restLength: 2,
            stiffness: 20,
          },
          parent1: circle,
          parent2: mouse,
        }),
        "dragging",
      ]);

      break;
    }
  }
});

k.onMouseRelease(() => {
  k.destroyAll("dragging");
});
