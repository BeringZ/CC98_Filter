# CC98_Filter
我的98我做主，不想看的内容直接拒绝 | My CC98, My Own

# 开发日志
项目结构：
```markdown
cc98-filter-helper/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── content.js
├── background.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
    
```

### v0.1
- 平台：Chrome
- 屏蔽依据：ID名称
- 屏蔽范围
	- 经典模式列表
	- 内容页
- 管理器
	- 按用户名添加
	- 列表管理
		- 用户名
			- 最初于最后屏蔽时间
			- 屏蔽按钮
			- 移除按钮
	- 屏蔽计数

### v0.2
- 更新
	- 功能
		- 标签：能够给每个被屏蔽的人打标签
		- edge平台
		- 屏蔽范围拓展
			- 卡片模式
			- 版块模式
			- 十大热门
			- 按版块屏蔽（不出现在列表中）
	- 优化
		- 被屏蔽时替换头像
 
# 致谢
技术支持：**Deepseek-r1**
