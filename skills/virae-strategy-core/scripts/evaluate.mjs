import { evaluate, parseCliArgs, readJson } from './runtime.mjs';

const args = parseCliArgs(process.argv.slice(2));
if (!args.operation || !args.input) {
  throw new Error('Usage: evaluate.mjs --operation <name> --input <snapshot.json>');
}

process.stdout.write(`${JSON.stringify(evaluate(args.operation, readJson(args.input)), null, 2)}\n`);
