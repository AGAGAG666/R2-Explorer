<div align="center">
  <a href="https://r2explorer.com/">
    <img src="https://raw.githubusercontent.com/G4brym/R2-explorer/refs/heads/main/packages/docs/public/assets/r2-explorer-logo.png" width="500" height="auto" alt="R2-Explorer"/>
  </a>
</div>

<p align="center">
  <em>为 Cloudflare R2 存储桶提供类似 Google Drive 的管理界面</em>
</p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-CN.md">简体中文</a>
</p>

# R2-Explorer

R2-Explorer 为 Cloudflare R2 存储桶提供熟悉、直观的文件管理界面，让文件和文件夹操作更加简单。

[![部署到 Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/templates/tree/main/r2-explorer-template)

## 快速链接

- **文档**：[r2explorer.com](https://r2explorer.com)
- **在线演示**：[demo.r2explorer.com](https://demo.r2explorer.com)
- **源代码**：[github.com/G4brym/R2-Explorer](https://github.com/G4brym/R2-Explorer)

## 项目概览

R2-Explorer 使用现代化、易用的界面改善 Cloudflare R2 的使用体验。它在 Cloudflare 基础设施上自托管，在提供完整文件管理功能的同时保留企业级安全能力。

管理界面支持简体中文和英文。首次访问时会根据浏览器语言自动选择，之后会记住用户手动选择的语言。

## 主要功能

### 安全

- 支持 Basic Authentication
- 集成 Cloudflare Access
- 部署并托管在你自己的 Cloudflare 账户中

### 文件管理

- 拖放上传文件
- 创建和整理文件夹
- 大文件分片上传
- 通过右键菜单执行高级操作
- 编辑 HTTP 元数据和自定义元数据
- 创建安全的公开分享链接，可选密码、有效期和下载次数限制

### 文件处理

- 在浏览器中预览 PDF、图片、文本、Markdown、CSV 和 Logpush 文件
- 在浏览器中编辑文件
- 支持上传整个文件夹

### 邮件集成

- 通过 Cloudflare Email Routing 接收和处理邮件
- 在管理界面中直接查看邮件附件

## 安装方式

请选择最适合你的方式：

1. **GitHub Action（推荐）**

   [查看安装指南](https://r2explorer.com/getting-started/creating-a-new-project/#1st-method-github-action-recommended)

2. **Cloudflare CLI**

   [查看安装指南](https://r2explorer.com/getting-started/creating-a-new-project/#2nd-method-create-cloudflare)

3. **模板仓库**

   [使用项目模板](https://github.com/G4brym/R2-Explorer/tree/main/template)

有关维护和升级现有部署的详细说明，请参阅[更新指南](https://r2explorer.com/getting-started/updating-your-project/)。

## 路线图

### 文件管理

- 支持名称中含空格的存储桶
- 文件搜索
- 文件夹重命名
- 生成图片缩略图

### AI 集成

- 使用 Workers AI 进行对象检测

### 用户体验

- 改进时间戳提示
- 支持回复邮件
- 针对不同文件类型提供更完善的编辑功能

## 已知问题

- 使用 Basic Authentication 时，邮件中的内嵌图片和资源可能无法正常加载
- 其他问题可在 [GitHub Issues](https://github.com/G4brym/R2-Explorer/issues) 中查看和报告

## 参与贡献

欢迎提交错误修复、新功能和文档改进：

1. Fork 本仓库
2. 创建功能分支
3. 提交 Pull Request

## 支持

- 文档：[r2explorer.com](https://r2explorer.com)
- 问题追踪：[GitHub Issues](https://github.com/G4brym/R2-Explorer/issues)

## 许可证

本项目采用 MIT 许可证，详情请参阅 [LICENSE](LICENSE)。
