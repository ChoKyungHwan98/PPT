import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "output");
const EVIDENCE_DIR = path.join(ROOT, "evidence");
const FINAL_PPTX = path.join(OUTPUT_DIR, "break-mechanism-editable.pptx");

const FONT = "Malgun Gothic";
const COLOR = {
  paper: "#F3F1ED",
  ink: "#232729",
  body: "#454C50",
  muted: "#777D80",
  hairline: "#CBC7C0",
  faint: "#E5E1DB",
  time: "#D9E7E4",
  timeInk: "#496560",
  shard: "#64777C",
  break: "#D46F5B",
  breakSoft: "#F0D8D1",
  white: "#FFFFFF",
};

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

function addText(slide, {
  name,
  text,
  left,
  top,
  width,
  height,
  fontSize,
  color = COLOR.ink,
  bold = false,
  alignment = "left",
  verticalAlignment = "top",
  lineSpacing = 1,
}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position: { left, top, width, height },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    typeface: FONT,
    fontSize,
    color,
    bold,
    alignment,
    verticalAlignment,
    lineSpacing,
    autoFit: "shrinkText",
    wrap: "square",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return shape;
}

function addShape(slide, {
  geometry = "rect",
  name,
  left,
  top,
  width,
  height,
  fill = "none",
  lineFill = "none",
  lineWidth = 0,
  rotation = 0,
  borderRadius,
}) {
  return slide.shapes.add({
    geometry,
    name,
    position: { left, top, width, height, rotation },
    fill,
    line: { style: "solid", fill: lineFill, width: lineWidth },
    ...(borderRadius !== undefined ? { borderRadius } : {}),
  });
}

function addLine(slide, {
  name,
  left,
  top,
  width,
  height,
  color = COLOR.hairline,
  weight = 1,
  style = "solid",
}) {
  return slide.shapes.add({
    geometry: "line",
    name,
    position: { left, top, width, height },
    fill: "none",
    line: { style, fill: color, width: weight },
  });
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(EVIDENCE_DIR, { recursive: true });

  const presentation = Presentation.create({
    slideSize: { width: 1280, height: 720 },
  });
  const slide = presentation.slides.add();
  slide.background.fill = COLOR.paper;

  // Reading route first: an understated mechanism axis and the 5-second state field.
  // These are created before the entity marks so the route stays behind every label.
  addLine(slide, {
    name: "mechanism-axis",
    left: 94,
    top: 419,
    width: 1082,
    height: 0,
    color: COLOR.hairline,
    weight: 3,
  });
  addShape(slide, {
    geometry: "triangle",
    name: "mechanism-axis-arrow",
    left: 1171,
    top: 410,
    width: 17,
    height: 18,
    fill: COLOR.hairline,
    rotation: 90,
  });
  addShape(slide, {
    name: "time-stop-field",
    left: 424,
    top: 263,
    width: 350,
    height: 286,
    fill: COLOR.time,
  });
  addLine(slide, {
    name: "time-stop-field-top",
    left: 424,
    top: 263,
    width: 350,
    height: 0,
    color: COLOR.timeInk,
    weight: 2,
  });

  // Header: one claim, with the consequence kept in the same sentence.
  addText(slide, {
    name: "section-label",
    text: "전투 시스템 · 시간 파편 메커니즘",
    left: 72,
    top: 42,
    width: 420,
    height: 24,
    fontSize: 15,
    color: COLOR.muted,
    bold: true,
  });
  addText(slide, {
    name: "slide-number",
    text: "01 / 01",
    left: 1116,
    top: 43,
    width: 92,
    height: 22,
    fontSize: 13,
    color: COLOR.muted,
    alignment: "right",
  });
  addText(slide, {
    name: "headline",
    text: "회피 3회가 5초의 시간 정지를 열고,\nBREAK에서 받는 피해를 +50% 높인다",
    left: 72,
    top: 82,
    width: 1110,
    height: 116,
    fontSize: 47,
    color: COLOR.ink,
    bold: true,
    lineSpacing: 0.93,
  });
  addLine(slide, {
    name: "header-rule",
    left: 72,
    top: 218,
    width: 1136,
    height: 0,
    color: COLOR.hairline,
    weight: 1,
  });

  // 1. Three distinct evade inputs.
  addText(slide, {
    name: "evade-label",
    text: "회피",
    left: 88,
    top: 282,
    width: 150,
    height: 28,
    fontSize: 18,
    color: COLOR.body,
    bold: true,
  });
  addText(slide, {
    name: "evade-count",
    text: "×3",
    left: 88,
    top: 310,
    width: 150,
    height: 54,
    fontSize: 42,
    color: COLOR.ink,
    bold: true,
  });
  [0, 1, 2].forEach((index) => {
    const x = 104 + index * 44;
    addShape(slide, {
      geometry: "parallelogram",
      name: `evade-mark-${index + 1}`,
      left: x,
      top: 392,
      width: 18,
      height: 55,
      fill: index === 2 ? COLOR.shard : COLOR.ink,
      rotation: -10,
    });
    addText(slide, {
      name: `evade-index-${index + 1}`,
      text: String(index + 1).padStart(2, "0"),
      left: x - 7,
      top: 458,
      width: 34,
      height: 18,
      fontSize: 12,
      color: COLOR.muted,
      alignment: "center",
    });
  });

  // 2. The shard appears as the conversion point, not a generic node card.
  addShape(slide, {
    geometry: "ellipse",
    name: "shard-orbit",
    left: 269,
    top: 365,
    width: 108,
    height: 108,
    fill: COLOR.paper,
    lineFill: COLOR.shard,
    lineWidth: 2,
  });
  addShape(slide, {
    geometry: "diamond",
    name: "shard-core",
    left: 304,
    top: 400,
    width: 38,
    height: 38,
    fill: COLOR.shard,
  });
  addText(slide, {
    name: "shard-label",
    text: "시간 파편",
    left: 249,
    top: 292,
    width: 150,
    height: 28,
    fontSize: 18,
    color: COLOR.body,
    bold: true,
    alignment: "center",
  });
  addText(slide, {
    name: "shard-state",
    text: "획득",
    left: 269,
    top: 327,
    width: 108,
    height: 22,
    fontSize: 14,
    color: COLOR.muted,
    alignment: "center",
  });

  // 3. Time stop is a duration field: five ticks make the supplied 5-second value visible.
  addText(slide, {
    name: "time-stop-label",
    text: "시간 정지",
    left: 452,
    top: 292,
    width: 180,
    height: 28,
    fontSize: 18,
    color: COLOR.timeInk,
    bold: true,
  });
  addText(slide, {
    name: "time-stop-duration",
    text: "5",
    left: 452,
    top: 321,
    width: 100,
    height: 92,
    fontSize: 78,
    color: COLOR.ink,
    bold: true,
  });
  addText(slide, {
    name: "time-stop-unit",
    text: "초",
    left: 543,
    top: 362,
    width: 44,
    height: 40,
    fontSize: 26,
    color: COLOR.timeInk,
    bold: true,
  });
  for (let index = 0; index < 5; index += 1) {
    const x = 460 + index * 62;
    addLine(slide, {
      name: `second-tick-${index + 1}`,
      left: x,
      top: 454,
      width: 0,
      height: 33,
      color: COLOR.timeInk,
      weight: index === 4 ? 3 : 1,
    });
    addText(slide, {
      name: `second-number-${index + 1}`,
      text: `${index + 1}`,
      left: x - 13,
      top: 496,
      width: 26,
      height: 18,
      fontSize: 12,
      color: COLOR.timeInk,
      alignment: "center",
    });
  }

  // 4. BREAK visibly interrupts the duration field.
  addShape(slide, {
    name: "break-cut-shadow",
    left: 798,
    top: 259,
    width: 14,
    height: 295,
    fill: COLOR.breakSoft,
    rotation: 9,
  });
  addShape(slide, {
    name: "break-cut",
    left: 808,
    top: 250,
    width: 8,
    height: 312,
    fill: COLOR.break,
    rotation: 9,
  });
  addText(slide, {
    name: "break-label",
    text: "BREAK",
    left: 760,
    top: 332,
    width: 150,
    height: 52,
    fontSize: 31,
    color: COLOR.ink,
    bold: true,
    alignment: "center",
  });
  addText(slide, {
    name: "break-state",
    text: "전환",
    left: 791,
    top: 389,
    width: 88,
    height: 22,
    fontSize: 14,
    color: COLOR.break,
    bold: true,
    alignment: "center",
  });

  // 5. Outcome: the supplied modifier is the visual endpoint.
  addText(slide, {
    name: "damage-label",
    text: "받는 피해",
    left: 924,
    top: 294,
    width: 240,
    height: 30,
    fontSize: 19,
    color: COLOR.body,
    bold: true,
  });
  addText(slide, {
    name: "damage-modifier",
    text: "+50%",
    left: 918,
    top: 329,
    width: 286,
    height: 100,
    fontSize: 78,
    color: COLOR.break,
    bold: true,
  });
  addLine(slide, {
    name: "damage-baseline",
    left: 924,
    top: 449,
    width: 252,
    height: 0,
    color: COLOR.break,
    weight: 2,
  });
  addText(slide, {
    name: "damage-state",
    text: "BREAK 이후 적용",
    left: 924,
    top: 468,
    width: 252,
    height: 24,
    fontSize: 14,
    color: COLOR.muted,
  });

  // Footer evidence strip: it summarizes only values present in the source fixture.
  addLine(slide, {
    name: "footer-rule",
    left: 72,
    top: 604,
    width: 1136,
    height: 0,
    color: COLOR.hairline,
    weight: 1,
  });
  const footer = [
    ["입력", "회피 ×3", 72, 310],
    ["지속", "시간 정지 5초", 406, 390],
    ["결과", "받는 피해 +50%", 824, 384],
  ];
  footer.forEach(([label, value, left, width], index) => {
    addText(slide, {
      name: `footer-label-${index + 1}`,
      text: label,
      left,
      top: 625,
      width: 56,
      height: 20,
      fontSize: 12,
      color: COLOR.muted,
      bold: true,
    });
    addText(slide, {
      name: `footer-value-${index + 1}`,
      text: value,
      left: left + 68,
      top: 618,
      width: width - 68,
      height: 30,
      fontSize: 18,
      color: COLOR.ink,
      bold: true,
    });
  });
  addLine(slide, {
    name: "footer-separator-1",
    left: 382,
    top: 620,
    width: 0,
    height: 36,
    color: COLOR.faint,
  });
  addLine(slide, {
    name: "footer-separator-2",
    left: 800,
    top: 620,
    width: 0,
    height: 36,
    color: COLOR.faint,
  });

  const preview = await presentation.export({ slide, format: "png", scale: 2 });
  await writeBlob(path.join(EVIDENCE_DIR, "artifact-render.png"), preview);

  const layout = await slide.export({ format: "layout" });
  await fs.writeFile(path.join(EVIDENCE_DIR, "slide-01.layout.json"), await layout.text());

  const inspect = await presentation.inspect({
    kind: "slide,textbox,shape",
    maxChars: 30000,
  });
  await fs.writeFile(path.join(EVIDENCE_DIR, "inspect.ndjson"), inspect.ndjson);

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(FINAL_PPTX);

  console.log(FINAL_PPTX);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
