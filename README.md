# CC98_Filter
我的98我做主，不想看的内容直接拒绝 | My CC98, My Own

- 最新版本： v1.1.1
- 适配： Chrome、Edge（其他的没测试）

### 功能
- **统一规则**：用户 / 关键词 / 版块三类规则一套引擎，每条规则可独立选择动作
- **四种屏蔽动作**：隐藏 / 折叠 / 模糊 / 替换文案
- **页内一键屏蔽**：悬停帖子、回复、热榜项时浮出 ⛔ 按钮，点一下即屏蔽，支持撤销（Undo）
- **可逆渲染**：被过滤内容不再被销毁，显示为占位条，可「临时查看」随时展开/收起
- **实时生效**：规则变更通过 `chrome.storage.onChanged` 同步，无需刷新页面
- **Popup 轻量化**：只放总开关、本页统计、快速添加、最近规则
- **Options 完整管理**：标签筛选、搜索、批量导入导出、清空（双确认）
- **自动深色模式**：跟随系统 `prefers-color-scheme`
- **旧数据自动迁移**：v0.x 的 blockedUsers / blockedBoards 自动转为统一规则，旧备份文件可直接导入

### 屏蔽范围
- 按用户名：新帖列表（新旧两版）、回复、热榜、私信联系人与聊天窗口
- 按版块：新帖列表、热榜
- 按关键词：标题 / 正文包含即命中（热榜、新帖、回复）

## 安装

手动安装（开发者模式）：
1. 下载 releases 中的文件并解压（或直接使用 `src/` 目录）
2. 进入 Chrome / Edge 的扩展页面
3. 开启右上角「开发者模式」
4. 点击「加载已解压的扩展程序」，选择 `src/` 文件夹

## 使用

- **页内屏蔽**：鼠标悬停任意帖子/回复，右上角出现 ⛔ 按钮 → 选择屏蔽用户 / 版块 / 关键词 → 操作后可点 toast 里的「撤销」反悔
- **临时查看**：被过滤内容显示为占位条「已过滤 · 用户规则 xxx」，点「临时查看」展开，再点「收起」折叠回去；模糊模式点击内容本身即可切换
- **Popup**：总开关、本页已过滤计数、快速添加规则、最近 5 条规则启停/删除
- **管理全部规则**：Popup 底部「管理全部规则 →」进入 Options Page

## 项目结构

```
src/
├── manifest.json
├── background.js          # 安装时旧数据迁移
├── shared/
│   └── storage.js         # 统一 Rule 模型 + 存储 + 匹配引擎 + 导入导出
├── content/
│   ├── adapters.js        # DOM 适配层：页面元素 -> 统一 ContentItem（改版只改这里）
│   ├── renderer.js        # 可逆渲染层：class + placeholder，永不破坏原始 DOM
│   ├── quick-block.js     # 页内快捷屏蔽 + 撤销 toast
│   └── content.js         # 主入口：增量 MutationObserver + storage.onChanged 同步
├── popup/                 # 轻量快捷操作
└── options/               # 完整规则管理
```

核心数据流：

```
CC98 DOM -> Adapter 提取 ContentItem -> RuleEngine 匹配 -> Renderer 可逆渲染
```

## 开发日志

### v0.1
- Chrome 平台，按用户名屏蔽经典模式列表与内容页
- 用户管理器：添加/启停/移除、屏蔽时间、屏蔽计数

### v0.2
- 自定义标签（替换文本）、Edge 适配
- 卡片模式、按版块屏蔽（含十大）
- 头像替换、ID 置换

### v0.3
- 私信拉黑（联系人 + 聊天窗口）
- 一键导出导入名单
- 回复贴组件清理、UI 优化

### v1.0.0（原 v0.4）
- 关键词屏蔽，支持按词设置屏蔽等级
- 被屏蔽用户内容被引用时同样屏蔽
- 热榜屏蔽词检索

### v1.1.0（架构重构）
- [x] 修复规则实时更新：废弃消息通信（v0.3 存在 `updateBlockedData` / `updateBlockedUsers` action 名错位 bug），统一改用 `chrome.storage.onChanged`
- [x] 可逆 Renderer：所有屏蔽改为 class + placeholder，支持临时查看 / 撤销，不再破坏原始 DOM
- [x] 模块化拆分：RuleEngine（shared/storage.js）+ Adapter（adapters.js）+ Renderer（renderer.js）+ 入口（content.js）
- [x] 页内一键屏蔽用户 / 版块 / 关键词，带 Undo
- [x] MutationObserver 增量处理：只处理新增节点 + debounce，不再全页重扫；处理幂等（`data-cc98f-*` 标记）
- [x] 统一 Rule 模型：user / board / keyword 三类规则一套代码，每条规则独立 action
- [x] Popup 简化为快捷操作，完整管理迁移至 Options Page
- [x] 旧版数据自动迁移，导入支持 v1/v2 两种格式并校验
- [x] macOS 字体栈（PingFang SC）+ 自动深色模式

## 待办
- DOM fixture 测试（防 CC98 改版导致 selector 失效）
- 正则规则、白名单、临时规则（1 天 / 7 天）
- 规则组与屏蔽统计

## 测试

端到端测试需 ZJU 内网（或 RVPN），详见 `tests/e2e.js` 文件头注释：

```bash
# 1. 启动带扩展的 Chrome for Testing（见 tests/e2e.js 头部命令）
# 2. 运行
node tests/e2e.js check          # 检查注入
node tests/e2e.js login          # 登录（环境变量 CC98_USER / CC98_PASS）
node tests/e2e.js test <扩展ID>   # 过滤功能全套测试
```

# 致谢
技术支持：**Deepseek-r1**
