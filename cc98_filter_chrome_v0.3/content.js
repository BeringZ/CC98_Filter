class CC98Filter {
    constructor() {
        this.blockedUsers = new Set();
        this.blockedBoards = new Set();
        this.userConfigs = {};
        this.boardConfigs = {};
        this.messageUserMap = new Map();
        this.observer = null;
        this.pluginIconUrl = chrome.runtime.getURL('icons/icon.png');
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
            if (request.action === 'updateBlockedUsers') {
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
                            node.matches('.message-message-person') ||
                            node.matches('.message-message-window') ||
                            node.querySelector('.focus-topic') || 
                            node.querySelector('.card-topic') ||
                            node.querySelector('.reply') ||
                            node.querySelector('.mainPageListRow') ||
                            node.querySelector('.message-message-person') ||
                            node.querySelector('.message-message-window')
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
        this.processHotList();
        this.processTopicList();
        this.processReplyList();
        this.processMessagePage();
    }

    processHotList() {
        const hotItems = document.querySelectorAll('.mainPageListRow');
        console.log('找到热榜项目数量:', hotItems.length);
        
        hotItems.forEach((item, index) => {
            const boardElement = item.querySelector('.mainPageListBoardName a');
            if (boardElement) {
                let boardName = boardElement.textContent.trim();
                
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

    processTopicList() {
        const oldTopics = document.querySelectorAll('.focus-topic');
        const newTopics = document.querySelectorAll('.card-topic');
        const allTopics = [...oldTopics, ...newTopics];
        
        console.log('找到帖子数量 (旧版):', oldTopics.length);
        console.log('找到帖子数量 (新版):', newTopics.length);
        console.log('总帖子数量:', allTopics.length);
        
        allTopics.forEach((topic, index) => {
            const boardName = this.getBoardName(topic);
            if (boardName && this.blockedBoards.has(boardName)) {
                console.log(`处理帖子 ${index + 1}: 屏蔽版块 "${boardName}"`);
                topic.style.display = 'none';
                topic.setAttribute('data-cc98-board-blocked', 'true');
                return;
            }
            
            const userNameElement = this.getUserNameElement(topic);
            if (userNameElement) {
                const username = userNameElement.textContent.trim();
                if (this.blockedUsers.has(username)) {
                    console.log(`处理帖子 ${index + 1}: 屏蔽用户 "${username}"`);
                    this.replaceTopicContent(topic, username);
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

    processMessagePage() {
        if (!window.location.href.includes('https://www.cc98.org/message/message')) {
            return;
        }
        
        console.log('检测到私信页面，开始处理');
        this.processMessageList();
        this.processMessageWindow();
    }

    processMessageList() {
        const contacts = document.querySelectorAll('.message-message-person');
        console.log('找到私信联系人数量:', contacts.length);
        
        contacts.forEach((contact, index) => {
            const usernameElement = contact.querySelector('.message-message-pName');
            if (!usernameElement) return;
            
            const username = usernameElement.textContent.trim();
            console.log(`处理联系人 ${index + 1}: ${username}`);
            
            const contactElement = contact.closest('[id^="contact_"]');
            let userId = null;
            if (contactElement) {
                const idMatch = contactElement.id.match(/contact_(\d+)/);
                if (idMatch) {
                    userId = idMatch[1];
                    this.messageUserMap.set(userId, username);
                    console.log(`用户ID: ${userId}`);
                }
            }
            
            if (this.blockedUsers.has(username)) {
                console.log(`屏蔽私信联系人: ${username}`);
                this.replaceMessageContact(contact, username);
            }
        });
    }

    replaceMessageContact(contactElement, username) {
        const portrait = contactElement.querySelector('.message-message-pPortraitUrl');
        if (portrait) {
            portrait.src = this.pluginIconUrl;
            portrait.style.filter = 'grayscale(100%) opacity(50%)';
            portrait.style.borderRadius = '50%';
            console.log('联系人头像已替换');
        }
        
        const usernameElement = contactElement.querySelector('.message-message-pName');
        if (usernameElement) {
            usernameElement.textContent = '该用户已被屏蔽';
            usernameElement.style.color = '#999';
            console.log('联系人用户名已替换');
        }
        
        const lastMessage = contactElement.querySelector('.message-message-pMessage');
        if (lastMessage) {
            lastMessage.innerHTML = '';
            console.log('最后一条消息已清空');
        }
    }

    processMessageWindow() {
        const messageWindow = document.querySelector('.message-message-window');
        if (!messageWindow) {
            console.log('未找到私信窗口');
            return;
        }
        
        const titleElement = messageWindow.querySelector('.message-message-wTitle');
        if (!titleElement) return;
        
        const titleText = titleElement.textContent.trim();
        const match = titleText.match(/与\s+(.+?)\s+的私信/);
        if (!match || !match[1]) {
            console.log('无法从标题提取用户名:', titleText);
            return;
        }
        
        const username = match[1];
        console.log('私信窗口用户名:', username);
        
        if (this.blockedUsers.has(username)) {
            console.log(`屏蔽私信窗口: ${username}`);
            this.replaceMessageWindow(messageWindow, username);
        }
    }

    replaceMessageWindow(windowElement, username) {
        windowElement.innerHTML = '';
        
        const blockedDiv = document.createElement('div');
        blockedDiv.className = 'cc98-blocked-message-window';
        blockedDiv.innerHTML = `
            <div style="
                text-align: center;
                padding: 50px;
                color: #999;
                font-size: 1.2em;
            ">
                <img src="${this.pluginIconUrl}" 
                     style="
                         width: 400px;
                         height: 400px;
                         border-radius: 50%;
                         filter: grayscale(100%) opacity(50%);
                         margin-bottom: 20px;
                     ">
                <p>若干坏情绪已被卷入神秘空间</p>
                <p>☘︎☘︎☘︎☘︎☘︎☘︎☘︎☘︎☘︎☘︎☘︎☘︎☘︎☘︎☘︎☘︎☘︎☘︎☘︎☘︎☘︎☘︎</p>
            </div>
        `;//屏蔽后的私信窗替代文案
        
        windowElement.appendChild(blockedDiv);
        console.log('私信窗口已替换为屏蔽提示');
    }

    // ==================== 优化后的回复贴屏蔽方法 ====================
    replaceReplyContent(replyElement, username) {
        const userConfig = this.userConfigs[username];
        const customLabel = userConfig?.customLabel || '此用户的内容已被屏蔽';
        
        console.log('替换回复内容，用户:', username, '标签:', customLabel);
        
        // 替换用户名为屏蔽提示
        const userNameElement = replyElement.querySelector('.userMessage-userName');
        if (userNameElement) {
            userNameElement.innerHTML = '<span style="color: #999;">该用户已被屏蔽</span>';
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
            console.log('回复头像替换完成，新src:', portraitElement.src);
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

        // 删除不需要的元素
        this.removeUnwantedElements(replyElement);
    }

    removeUnwantedElements(replyElement) {
        // 删除用户统计信息
        const userStats = replyElement.querySelector('.column[style*="width: 60%;"]');
        if (userStats) {
            userStats.remove();
            console.log('用户统计信息已删除');
        }
        
        // 删除用户性别图标
        const genderIcon = replyElement.querySelector('.userGender');
        if (genderIcon) {
            genderIcon.remove();
            console.log('用户性别图标已删除');
        }
        
        // 删除用户操作按钮
        const actionButtons = replyElement.querySelector('.row.userMessageBtn');
        if (actionButtons) {
            actionButtons.remove();
            console.log('用户操作按钮已删除');
        }
        
        // 删除时间戳和互动按钮
        const timestampSection = replyElement.querySelector('.column[style*="margin-top: 1rem; width: 52rem;"]');
        if (timestampSection) {
            timestampSection.remove();
            console.log('时间戳和互动按钮已删除');
        }
        
        // 删除签名档
        const signature = replyElement.querySelector('.signature');
        if (signature) {
            signature.remove();
            console.log('签名档已删除');
        }
        
        // 删除通知元素
        const notices = replyElement.querySelectorAll('.noticeSuccess');
        notices.forEach(notice => notice.remove());
        console.log('通知元素已删除');
        
        // 删除楼层号
        const floorNumber = replyElement.querySelector('.reply-floor');
        if (floorNumber) {
            floorNumber.remove();
            console.log('楼层号已删除');
        }
    }

    // ==================== 帖子内容屏蔽方法 ====================
    replaceTopicContent(topicElement, username) {
        const userConfig = this.userConfigs[username];
        const customLabel = userConfig?.customLabel || '此用户的内容已被屏蔽';
        
        console.log('替换帖子内容，用户:', username, '标签:', customLabel);
        
        // 替换用户名为屏蔽提示
        const userNameElement = this.getUserNameElement(topicElement);
        if (userNameElement) {
            userNameElement.innerHTML = '<span style="color: #999;">该用户已被屏蔽</span>';
            console.log('用户名替换完成');
        }

        // 替换用户头像为插件图标
        const portraitElement = this.getPortraitElement(topicElement);
        if (portraitElement) {
            console.log('找到帖子头像元素，原src:', portraitElement.src);
            portraitElement.src = this.pluginIconUrl;
            portraitElement.style.filter = 'grayscale(100%) opacity(50%)';
            portraitElement.style.borderRadius = '50%';
            portraitElement.setAttribute('data-cc98-filter-replaced', 'true');
            console.log('帖子头像替换完成，新src:', portraitElement.src);
        } else {
            console.log('未找到帖子头像元素');
        }

        // 替换帖子标题
        const titleElement = this.getTitleElement(topicElement);
        if (titleElement) {
            titleElement.textContent = customLabel;
            titleElement.style.color = '#999';
            titleElement.style.fontStyle = 'italic';
            titleElement.href = 'javascript:void(0)';
            titleElement.onclick = (e) => e.preventDefault();
            console.log('帖子标题替换完成');
        }

        // 删除缩略图区域
        const thumbnailMini = topicElement.querySelector('.card-topic-thumbnail-mini');
        if (thumbnailMini) {
            thumbnailMini.innerHTML = '';
            console.log('缩略图区域已清空');
        }

        // 删除原图区域
        const originalImage = topicElement.querySelector('.card-topic-original-image');
        if (originalImage) {
            originalImage.innerHTML = '';
            console.log('原图区域已清空');
        }

        // 删除大图区域
        const thumbnail = topicElement.querySelector('.card-topic-thumbnail');
        if (thumbnail) {
            thumbnail.innerHTML = '';
            console.log('大图区域已清空');
        }

        // 隐藏其他信息
        const infoElement = this.getInfoElement(topicElement);
        if (infoElement) {
            infoElement.innerHTML = '<div style="color: #999;">内容已屏蔽</div>';
            console.log('帖子信息替换完成');
        }
    }

    // ==================== 辅助方法 ====================
    getBoardName(topicElement) {
        let boardElement = topicElement.querySelector('.card-topic-boardName a');
        if (boardElement) {
            return boardElement.textContent.trim();
        }
        
        boardElement = topicElement.querySelector('.card-topic-boardName');
        if (boardElement) {
            return boardElement.textContent.trim();
        }
        
        boardElement = topicElement.querySelector('.focus-topic-board');
        if (boardElement) {
            return boardElement.textContent.trim();
        }
        
        boardElement = topicElement.querySelector('.board-name, .board-link');
        if (boardElement) {
            return boardElement.textContent.trim();
        }
        
        return null;
    }

    getUserNameElement(topicElement) {
        let userNameElement = topicElement.querySelector('.focus-topic-userName');
        
        if (!userNameElement) {
            userNameElement = topicElement.querySelector('.card-topic-userName');
        }
        
        return userNameElement;
    }

    getPortraitElement(topicElement) {
        let portraitElement = topicElement.querySelector('.focus-topic-portraitUrl');
        
        if (!portraitElement) {
            portraitElement = topicElement.querySelector('.card-topic-portraitUrl');
        }
        
        if (!portraitElement) {
            portraitElement = topicElement.querySelector('img[class*="portrait"]');
        }
        if (!portraitElement) {
            portraitElement = topicElement.querySelector('img[class*="avatar"]');
        }
        
        return portraitElement;
    }

    getTitleElement(topicElement) {
        let titleElement = topicElement.querySelector('.focus-topic-title');
        
        if (!titleElement) {
            titleElement = topicElement.querySelector('.card-topic-title');
        }
        
        return titleElement;
    }

    getInfoElement(topicElement) {
        let infoElement = topicElement.querySelector('.focus-topic-info');
        
        if (!infoElement) {
            infoElement = topicElement.querySelector('.card-topic-info');
        }
        
        return infoElement;
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