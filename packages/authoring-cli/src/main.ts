import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeHtmlOutputs } from '@game-presentation/html-exporter';
import { writeEditablePptx } from '@game-presentation/pptx-exporter';
import { readDocxDocument } from '@game-presentation/source-ingestion';
import { buildBalanceStory } from '@game-presentation/story-planner';

type CliOptions = {
  input: string;
  outputDirectory: string;
};

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
}

function parseOptions(args: string[]): CliOptions {
  const input = valueAfter(args, '--input');
  if (input === undefined || input.trim().length === 0) {
    throw new Error('사용법: pnpm author:balance -- --input <DOCX 경로> [--output-dir <출력 폴더>]');
  }
  const absoluteInput = path.resolve(input);
  const outputDirectory = path.resolve(
    valueAfter(args, '--output-dir') ?? path.join(path.dirname(absoluteInput), 'GAME_PPT_DESIGNER_OUTPUT'),
  );
  return { input: absoluteInput, outputDirectory };
}

function safeBaseName(inputPath: string): string {
  return path.basename(inputPath, path.extname(inputPath)).replaceAll(/[<>:"/\\|?*]+/g, '_');
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function runBalanceAuthoring(args: string[]): Promise<Record<string, unknown>> {
  const options = parseOptions(args);
  const document = await readDocxDocument(options.input);
  const { inventory, plan } = buildBalanceStory({ document });
  await fs.mkdir(options.outputDirectory, { recursive: true });

  const baseName = safeBaseName(options.input);
  const paths = {
    authoredDocument: path.join(options.outputDirectory, `${baseName}.authored-document.json`),
    contentInventory: path.join(options.outputDirectory, `${baseName}.content-inventory.json`),
    presentationPlan: path.join(options.outputDirectory, `${baseName}.presentation-plan.json`),
    editablePptx: path.join(options.outputDirectory, `${baseName}.editable.pptx`),
  };

  await Promise.all([
    writeJson(paths.authoredDocument, document),
    writeJson(paths.contentInventory, inventory),
    writeJson(paths.presentationPlan, plan),
  ]);
  await writeEditablePptx(plan, paths.editablePptx);
  const webOutputs = await writeHtmlOutputs(plan, options.outputDirectory, baseName);
  const { validation, ...webFiles } = webOutputs;

  return {
    input: options.input,
    outputDirectory: options.outputDirectory,
    documentId: document.documentId,
    sourceHash: document.source.contentHash,
    parsedBlocks: document.blocks.length,
    parsedSections: document.sections.length,
    inventoryItems: inventory.items.length,
    plannedSlides: plan.slides.length,
    validation,
    files: { ...paths, ...webFiles },
  };
}

const isDirectRun = process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  runBalanceAuthoring(process.argv.slice(2))
    .then((summary) => process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`생성 실패: ${message}\n`);
      process.exitCode = 1;
    });
}
