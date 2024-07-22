import type { KaboomCtx, Vec2 } from "kaplay";

export function drawInspectText(k: KaboomCtx, pos: Vec2, txt: string) {
  const pad = k.vec2(8);

  k.pushTransform();
  k.pushTranslate(pos);

  const ftxt = k.formatText({
    text: txt,
    font: "monospace",
    size: 16,
    pos: pad,
    color: k.rgb(255, 255, 255),
    fixed: true,
  });

  const bw = ftxt.width + pad.x * 2;
  const bh = ftxt.height + pad.x * 2;

  if (pos.x + bw >= k.width()) {
    k.pushTranslate(k.vec2(-bw, 0));
  }

  if (pos.y + bh >= k.height()) {
    k.pushTranslate(k.vec2(0, -bh));
  }

  k.drawRect({
    width: bw,
    height: bh,
    color: k.rgb(0, 0, 0),
    radius: 4,
    opacity: 0.8,
    fixed: true,
  });

  k.drawFormattedText(ftxt);
  k.popTransform();
}
