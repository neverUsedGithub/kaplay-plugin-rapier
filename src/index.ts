import * as RAPIER from "@dimforge/rapier2d";
import {
  type Anchor,
  type AnchorComp,
  type CircleComp,
  type Comp,
  type GameObj,
  type KaboomCtx,
  type PolygonComp,
  type PosComp,
  type Rect,
  type RectComp,
  type RotateComp,
  type Vec2,
  type Vec2Args,
} from "kaplay";
import { drawInspectText } from "./drawInspectText";

let R: typeof RAPIER;
let world: RAPIER.World;

const anchorToCenter: Record<Anchor, [number, number]> = {
  bot: [0, -0.5],
  botleft: [0.5, -0.5],
  botright: [-0.5, -0.5],

  center: [0, 0],
  left: [0.5, 0],
  right: [-0.5, 0],

  top: [0, 0.5],
  topleft: [0.5, 0.5],
  topright: [-0.5, 0.5],
};

function getDefaultAnchorFor(obj: GameObj): Anchor {
  if (obj.is("circle")) return "center";

  return "topleft";
}

function translateAnchorToCenter(
  k: KaboomCtx,
  obj: GameObj<PosComp | AnchorComp | { renderArea(): Rect }>,
  isVisible: boolean
): RAPIER.Vector2 {
  const renderArea = isVisible
    ? obj.renderArea().bbox()
    : new k.Rect(k.vec2(0, 0), 0, 0);
  const anchor = obj.anchor ?? getDefaultAnchorFor(obj);

  let deltaX: number;
  let deltaY: number;

  if (typeof anchor === "string") {
    [deltaX, deltaY] = anchorToCenter[anchor];
  } else {
    deltaX = 0.5 - anchor.x;
    deltaY = 0.5 - anchor.y;
  }

  return new R.Vector2(
    obj.pos.x + renderArea.width * deltaX,
    obj.pos.y + renderArea.height * deltaY
  );
}

function translateCenterToAnchor(
  k: KaboomCtx,
  pos: RAPIER.Vector2,
  obj: GameObj<PosComp | AnchorComp | { renderArea(): Rect }>,
  isVisible: boolean
): RAPIER.Vector2 {
  // as of right now polygons can't be anchor()-ed in kaplay,
  // remove this line when they can
  if (obj.is("polygon")) {
    return new R.Vector2(pos.x, pos.y);
  }

  const renderArea = isVisible
    ? obj.renderArea().bbox()
    : new k.Rect(k.vec2(0, 0), 0, 0);
  const anchor = obj.anchor ?? getDefaultAnchorFor(obj);

  let deltaX: number;
  let deltaY: number;

  if (typeof anchor === "string") {
    [deltaX, deltaY] = anchorToCenter[anchor];
  } else {
    deltaX = 0.5 - anchor.x;
    deltaY = 0.5 - anchor.y;
  }

  return new R.Vector2(
    pos.x + renderArea.width * -deltaX,
    pos.y + renderArea.height * -deltaY
  );
}

function convertPolygonPts(pts: Vec2[]): Float32Array {
  const ptsArray: number[] = [];

  for (const pt of pts) {
    ptsArray.push(pt.x, pt.y);
  }

  return new Float32Array(ptsArray);
}

export interface RapierBodyOptions {
  isStatic?: boolean;
  kinematic?: boolean;
  mass?: number;
  jumpPower?: number;
  bounciness?: number;
  gravityScale?: number;
}

export interface RapierBodyComp extends Comp {
  update: Comp["update"];
  inspect: Comp["inspect"];

  /**
   * Get the rigidbody connected to this component.
   * @example ```js
   * const player = add([ rect(10, 10), physics.body() ]);
   *
   * onLoad(() => player.getRigidbody().addForce(vec2(10, 0), true))
   * ```
   **/
  getRigidBody(): RAPIER.RigidBody;

  /**
   * Translate the rigidbody by a vector.
   * @param vec The vector to translate by
   * @example ```js
   * player.translate(10, 10);
   * player.translate(vec2(10, 10));
   * player.translate(10);
   * ```
   */
  translate(...vec: Vec2Args): void;

  /**
   * Translate the rigidbody by a number on the X axis.
   * @param x The number to translate by.
   */
  translateX(x: number): void;

  /**
   * Translate the rigidbody by a number on the Y axis.
   * @param y The number to translate by.
   */
  translateY(y: number): void;

  /**
   * Add a constant force to the rigidbody.
   * @param vec The force to add.
   */
  addForce(vec: Vec2): void;

  /**
   * Apply an impulse to the rigidbody
   * @param vec The impulse to apply.
   */
  applyImpulse(vec: Vec2): void;

  /**
   * Apply a torque impulse to the rigidbody
   * @param impulse The impulse to apply.
   */
  applyTorqueImpulse(impulse: number): void;

  /**
   * Lock the position of the rigidbody
   * @param locked If true, locks the position of the rigidbody. If false, unlocks it.
   */
  lockPosition(locked?: boolean): void;

  /**
   * Lock the rotation of the rigidbody
   * @param locked If true, locks the rotation of the rigidbody. If false, unlocks it.
   */
  lockRotation(locked?: boolean): void;

  /**
   * Makes the rigidbody jump.
   * @param power The power to jump with.
   */
  jump(power?: number): void;

  /**
   * Checks whether the rigidbody is on the ground.
   */
  isGrounded(): boolean;

  /**
   * Checks whether the rigidbody is falling.
   */
  isFalling(): boolean;

  /**
   * The mass of the rigidbody.
   */
  mass: number;

  /**
   * The jump power of the rigidbody.
   */
  jumpPower: number;

  /**
   * The bounciness of the rigidbody.
   */
  bounciness: number;

  /**
   * The gravity scale of the rigidbody.
   */
  gravityScale: number;

  /**
   * The velocity of the rigidbody.
   */
  velocity: Vec2;
}

type RapierGameObj = GameObj<
  | CircleComp
  | RectComp
  | PolygonComp
  | PosComp
  | AnchorComp
  | RotateComp
  | RapierBodyComp
>;

function rapierBody(this: KaboomCtx, opts?: RapierBodyOptions): RapierBodyComp {
  const k = this;
  let rbody: RAPIER.RigidBody | null = null;
  let collider: RAPIER.Collider | null = null;

  function ensureBody(
    obj: RapierGameObj,
    rbody_: RAPIER.RigidBody | null
  ): asserts rbody_ is RAPIER.RigidBody {
    if (rbody_ !== null) return;

    const isVisible = obj.is("polygon") || obj.is("rect") || obj.is("circle");

    if (!obj.is("rotate")) obj.use(k.rotate(0));

    const desc = opts?.isStatic
      ? R.RigidBodyDesc.fixed()
      : opts?.kinematic
      ? R.RigidBodyDesc.kinematicVelocityBased()
      : R.RigidBodyDesc.dynamic();

    rbody = world.createRigidBody(desc);

    rbody.setRotation(obj.angle, true);
    rbody.setGravityScale(opts?.gravityScale ?? 1, true);
    rbody.setTranslation(translateAnchorToCenter(k, obj, isVisible), true);

    if (isVisible) {
      if (obj.is("polygon")) {
        const pts = convertPolygonPts(obj.pts);
        const hull = R.ColliderDesc.convexHull(pts);

        if (hull === null) throw new Error("polygon is not convex");

        collider = world.createCollider(hull, rbody);
      } else if (obj.is("rect")) {
        collider = world.createCollider(
          R.ColliderDesc.cuboid(obj.width / 2, obj.height / 2),
          rbody
        );
      } else if (obj.is("circle")) {
        collider = world.createCollider(R.ColliderDesc.ball(obj.radius), rbody);
      } else {
        throw new Error("unreachable");
      }

      collider.setMass(opts?.mass ?? 1);
    }
  }

  return {
    id: "rapier-body",

    require: ["pos"],

    jumpPower: opts?.jumpPower ?? 100,

    get bounciness() {
      ensureBody(this, rbody);
      return rbody.collider(0).restitution();
    },

    set bounciness(bounciness: number) {
      ensureBody(this, rbody);
      rbody.collider(0).setRestitution(bounciness);
    },

    get mass() {
      ensureBody(this, rbody);
      return rbody.mass();
    },

    set mass(mass: number) {
      ensureBody(this, rbody);
      rbody.collider(0).setMass(mass);
    },

    get gravityScale() {
      ensureBody(this, rbody);
      return rbody.gravityScale();
    },

    set gravityScale(gravityScale: number) {
      ensureBody(this, rbody);
      rbody.setGravityScale(gravityScale, true);
    },

    get velocity() {
      ensureBody(this, rbody);
      const _body = rbody;
      const { x, y } = rbody.linvel();

      return new Proxy(k.vec2(x, y), {
        set(target: any, p, newValue) {
          if (p === "x" || p === "y") {
            const curr = _body.linvel();
            curr[p] = newValue;

            _body.setLinvel(curr, true);
          }

          target[p] = newValue;

          return true;
        },
      });
    },

    set velocity(vel: Vec2) {
      ensureBody(this, rbody);

      rbody.setLinvel(vel, true);
    },

    jump(power?: number) {
      ensureBody(this, rbody);

      const realPower = power ?? this.jumpPower;

      rbody.applyImpulse(k.vec2(0, -realPower), true);
    },

    isGrounded() {
      ensureBody(this, rbody);

      const { width, height } = this.renderArea().bbox();
      const ray = new R.Ray(rbody.translation(), k.vec2(width / 2, height + 1));
      const maxToi = 1;

      const hit = world.castRay(
        ray,
        maxToi,
        true,
        undefined,
        undefined,
        undefined,
        rbody
      );

      return hit !== null;
    },

    isFalling() {
      return !this.isGrounded();
    },

    getRigidBody() {
      ensureBody(this, rbody);

      return rbody;
    },

    lockPosition(locked?: boolean) {
      ensureBody(this, rbody);

      rbody.lockTranslations(locked ?? true, true);
    },

    lockRotation(locked?: boolean) {
      ensureBody(this, rbody);

      rbody.lockRotations(locked ?? true, true);
    },

    addForce(vec: Vec2) {
      ensureBody(this, rbody);

      rbody.addForce(new R.Vector2(vec.x, vec.y), true);
    },

    applyImpulse(vec: Vec2) {
      ensureBody(this, rbody);

      rbody.applyImpulse(new R.Vector2(vec.x, vec.y), true);
    },

    applyTorqueImpulse(impulse: number) {
      ensureBody(this, rbody);

      rbody.applyTorqueImpulse(impulse, true);
    },

    translate(...args: Vec2Args) {
      ensureBody(this, rbody);

      rbody.setTranslation((k.vec2 as any)(...args), true);
    },

    translateX(x: number) {
      ensureBody(this, rbody);

      rbody.setTranslation(new R.Vector2(x, rbody!.translation().y), true);
    },

    translateY(y: number) {
      ensureBody(this, rbody);

      rbody.setTranslation(new R.Vector2(rbody!.translation().x, y), true);
    },

    update() {
      const isVisible =
        this.is("polygon") || this.is("rect") || this.is("circle");

      ensureBody(this, rbody);

      const position = rbody.translation();
      const translated = translateCenterToAnchor(k, position, this, isVisible);

      this.pos.x = translated.x;
      this.pos.y = translated.y;

      this.rotateTo(k.rad2deg(rbody.rotation()));
    },

    destroy() {
      if (collider) world.removeCollider(collider, false);
      if (rbody) world.removeRigidBody(rbody);
    },

    inspect() {
      const vel = this.getRigidBody().linvel();

      return `mass: ${this.mass}\ngravityScale: ${
        this.gravityScale
      }\nvelocity: (${vel.x.toFixed(2).padStart(6)}, ${vel.y
        .toFixed(2)
        .padStart(6)})`;
    },
  } satisfies ThisType<RapierGameObj>;
}

export type RapierJointDataOptions =
  | {
      type: "fixed";

      frame1?: number;
      frame2?: number;

      anchor1?: Vec2;
      anchor2?: Vec2;
    }
  | {
      type: "prismatic";
      axis: Vec2;

      anchor1?: Vec2;
      anchor2?: Vec2;
    }
  | {
      type: "revolute";

      anchor1?: Vec2;
      anchor2?: Vec2;
    }
  | {
      type: "rope";
      length: number;

      anchor1?: Vec2;
      anchor2?: Vec2;
    }
  | {
      type: "spring";
      restLength: number;
      stiffness: number;
      damping: number;

      anchor1?: Vec2;
      anchor2?: Vec2;
    };

export interface RapierJointOptions {
  joint: RapierJointDataOptions;
  parent1: GameObj<RapierBodyComp>;
  parent2: GameObj<RapierBodyComp>;
}

export interface RapierJointComp extends Comp {
  destroy: Comp["destroy"];
}

export type AxesMask = RAPIER.JointAxesMask;

const ZERO: RAPIER.Vector2 = { x: 0, y: 0 };

function rapierJoint(
  this: KaboomCtx,
  opts: RapierJointOptions
): RapierJointComp {
  const joint = world.createImpulseJoint(
    opts.joint.type === "fixed"
      ? R.JointData.fixed(
          opts.joint.anchor1 ?? ZERO,
          opts.joint.frame1 ?? 0,
          opts.joint.anchor2 ?? ZERO,
          opts.joint.frame2 ?? 0
        )
      : opts.joint.type === "prismatic"
      ? R.JointData.prismatic(
          opts.joint.anchor1 ?? ZERO,
          opts.joint.anchor2 ?? ZERO,
          opts.joint.axis
        )
      : opts.joint.type === "revolute"
      ? R.JointData.revolute(
          opts.joint.anchor1 ?? ZERO,
          opts.joint.anchor2 ?? ZERO
        )
      : opts.joint.type === "rope"
      ? R.JointData.rope(
          opts.joint.length,
          opts.joint.anchor1 ?? ZERO,
          opts.joint.anchor2 ?? ZERO
        )
      : opts.joint.type === "spring"
      ? R.JointData.spring(
          opts.joint.restLength,
          opts.joint.stiffness,
          opts.joint.damping,
          opts.joint.anchor1 ?? ZERO,
          opts.joint.anchor2 ?? ZERO
        )
      : (null as never),
    opts.parent1.getRigidBody(),
    opts.parent2.getRigidBody(),
    true
  );

  return {
    id: "rapier-joint",

    destroy() {
      world.removeImpulseJoint(joint, true);
    },
  };
}

export interface RapierPluginOptions {
  /**
   * The duration, in milliseconds, between each physics update step.
   */
  physicsStep?: number;
}

export interface RapierPlugin {
  /**
   * All physics components are contained within this namespace.
   */
  physics: {
    /**
     * A body that is affected by gravity and collides with other bodies.
     * @param opts The options to create the rigidbody with.
     */
    body(opts?: RapierBodyOptions): RapierBodyComp;
    /**
     * A connection between 2 bodies.
     * @param opts The options to create the joint with.
     */
    joint(opts: RapierJointOptions): RapierJointComp;
    /**
     * The Rapier World instance.
     */
    world: RAPIER.World | null;
  };
}

/**
 * Loads the Rapier physics engine. Must be called before `kaplay()`.
 * Note: You can also load the engine as an asset using `k.load(load)`,
 * but this may introduce unexpected bugs.
 **/
export async function load() {
  R = await import("@dimforge/rapier2d");

  world = new R.World(new R.Vector2(0, 20));
}

function inspectTextItem(k: KaboomCtx, index: number) {
  return k.vec2(8, 8 + index * 40);
}

/**
 * Returns a plugin for use in `kaplay`. Supply `opts` to customize its behavior.
 * @param opts - The options for configuring the plugin.
 * @returns The Kaplay plugin.
 */
export default function rapierPlugin(
  opts?: RapierPluginOptions
): (k: KaboomCtx) => RapierPlugin {
  return (k: KaboomCtx) => {
    if (typeof world === "undefined")
      console.warn(
        "Not to calling and awaiting `load()` before instantiating `kaplay` may result in unexpected bugs."
      );

    const PHYSICS_STEP = opts?.physicsStep ?? 5; // 200hz physics by default

    let updateCount = 0;
    let lastStepTook = 0;
    let stepStart = 0;

    let acc = 0;

    k.onUpdate(() => {
      if (!world) return;

      acc += k.dt() * 1000;

      world.gravity.y = k.getGravity();

      while (acc >= PHYSICS_STEP) {
        if (k.debug.inspect) stepStart = performance.now();

        world.step();
        acc -= PHYSICS_STEP;
        updateCount++;

        if (k.debug.inspect) lastStepTook = performance.now() - stepStart;
      }
    });

    k.onDraw(() => {
      if (!k.debug.inspect) return;

      drawInspectText(
        k,
        inspectTextItem(k, 1),
        `Physics Updates: ${updateCount}`
      );
      drawInspectText(
        k,
        inspectTextItem(k, 2),
        `Physics Step (ms): ${lastStepTook.toFixed(2).padStart(6)}`
      );
      drawInspectText(
        k,
        inspectTextItem(k, 3),
        `Rigidbodies: ${world.bodies.len()}`
      );
    });

    return {
      physics: {
        body: rapierBody.bind(k),
        joint: rapierJoint.bind(k),
        get world() {
          return world;
        },
      },
    };
  };
}
