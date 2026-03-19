export type SupportedShell = "bash" | "zsh";

export function isSupportedShell(shell: string): shell is SupportedShell {
  return shell === "bash" || shell === "zsh";
}

export function buildCompletionScript(shell: SupportedShell): string {
  return shell === "bash" ? buildBashCompletionScript() : buildZshCompletionScript();
}

function buildBashCompletionScript(): string {
  return `# bash completion for gitid
_gitid_completion() {
  local cur prev words cword
  _init_completion || return

  local commands="new status list current use show set completion"
  local identity_commands="use show set"

  if [[ \${cword} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
    return
  fi

  if [[ \${cword} -eq 2 ]]; then
    case "\${prev}" in
      completion)
        COMPREPLY=( $(compgen -W "bash zsh" -- "\${cur}") )
        return
        ;;
      use|show|set)
        local identities
        identities="$(gitid __complete-identities 2>/dev/null)"
        COMPREPLY=( $(compgen -W "\${identities}" -- "\${cur}") )
        return
        ;;
    esac
  fi

  case "\${words[1]}" in
    new)
      COMPREPLY=( $(compgen -W "--name --email" -- "\${cur}") )
      ;;
    use)
      COMPREPLY=( $(compgen -W "--skip-author" -- "\${cur}") )
      ;;
    set)
      COMPREPLY=( $(compgen -W "--name --email --clear-name --clear-email" -- "\${cur}") )
      ;;
  esac
}

complete -F _gitid_completion gitid
`;
}

function buildZshCompletionScript(): string {
  return `#compdef gitid

_gitid_identities() {
  local -a identities
  identities=(\${(f)"$(gitid __complete-identities 2>/dev/null)"})
  _describe 'identity' identities
}

_gitid() {
  local context state line

  _arguments -C \
    '1:command:(new status list current use show set completion)' \
    '2:identity or shell:->second' \
    '*::arg:->args'

  case $state in
    second)
      case $words[2] in
        use|show|set)
          _gitid_identities
          ;;
        completion)
          _describe 'shell' 'bash zsh'
          ;;
      esac
      ;;
    args)
      case $words[2] in
        new)
          _values 'options' --name --email
          ;;
        use)
          _values 'options' --skip-author
          ;;
        set)
          _values 'options' --name --email --clear-name --clear-email
          ;;
      esac
      ;;
  esac
}

_gitid "$@"
`;
}
