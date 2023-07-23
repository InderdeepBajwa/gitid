#!/usr/bin/env node

import { CLI } from "./classes/cli";

const cli = new CLI();

const indices = {
  COMMAND_INDEX: 2,
  OPTION_INDEX: 3,
};

const command = process.argv[indices.COMMAND_INDEX] || "";
const option = process.argv[indices.OPTION_INDEX] || "";

const commandsMap: {
  [key: string]: (arg?: string) => void | Promise<void>;
} = {
  new: cli.createNewKey,
  status: cli.printCurrentIdentity,
  list: cli.listAllIdentities,
  use: cli.changeIdentity,
};

commandsMap[command]
  ? commandsMap[command](option)
  : console.log(
      "Usage: gitid <command> <option>, where <command> can be [new, status, list, use]"
    );
