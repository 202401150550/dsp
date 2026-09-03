# vendor — 外部插件本地副本

从 `Downloads` 迁入，供 `dsh-desktop-toggle/plugins.yml` 的 `link:` 使用，避免清下载目录或换机后 profile 断链。

## 布局

| 路径 | 来源 |
|------|------|
| `dsh-web-ui/*` | `Downloads/dsh-web-ui-main/packages/*` |
| `openviking-dsh-memory` | `Downloads/OpenViking-main/examples/dsh-memory-plugin` |
| `dsh-super-injector` | `Downloads/dsh-super-injector` |

不含 `node_modules`（profile `pnpm install` 会解析）。不含皮肤全家桶 / `dsh-web-ui-all`（禁止启用，未迁入）。

## 刷新副本

源树仍在 Downloads 时：

```powershell
node D:/dsp/vendor/sync-from-downloads.mjs
```

然后改完 `plugins.yml` 后照常 `apply`。
