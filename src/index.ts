#!/usr/bin/env node

import { CLI } from "./classes/cli";

const COMMAND_LOCATION = 2;
const OPTION_LOCATION = 3;
const NEW_COMMAND = "new";
const STATUS_COMMAND = "status";
const LIST_COMMAND = "list";
const USE_COMMAND = "use";

const cli = new CLI();

const command = process.argv[COMMAND_LOCATION] || "";
const option = process.argv[OPTION_LOCATION] || "";

switch (command) {
  case NEW_COMMAND:
    cli.createNewKey(option);
    break;
  case STATUS_COMMAND:
    cli.printCurrentIdentity();
    break;
  case LIST_COMMAND:
    cli.listAllIdentities();
    break;
  case USE_COMMAND:
    cli.changeIdentity(option);
    break;
  default:
    console.log("Usage: gitid new <key-alias>");
}
