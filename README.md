# Fast Tag — 智能书签定位

Chrome MV3 扩展：本地模糊搜索 + DeepSeek 语义联想，快速定位书签。

## 开发

```bash
npm install
npm run build
```

## 加载扩展

1. 打开 Chrome → **扩展程序**（`chrome://extensions`）
2. 开启右上角 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择项目根目录下的 `dist/` 文件夹

## 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | Vite 开发模式（热更新） |
| `npm run build` | TypeScript 检查 + 生产构建 |
| `npm test` | 运行 Vitest 测试 |
| `npm run test:watch` | Vitest 监听模式 |
