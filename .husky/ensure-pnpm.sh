# 由各个 hook 引入。没有全局 pnpm 时，在 PATH 前面放一个转给 corepack 的 pnpm：hook 调起的 package.json 脚本
# （比如 pnpm check）里还会再调 pnpm，只在 hook 里写 corepack pnpm 不够。
if ! command -v pnpm >/dev/null 2>&1; then
  pnpm_shim="$(mktemp -d)"
  trap 'rm -rf "$pnpm_shim"' EXIT
  printf '#!/bin/sh\nexec corepack pnpm "$@"\n' >"$pnpm_shim/pnpm"
  chmod +x "$pnpm_shim/pnpm"
  PATH="$pnpm_shim:$PATH"
  export PATH
fi
