class CC98Filter {
    constructor() {
        this.blockedUsers = new Set();
        this.observer = null;
        this.init();
    }

    async init() {
        await this.loadBlockedUsers();
        this.startObserving();
        this.processExistingContent();
        this.setupMessageListener();
    }

    async loadBlockedUsers() {
        const result = await chrome.storage.local.get(['blockedUsers']);
        const blockedUsers = result.blockedUsers || [];
        this.blockedUsers = new Set(blockedUsers.filter(user => user.enabled).map(user => user.username));
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'updateBlockedUsers') {
                this.blockedUsers = new Set(request.users.filter(user => user.enabled).map(user => user.username));
                this.processExistingContent();
            }
        });
    }

    startObserving() {
        this.observer = new MutationObserver((mutations) => {
            let shouldProcess = false;
            
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        if (node.matches && (
                            node.matches('.focus-topic') || 
                            node.matches('.reply') ||
                            node.querySelector('.focus-topic') || 
                            node.querySelector('.reply')
                        )) {
                            shouldProcess = true;
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
    }

    processExistingContent() {
        this.processTopicList();
        this.processReplyList();
    }

    processTopicList() {
        const topics = document.querySelectorAll('.focus-topic');
        topics.forEach(topic => {
            const userNameElement = topic.querySelector('.focus-topic-userName');
            if (userNameElement) {
                const username = userNameElement.textContent.trim();
                if (this.blockedUsers.has(username)) {
                    this.replaceTopicContent(topic, username);
                }
            }
        });
    }

    processReplyList() {
        const replies = document.querySelectorAll('.reply');
        replies.forEach(reply => {
            const userNameElement = reply.querySelector('.userMessage-userName');
            if (userNameElement) {
                const username = userNameElement.textContent.trim();
                if (this.blockedUsers.has(username)) {
                    this.replaceReplyContent(reply, username);
                }
            }
        });
    }

    replaceTopicContent(topicElement, username) {
        // 替换用户名为屏蔽提示
        const userNameElement = topicElement.querySelector('.focus-topic-userName');
        if (userNameElement) {
            userNameElement.innerHTML = '<span style="color: #999;">该用户已被屏蔽</span>';
        }

        // 替换帖子标题
        const titleElement = topicElement.querySelector('.focus-topic-title');
        if (titleElement) {
            titleElement.textContent = '此用户的内容已被屏蔽';
            titleElement.style.color = '#999';
            titleElement.style.fontStyle = 'italic';
            titleElement.href = 'javascript:void(0)';
            titleElement.onclick = (e) => e.preventDefault();
        }

        // 隐藏其他信息
        const infoElement = topicElement.querySelector('.focus-topic-info');
        if (infoElement) {
            infoElement.innerHTML = '<div style="color: #999;">内容已屏蔽</div>';
        }
    }

    replaceReplyContent(replyElement, username) {
        // 替换用户名为屏蔽提示
        const userNameElement = replyElement.querySelector('.userMessage-userName');
        if (userNameElement) {
            userNameElement.innerHTML = '<span style="color: #999;">该用户已被屏蔽</span>';
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
                    此用户的内容已被屏蔽<br>
                    <small>屏蔽时间: ${new Date().toLocaleString('zh-CN')}</small>
                </div>
            `;
        }

        // 隐藏用户头像和其他信息
        const portraitElement = replyElement.querySelector('.userPortrait');
        if (portraitElement) {
            portraitElement.style.filter = 'grayscale(100%) opacity(50%)';
        }

        // 隐藏操作按钮
        const actionButtons = replyElement.querySelectorAll('.userMessageBtn, .comment1, .operation1');
        actionButtons.forEach(btn => {
            btn.style.display = 'none';
        });
    }
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new CC98Filter();
    });
} else {
    new CC98Filter();
}