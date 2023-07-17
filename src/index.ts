import { CLI } from "./classes/cli";

const cli = new CLI();

const argument = process.argv.slice(2);

switch (argument[0]) {
  case "new":
    cli.newCommand(argument[1]);
    break;
  case "status":
    cli.curentIdentity();
    break;
  default:
    console.log("Usage: gitta new <key-alias>");
}
