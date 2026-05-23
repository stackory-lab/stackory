# monosync

Synchronize workspace `package.json` dependency versions from a shared
`monosync.json` file.

## Usage

```bash
monosync
monosync --write
monosync --auto --write
```

Options:

```text
--write          Apply package.json changes
--auto           Update monosync.json before syncing package.json files
--root <dir>     Workspace root, defaults to nearest parent with monosync.json
--config <file>  Config file path, defaults to <root>/monosync.json
-h, --help       Show help
-v, --version    Show version
```

## Config

`monosync` looks for `monosync.json` from the current directory upward.

```json
{
  "config": {
    "registry": "https://registry.npmjs.org",
    "minAgeDays": 7,
    "minAgeDaysIgnores": ["^@stackory/"],
    "retries": 2,
    "allowDowngrade": false
  },
  "dependencies": {},
  "devDependencies": {}
}
```

| Field | Default | Description |
|---|---|---|
| `registry` | `https://registry.npmjs.org` | npm registry URL |
| `minAgeDays` | `0` | Only upgrade to versions published at least N days ago |
| `minAgeDaysIgnores` | `[]` | Regex patterns — matching packages skip `minAgeDays` and always use `latest` |
| `retries` | `2` | Retry count for failed registry fetches |
| `allowDowngrade` | `false` | Allow version downgrades when auto-updating |

Dependency values can be strings, locked objects, or arrays:

```json
{
  "dependencies": {
    "typescript": "6.0.3",
    "react": [{ "version": "19.0.0" }, { "version": "18.3.1", "locked": true }]
  }
}
```

## Development

```bash
pnpm --filter @stackory/monosync check:type
pnpm --filter @stackory/monosync check:test
pnpm --filter @stackory/monosync build
```
