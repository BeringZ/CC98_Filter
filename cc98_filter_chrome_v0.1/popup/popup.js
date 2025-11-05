class UserManager {
    constructor() {
        this.blockedUsers = [];
        this.init();
    }

    async init() {
        await this.loadBlockedUsers();
        this.renderUserList();
        this.setupEventListeners();
    }

    async loadBlockedUsers() {
        const result = await chrome.storage.local.get(['blockedUsers']);
        this.blockedUsers = result.blockedUsers || [];
    }

    async saveBlockedUsers() {
        await chrome.storage.local.set({ blockedUsers: this.blockedUsers });
        this.updateStats();
        
        // 通知内容脚本更新屏蔽状态
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url.includes('cc98.org')) {
            chrome.tabs.sendMessage(tab.id, { action: 'updateBlockedUsers', users: this.blockedUsers });
        }
    }

    async addUser(username) {
        if (!username.trim()) return;
        
        const existingUser = this.blockedUsers.find(user => user.username === username.trim());
        if (existingUser) {
            alert('该用户已在屏蔽列表中');
            return;
        }

        const now = Date.now();
        const newUser = {
            username: username.trim(),
            enabled: true,
            firstBlockTime: now,
            lastBlockTime: now
        };

        this.blockedUsers.push(newUser);
        await this.saveBlockedUsers();
        this.renderUserList();
        
        document.getElementById('usernameInput').value = '';
    }

    async toggleUser(username, enabled) {
        const user = this.blockedUsers.find(user => user.username === username);
        if (user) {
            user.enabled = enabled;
            if (enabled) {
                user.lastBlockTime = Date.now();
            }
            await this.saveBlockedUsers();
            this.renderUserList();
        }
    }

    async removeUser(username) {
        this.blockedUsers = this.blockedUsers.filter(user => user.username !== username);
        await this.saveBlockedUsers();
        this.renderUserList();
    }

    renderUserList() {
        const container = document.getElementById('userListContainer');
        const enabledUsers = this.blockedUsers.filter(user => user.enabled);
        
        document.getElementById('blockedCount').textContent = enabledUsers.length;

        if (this.blockedUsers.length === 0) {
            container.innerHTML = '<div class="empty-list">暂无屏蔽用户</div>';
            return;
        }

        container.innerHTML = this.blockedUsers.map(user => `
            <div class="user-item">
                <div class="user-info">
                    <div class="user-name">${this.escapeHtml(user.username)}</div>
                    <div class="user-times">
                        首次屏蔽: ${this.formatTime(user.firstBlockTime)}<br>
                        最后屏蔽: ${this.formatTime(user.lastBlockTime)}
                    </div>
                </div>
                <div class="user-actions">
                    <label class="toggle-switch">
                        <input type="checkbox" ${user.enabled ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    <button class="remove-btn" data-username="${user.username}">移除</button>
                </div>
            </div>
        `).join('');

        // 添加事件监听器
        container.querySelectorAll('.toggle-switch input').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const username = e.target.closest('.user-item').querySelector('.remove-btn').dataset.username;
                this.toggleUser(username, e.target.checked);
            });
        });

        container.querySelectorAll('.remove-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const username = e.target.dataset.username;
                if (confirm(`确定要移除对用户"${username}"的屏蔽吗？`)) {
                    this.removeUser(username);
                }
            });
        });
    }

    setupEventListeners() {
        document.getElementById('addUserBtn').addEventListener('click', () => {
            const input = document.getElementById('usernameInput');
            this.addUser(input.value);
        });

        document.getElementById('usernameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addUser(e.target.value);
            }
        });
    }

    formatTime(timestamp) {
        return new Date(timestamp).toLocaleDateString('zh-CN');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateStats() {
        const enabledCount = this.blockedUsers.filter(user => user.enabled).length;
        document.getElementById('blockedCount').textContent = enabledCount;
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    new UserManager();
});