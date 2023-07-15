import { CLI } from "./classes/cli";

const cli = new CLI();

const argument = process.argv.slice(2);

if (argument[0] === "new") {
  cli.newCommand(argument[1]);
} else {
  console.log("Usage: gitta new <key-alias>");
}
