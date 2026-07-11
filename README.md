# Fast Tag — 智能书签定位

Chrome MV3 扩展：本地模糊搜索 + DeepSeek 语义联想，快速定位书签。

## 安装与构建

```bash
npm install
npm run build
```

构建产物输出到 `dist/` 目录。

## 加载扩展

1. 打开 Chrome → **扩展程序**（`chrome://extensions`）
2. 开启右上角 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择项目根目录下的 `dist/` 文件夹

## 使用

### 打开搜索

- 快捷键：**⌘⇧K**（Mac）/ **Ctrl⇧K**（Windows）
- 点击扩展图标，在 Popup 中点击「打开搜索」

### 自定义快捷键

Chrome 不允许扩展内直接跳转到 `chrome://` 页面。请在浏览器地址栏输入：

```
chrome://extensions/shortcuts
```

找到 **Fast Tag**，为「打开书签搜索」设置你喜欢的快捷键。

### 搜索操作

| 操作 | 说明 |
|------|------|
| 输入关键词 | 本地模糊匹配，有 API Key 时并行 AI 联想 |
| ↑ / ↓ | 在结果列表中移动选择 |
| 点击结果 / Enter | 打开或激活对应标签页 |
| ⌘/Ctrl + Enter | 强制在新标签页打开 |
| Esc | 关闭搜索窗口 |

### API Key（可选）

- **不配置 API Key** 时，仅使用本地模糊搜索，功能完全可用
- 配置 DeepSeek API Key 后，搜索会额外调用 AI 语义联想，提升命中率
- 在 Popup 中填写 Key 与模型名称，点击「保存」，可用「测试连接」验证

## 隐私说明

启用 AI 搜索（已配置 API Key）时，扩展会将候选书签的 **标题、URL、文件夹路径** 发送至 [DeepSeek API](https://api.deepseek.com/) 进行语义匹配。数据仅用于本次搜索请求，不会存储到第三方服务器。

本地搜索不依赖网络，不会发送任何数据。

## 开发脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | Vite 开发模式（热更新） |
| `npm run build` | TypeScript 检查 + 生产构建 |
| `npm test` | 运行 Vitest 测试 |
| `npm run test:watch` | Vitest 监听模式 |
