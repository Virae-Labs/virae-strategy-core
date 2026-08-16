import { evaluate, parseCliArgs, readJson } from './runtime.mjs';

const args = parseCliArgs(process.argv.slice(2));
if (!args.operation || !args.input) {
  throw new Error('Usage: replay.mjs --operation <name> --input <snapshots.json>');
}

const snapshots = readJson(args.input);
if (!Array.isArray(snapshots)) {
  throw new Error('Replay input must be a JSON array.');
}

const results = snapshots.map((input, index) => ({
  index,
  ...evaluate(args.operation, input),
}));
process.stdout.write(`${JSON.stringify({ operation: args.operation, count: results.length, results }, null, 2)}\n`);
