import { buildCompletionScript, isSupportedShell } from "../src/classes/completion";

describe("completion scripts", () => {
  it("recognizes supported shells", () => {
    expect(isSupportedShell("bash")).toBe(true);
    expect(isSupportedShell("zsh")).toBe(true);
    expect(isSupportedShell("fish")).toBe(false);
  });

  it("builds bash completion with identity lookup", () => {
    const script = buildCompletionScript("bash");

    expect(script).toContain("gitid __complete-identities");
    expect(script).toContain("use show set");
    expect(script).toContain("complete -F _gitid_completion gitid");
  });

  it("builds zsh completion with identity lookup", () => {
    const script = buildCompletionScript("zsh");

    expect(script).toContain("#compdef gitid");
    expect(script).toContain("gitid __complete-identities");
    expect(script).toContain("use|show|set");
  });
});
