import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeHtmlOutputs } from '@game-presentation/html-exporter';
import { writeEditablePptx } from '@game-presentation/pptx-exporter';
import { PresentationPlanSchema, type PresentationPlan } from '@game-presentation/contracts';

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
}

export async function runRebuild(args: string[]): Promise<Record<string, unknown>> {
  const planPath = valueAfter(args, '--plan');
  const outputDirectory = valueAfter(args, '--output-dir');
  const basename = valueAfter(args, '--basename');
  if (planPath === undefined || outputDirectory === undefined || basename === undefined) throw new Error('사용법: rebuild --plan <계획 파일> --output-dir <출력 폴더> --basename <파일 이름>');
  const plan = PresentationPlanSchema.parse(JSON.parse(await fs.readFile(path.resolve(planPath), 'utf8'))) as PresentationPlan;
  await fs.mkdir(path.resolve(outputDirectory), { recursive: true });
  const pptx = path.join(path.resolve(outputDirectory), `${basename}.editable.pptx`);
  await writeEditablePptx(plan, pptx);
  const outputs = await writeHtmlOutputs(plan, path.resolve(outputDirectory), basename);
  return { plan, validation: outputs.validation, files: { pptx, html: outputs.html, pdf: outputs.pdf, pngs: outputs.pngs } };
}

const isDirectRun = process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  runRebuild(process.argv.slice(2))
    .then((summary) => process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`))
    .catch((error: unknown) => { process.stderr.write(`재생성 실패: ${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
}
