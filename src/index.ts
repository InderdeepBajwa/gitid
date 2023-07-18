#!/usr/bin/env node

import { CLI } from "./classes/cli";

const cli = new CLI();

const [command, option] = process.argv.slice(2);

switch (command) {
  case "new":
    cli.createNewKey(option);
    break;
  case "status":
    cli.printCurrentIdentity();
    break;
  case "list":
    cli.listAllIdentities();
    break;
  case "use":
    cli.changeIdentity(option);
    break;
  default:
    console.log("Usage: gitta new <key-alias>");
}
