class CC98Filter {
    constructor() {
        this.blockedUsers = new Set();
        this.blockedBoards = new Set();
        this.userConfigs = {};
        this.boardConfigs = {};
        this.observer = null;
        this.pluginIconUrl = chrome.runtime.getURL('icons/Gemini_Generated_Image_lcsypqlcsypqlcsy.png');
        console.log('使用插件图标:', this.pluginIconUrl);
        this.init();
    }

    async init() {
        console.log('CC98过滤器初始化开始');
        await this.loadBlockedData();
        this.startObserving();
        this.processExistingContent();
        this.setupMessageListener();
        console.log('CC98过滤器初始化完成');
    }

    async loadBlockedData() {
        const result = await chrome.storage.local.get(['blockedUsers', 'blockedBoards']);
        const blockedUsers = result.blockedUsers || [];
        const blockedBoards = result.blockedBoards || [];
        
        this.userConfigs = blockedUsers.reduce((acc, user) => {
            acc[user.username] = user;
            return acc;
        }, {});
        
        this.boardConfigs = blockedBoards.reduce((acc, board) => {
            acc[board.name] = board;
            return acc;
        }, {});
        
        this.blockedUsers = new Set(blockedUsers.filter(user => user.enabled).map(user => user.username));
        this.blockedBoards = new Set(blockedBoards.filter(board => board.enabled).map(board => board.name));
        
        console.log('加载屏蔽用户:', Array.from(this.blockedUsers));
        console.log('加载屏蔽版块:', Array.from(this.blockedBoards));
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'updateBlockedData') {
                console.log('收到更新消息，重新加载屏蔽列表');
                this.userConfigs = request.users.reduce((acc, user) => {
                    acc[user.username] = user;
                    return acc;
                }, {});
                
                this.boardConfigs = request.boards.reduce((acc, board) => {
                    acc[board.name] = board;
                    return acc;
                }, {});
                
                this.blockedUsers = new Set(request.users.filter(user => user.enabled).map(user => user.username));
                this.blockedBoards = new Set(request.boards.filter(board => board.enabled).map(board => board.name));
                this.processExistingContent();
            }
        });
    }

    startObserving() {
        this.observer = new MutationObserver((mutations) => {
            let shouldProcess = false;
            
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        if (node.matches && (
                            node.matches('.focus-topic') || 
                            node.matches('.card-topic') ||
                            node.matches('.reply') ||
                            node.matches('.mainPageListRow') ||
                            node.querySelector('.focus-topic') || 
                            node.querySelector('.card-topic') ||
                            node.querySelector('.reply') ||
                            node.querySelector('.mainPageListRow')
                        )) {
                            shouldProcess = true;
                            console.log('检测到新内容，准备处理');
                        }
                    }
                });
            });

            if (shouldProcess) {
                setTimeout(() => this.processExistingContent(), 100);
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        console.log('开始监听DOM变化');
    }

    processExistingContent() {
        console.log('开始处理现有内容');
        this.processHotList();      // 处理热榜
        this.processOldTopicList(); // 处理旧版帖子列表
        this.processNewTopicList(); // 处理新版帖子列表
        this.processReplyList();    // 处理回复
    }

    // 处理热榜页面
    processHotList() {
        const hotItems = document.querySelectorAll('.mainPageListRow');
        console.log('找到热榜项目数量:', hotItems.length);
        
        hotItems.forEach((item, index) => {
            // 热榜的版块选择器
            const boardElement = item.querySelector('.mainPageListBoardName a');
            if (boardElement) {
                let boardName = boardElement.textContent.trim();
                
                // 处理方括号格式 [版块名]
                if (boardName.startsWith('[') && boardName.endsWith(']')) {
                    boardName = boardName.substring(1, boardName.length - 1);
                }
                
                if (this.blockedBoards.has(boardName)) {
                    console.log(`屏蔽热榜项目 ${index + 1}: 版块 "${boardName}"`);
                    item.style.display = 'none';
                    item.setAttribute('data-cc98-board-blocked', 'true');
                }
            }
        });
    }

    // 处理旧版帖子列表 (.focus-topic)
    processOldTopicList() {
        const oldTopics = document.querySelectorAll('.focus-topic');
        console.log('找到旧版帖子数量:', oldTopics.length);
        
        oldTopics.forEach((topic, index) => {
            // 检查版块屏蔽
            const boardElement = topic.querySelector('.focus-topic-board');
            if (boardElement) {
                const boardName = boardElement.textContent.trim();
                if (this.blockedBoards.has(boardName)) {
                    console.log(`屏蔽旧版帖子 ${index + 1}: 版块 "${boardName}"`);
                    topic.style.display = 'none';
                    topic.setAttribute('data-cc98-board-blocked', 'true');
                    return;
                }
            }
            
            // 检查用户屏蔽
            const userNameElement = topic.querySelector('.focus-topic-userName');
            if (userNameElement) {
                const username = userNameElement.textContent.trim();
                if (this.blockedUsers.has(username)) {
                    console.log(`处理旧版帖子 ${index + 1}: 屏蔽用户 "${username}"`);
                    this.replaceOldTopicContent(topic, username);
                }
            }
        });
    }

    // 处理新版帖子列表 (.card-topic)
    processNewTopicList() {
        const newTopics = document.querySelectorAll('.card-topic');
        console.log('找到新版帖子数量:', newTopics.length);
        
        newTopics.forEach((topic, index) => {
            // 检查版块屏蔽
            const boardElement = topic.querySelector('.card-topic-boardName a');
            if (boardElement) {
                const boardName = boardElement.textContent.trim();
                if (this.blockedBoards.has(boardName)) {
                    console.log(`屏蔽新版帖子 ${index + 1}: 版块 "${boardName}"`);
                    topic.style.display = 'none';
                    topic.setAttribute('data-cc98-board-blocked', 'true');
                    return;
                }
            }
            
            // 检查用户屏蔽
            const userNameElement = topic.querySelector('.card-topic-userName');
            if (userNameElement) {
                const username = userNameElement.textContent.trim();
                if (this.blockedUsers.has(username)) {
                    console.log(`处理新版帖子 ${index + 1}: 屏蔽用户 "${username}"`);
                    this.replaceNewTopicContent(topic, username);
                }
            }
        });
    }

    processReplyList() {
        const replies = document.querySelectorAll('.reply');
        console.log('找到回复数量:', replies.length);
        
        replies.forEach((reply, index) => {
            const userNameElement = reply.querySelector('.userMessage-userName');
            if (userNameElement) {
                const username = userNameElement.textContent.trim();
                if (this.blockedUsers.has(username)) {
                    console.log(`处理回复 ${index + 1}: 屏蔽用户 "${username}"`);
                    this.replaceReplyContent(reply, username);
                }
            }
        });
    }

    // 替换旧版帖子内容
    replaceOldTopicContent(topicElement, username) {
        const userConfig = this.userConfigs[username];
        const customLabel = userConfig?.customLabel || '此用户的内容已被屏蔽';
        
        console.log('替换旧版帖子内容，用户:', username, '标签:', customLabel);
        
        // 替换用户名为屏蔽提示
        const userNameElement = topicElement.querySelector('.focus-topic-userName');
        if (userNameElement) {
            userNameElement.innerHTML = '<span style="color: #999;">已被鹰霸抓走</span>';
            console.log('旧版帖子用户名替换完成');
        }

        // 替换用户头像为插件图标
        const portraitElement = topicElement.querySelector('.focus-topic-portraitUrl');
        if (portraitElement) {
            console.log('找到旧版帖子头像元素，原src:', portraitElement.src);
            portraitElement.src = this.pluginIconUrl;
            portraitElement.style.filter = 'grayscale(100%) opacity(50%)';
            portraitElement.style.borderRadius = '50%';
            portraitElement.setAttribute('data-cc98-filter-replaced', 'true');
            console.log('旧版帖子头像替换完成');
        }

        // 替换帖子标题
        const titleElement = topicElement.querySelector('.focus-topic-title');
        if (titleElement) {
            titleElement.textContent = customLabel;
            titleElement.style.color = '#999';
            titleElement.style.fontStyle = 'italic';
            titleElement.href = 'javascript:void(0)';
            titleElement.onclick = (e) => e.preventDefault();
            console.log('旧版帖子标题替换完成');
        }

        // 隐藏其他信息
        const infoElement = topicElement.querySelector('.focus-topic-info');
        if (infoElement) {
            infoElement.innerHTML = '<div style="color: #999;">内容已屏蔽</div>';
            console.log('旧版帖子信息替换完成');
        }
    }

    // 替换新版帖子内容
    replaceNewTopicContent(topicElement, username) {
        const userConfig = this.userConfigs[username];
        const customLabel = userConfig?.customLabel || '此用户的内容已被屏蔽';
        
        console.log('替换新版帖子内容，用户:', username, '标签:', customLabel);
        
        // 替换用户名为屏蔽提示
        const userNameElement = topicElement.querySelector('.card-topic-userName');
        if (userNameElement) {
            userNameElement.innerHTML = '<span style="color: #999;">已被鹰霸抓走</span>';
            console.log('新版帖子用户名替换完成');
        }

        // 替换用户头像为插件图标
        const portraitElement = topicElement.querySelector('.card-topic-portraitUrl');
        if (portraitElement) {
            console.log('找到新版帖子头像元素，原src:', portraitElement.src);
            portraitElement.src = this.pluginIconUrl;
            portraitElement.style.filter = 'grayscale(100%) opacity(50%)';
            portraitElement.style.borderRadius = '50%';
            portraitElement.setAttribute('data-cc98-filter-replaced', 'true');
            console.log('新版帖子头像替换完成');
        }

        // 替换帖子标题
        const titleElement = topicElement.querySelector('.card-topic-title');
        if (titleElement) {
            titleElement.textContent = customLabel;
            titleElement.style.color = '#999';
            titleElement.style.fontStyle = 'italic';
            titleElement.href = 'javascript:void(0)';
            titleElement.onclick = (e) => e.preventDefault();
            console.log('新版帖子标题替换完成');
        }

        // 删除缩略图区域
        const thumbnailMini = topicElement.querySelector('.card-topic-thumbnail-mini');
        if (thumbnailMini) {
            thumbnailMini.innerHTML = '';
            console.log('新版帖子缩略图区域已清空');
        }

        // 删除原图区域
        const originalImage = topicElement.querySelector('.card-topic-original-image');
        if (originalImage) {
            originalImage.innerHTML = '';
            console.log('新版帖子原图区域已清空');
        }

        // 删除大图区域
        const thumbnail = topicElement.querySelector('.card-topic-thumbnail');
        if (thumbnail) {
            thumbnail.innerHTML = '';
            console.log('新版帖子大图区域已清空');
        }

        // 隐藏其他信息
        const infoElement = topicElement.querySelector('.card-topic-info');
        if (infoElement) {
            infoElement.innerHTML = '<div style="color: #999;">内容已屏蔽</div>';
            console.log('新版帖子信息替换完成');
        }
    }

    replaceReplyContent(replyElement, username) {
        const userConfig = this.userConfigs[username];
        const customLabel = userConfig?.customLabel || '此用户的内容已被屏蔽';
        
        console.log('替换回复内容，用户:', username, '标签:', customLabel);
        
        // 替换用户名为屏蔽提示
        const userNameElement = replyElement.querySelector('.userMessage-userName');
        if (userNameElement) {
            userNameElement.innerHTML = '<span style="color: #999;">已被鹰霸抓走</span>';
            console.log('回复用户名替换完成');
        }

        // 替换用户头像为插件图标
        let portraitElement = replyElement.querySelector('.userPortrait');
        if (!portraitElement) {
            portraitElement = replyElement.querySelector('img[class*="portrait"]');
        }
        if (!portraitElement) {
            portraitElement = replyElement.querySelector('img[class*="avatar"]');
        }
        if (!portraitElement) {
            portraitElement = replyElement.querySelector('.userMessage-right img');
        }
        
        if (portraitElement) {
            console.log('找到回复头像元素，原src:', portraitElement.src);
            portraitElement.src = this.pluginIconUrl;
            portraitElement.style.filter = 'grayscale(100%) opacity(50%)';
            portraitElement.style.borderRadius = '50%';
            console.log('回复头像替换完成');
        } else {
            console.log('未找到回复头像元素');
        }

        // 替换回复内容
        const contentElement = replyElement.querySelector('.substance');
        if (contentElement) {
            contentElement.innerHTML = `
                <div style="
                    color: #999;
                    font-style: italic;
                    padding: 20px;
                    text-align: center;
                    border: 1px dashed #ddd;
                    border-radius: 4px;
                    margin: 10px 0;
                ">
                    ${this.escapeHtml(customLabel)}<br>
                    <small>屏蔽时间: ${new Date().toLocaleString('zh-CN')}</small>
                </div>
            `;
            console.log('回复内容替换完成');
        }

        // 隐藏操作按钮
        const actionButtons = replyElement.querySelectorAll('.userMessageBtn, .comment1, .operation1');
        actionButtons.forEach(btn => {
            btn.style.display = 'none';
        });
        console.log('回复操作按钮隐藏完成');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new CC98Filter();
    });
} else {
    new CC98Filter();
}