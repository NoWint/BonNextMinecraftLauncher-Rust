# API 文档

## Tauri Commands

所有后端命令通过 `src/api.ts` 封装为类型化函数。

### 认证相关

| 命令              | 参数                | 返回值          |
| ----------------- | ------------------- | --------------- |
| `login_microsoft` | —                   | `AccountInfo`   |
| `logout`          | `accountId: string` | `boolean`       |
| `get_accounts`    | —                   | `AccountInfo[]` |

### 实例管理

| 命令              | 参数                    | 返回值       |
| ----------------- | ----------------------- | ------------ |
| `create_instance` | `name, version, loader` | `Instance`   |
| `delete_instance` | `id: string`            | `boolean`    |
| `list_instances`  | —                       | `Instance[]` |

### 下载

| 命令                    | 参数                | 返回值          |
| ----------------------- | ------------------- | --------------- |
| `download_version`      | `versionId: string` | `DownloadTask`  |
| `get_download_progress` | —                   | `ProgressEvent` |
