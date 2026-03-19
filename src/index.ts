#!/usr/bin/env node

import { CLI, CLIFlags } from "./classes/cli";

const cli = new CLI();

interface ParsedArgs {
  command: string;
  option: string;
  flags: CLIFlags;
}

function parseArgs(args: string[]): ParsedArgs {
  const command = args[0] || "";
  const flags: CLIFlags = {};
  let option = "";
  let currentIndex = 1;

  if (args[currentIndex] && !args[currentIndex].startsWith("--")) {
    option = args[currentIndex];
    currentIndex += 1;
  }

  while (currentIndex < args.length) {
    const currentArg = args[currentIndex];

    if (!currentArg.startsWith("--")) {
      currentIndex += 1;
      continue;
    }

    const trimmedFlag = currentArg.slice(2);
    const [flagName, inlineValue] = trimmedFlag.split("=", 2);

    if (inlineValue !== undefined) {
      flags[flagName] = inlineValue;
      currentIndex += 1;
      continue;
    }

    const nextArg = args[currentIndex + 1];

    if (nextArg && !nextArg.startsWith("--")) {
      flags[flagName] = nextArg;
      currentIndex += 2;
      continue;
    }

    flags[flagName] = true;
    currentIndex += 1;
  }

  return { command, option, flags };
}

const parsedArgs = parseArgs(process.argv.slice(2));

const commandsMap: Record<string, () => void | Promise<void>> = {
  new: () => cli.createNewKey(parsedArgs.option, parsedArgs.flags),
  status: () => cli.printCurrentIdentity(),
  list: () => cli.listAllIdentities(),
  current: () => cli.printCurrentIdentity(),
  use: () => cli.changeIdentity(parsedArgs.option, parsedArgs.flags),
  show: () => cli.showPublicKey(parsedArgs.option),
  set: () => cli.setIdentityProfile(parsedArgs.option, parsedArgs.flags),
  completion: () => cli.printCompletionScript(parsedArgs.option),
  "__complete-identities": () => cli.printIdentityCompletions(),
};

commandsMap[parsedArgs.command]
  ? commandsMap[parsedArgs.command]()
  : console.log(
      "Usage: gitid <command> <option>, where <command> can be [new, status, list, current, use, show, set, completion]"
    );
