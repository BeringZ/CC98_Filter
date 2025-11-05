class BlockManager {
    constructor() {
        this.blockedUsers = [];
        this.blockedBoards = [];
        this.activeMenu = null;
        this.currentTab = 'user';
        this.init();
    }

    async init() {
        await this.loadBlockedData();
        this.setupTabNavigation();
        this.renderUserList();
        this.renderBoardList();
        this.setupEventListeners();
        this.setupGlobalClickHandler();
    }

    setupTabNavigation() {
        document.getElementById('userTabBtn').addEventListener('click', () => {
            this.switchTab('user');
        });
        
        document.getElementById('boardTabBtn').addEventListener('click', () => {
            this.switchTab('board');
        });
    }

    switchTab(tab) {
        this.currentTab = tab;
        
        document.getElementById('userManagement').style.display = 
            tab === 'user' ? 'block' : 'none';
        document.getElementById('boardManagement').style.display = 
            tab === 'board' ? 'block' : 'none';
        
        document.getElementById('userTabBtn').classList.toggle('active', tab === 'user');
        document.getElementById('boardTabBtn').classList.toggle('active', tab === 'board');
    }

    setupGlobalClickHandler() {
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.function-menu') && !e.target.closest('.function-btn')) {
                this.closeAllMenus();
            }
        });
    }

    closeAllMenus() {
        const menus = document.querySelectorAll('.function-menu');
        menus.forEach(menu => menu.style.display = 'none');
        this.activeMenu = null;
    }

    async loadBlockedData() {
        const result = await chrome.storage.local.get(['blockedUsers', 'blockedBoards']);
        this.blockedUsers = result.blockedUsers || [];
        this.blockedBoards = result.blockedBoards || [];
    }

    async saveBlockedData() {
        await chrome.storage.local.set({
            blockedUsers: this.blockedUsers,
            blockedBoards: this.blockedBoards
        });
        
        this.updateStats();
        
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url.includes('cc98.org')) {
            chrome.tabs.sendMessage(tab.id, { 
                action: 'updateBlockedData', 
                users: this.blockedUsers,
                boards: this.blockedBoards
            });
        }
    }

    updateStats() {
        const enabledUsers = this.blockedUsers.filter(user => user.enabled).length;
        const enabledBoards = this.blockedBoards.filter(board => board.enabled).length;
        
        document.getElementById('blockedUserCount').textContent = enabledUsers;
        document.getElementById('blockedBoardCount').textContent = enabledBoards;
    }

    // 用户管理方法
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
            lastBlockTime: now,
            customLabel: ''
        };

        this.blockedUsers.push(newUser);
        await this.saveBlockedData();
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
            await this.saveBlockedData();
            this.renderUserList();
        }
    }

    async removeUser(username) {
        this.blockedUsers = this.blockedUsers.filter(user => user.username !== username);
        await this.saveBlockedData();
        this.renderUserList();
    }

    renderUserList() {
        const container = document.getElementById('userListContainer');
        const enabledUsers = this.blockedUsers.filter(user => user.enabled);
        
        document.getElementById('blockedUserCount').textContent = enabledUsers.length;

        if (this.blockedUsers.length === 0) {
            container.innerHTML = '<div class="empty-list">暂无屏蔽用户</div>';
            return;
        }

        container.innerHTML = this.blockedUsers.map(user => `
            <div class="item">
                <div class="item-info">
                    <div class="item-name">${this.escapeHtml(user.username)}</div>
                    <div class="item-times">
                        首次屏蔽: ${this.formatTime(user.firstBlockTime)}<br>
                        最后屏蔽: ${this.formatTime(user.lastBlockTime)}
                        ${user.customLabel ? `<br>标签: ${this.escapeHtml(this.truncateLabel(user.customLabel))}` : ''}
                    </div>
                </div>
                <div class="item-actions">
                    <label class="toggle-switch">
                        <input type="checkbox" ${user.enabled ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    <div class="function-container">
                        <button class="function-btn" data-username="${user.username}">···</button>
                        <div class="function-menu" id="menu-user-${user.username}">
                            <div class="menu-item" data-action="remove" data-type="user" data-id="${user.username}">移除</div>
                            <div class="menu-item" data-action="label" data-type="user" data-id="${user.username}">标签</div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.toggle-switch input').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const username = e.target.closest('.item').querySelector('.function-btn').dataset.username;
                this.toggleUser(username, e.target.checked);
            });
        });

        container.querySelectorAll('.function-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const username = e.target.dataset.username;
                this.toggleFunctionMenu(`user-${username}`, e);
            });
        });

        container.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.target.dataset.id;
                const type = e.target.dataset.type;
                const action = e.target.dataset.action;
                
                if (action === 'remove') {
                    if (confirm(`确定要移除对${type === 'user' ? '用户' : '版块'}"${id}"的屏蔽吗？`)) {
                        if (type === 'user') {
                            this.removeUser(id);
                        } else {
                            this.removeBoard(id);
                        }
                    }
                } else if (action === 'label' && type === 'user') {
                    this.setCustomLabel(id);
                }
                
                this.closeAllMenus();
            });
        });
    }

    // 版块管理方法
    async addBoard(boardName) {
        if (!boardName.trim()) return;
        
        const existingBoard = this.blockedBoards.find(board => board.name === boardName.trim());
        if (existingBoard) {
            alert('该版块已在屏蔽列表中');
            return;
        }

        const now = Date.now();
        const newBoard = {
            name: boardName.trim(),
            enabled: true,
            firstBlockTime: now,
            lastBlockTime: now
        };

        this.blockedBoards.push(newBoard);
        await this.saveBlockedData();
        this.renderBoardList();
        
        document.getElementById('boardNameInput').value = '';
    }

    async toggleBoard(boardName, enabled) {
        const board = this.blockedBoards.find(board => board.name === boardName);
        if (board) {
            board.enabled = enabled;
            if (enabled) {
                board.lastBlockTime = Date.now();
            }
            await this.saveBlockedData();
            this.renderBoardList();
        }
    }

    async removeBoard(boardName) {
        this.blockedBoards = this.blockedBoards.filter(board => board.name !== boardName);
        await this.saveBlockedData();
        this.renderBoardList();
    }

    renderBoardList() {
        const container = document.getElementById('boardListContainer');
        const enabledBoards = this.blockedBoards.filter(board => board.enabled);
        
        document.getElementById('blockedBoardCount').textContent = enabledBoards.length;

        if (this.blockedBoards.length === 0) {
            container.innerHTML = '<div class="empty-list">暂无屏蔽版块</div>';
            return;
        }

        container.innerHTML = this.blockedBoards.map(board => `
            <div class="item">
                <div class="item-info">
                    <div class="item-name">${this.escapeHtml(board.name)}</div>
                    <div class="item-times">
                        首次屏蔽: ${this.formatTime(board.firstBlockTime)}<br>
                        最后屏蔽: ${this.formatTime(board.lastBlockTime)}
                    </div>
                </div>
                <div class="item-actions">
                    <label class="toggle-switch">
                        <input type="checkbox" ${board.enabled ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    <div class="function-container">
                        <button class="function-btn" data-boardname="${board.name}">···</button>
                        <div class="function-menu" id="menu-board-${board.name}">
                            <div class="menu-item" data-action="remove" data-type="board" data-id="${board.name}">移除</div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.toggle-switch input').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const boardName = e.target.closest('.item').querySelector('.function-btn').dataset.boardname;
                this.toggleBoard(boardName, e.target.checked);
            });
        });

        container.querySelectorAll('.function-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const boardName = e.target.dataset.boardname;
                this.toggleFunctionMenu(`board-${boardName}`, e);
            });
        });
    }

    toggleFunctionMenu(id, event) {
        event.stopPropagation();
        
        if (this.activeMenu && this.activeMenu !== id) {
            this.closeAllMenus();
        }

        const menu = document.getElementById(`menu-${id}`);
        if (menu.style.display === 'block') {
            menu.style.display = 'none';
            this.activeMenu = null;
        } else {
            menu.style.display = 'block';
            menu.style.left = `${event.target.offsetLeft}px`;
            menu.style.top = `${event.target.offsetTop + event.target.offsetHeight}px`;
            this.activeMenu = id;
        }
    }

    async setCustomLabel(username) {
        const user = this.blockedUsers.find(user => user.username === username);
        const currentLabel = user.customLabel || '此用户的内容已被屏蔽';
        
        const newLabel = prompt(`为用户 "${username}" 设置自定义提示文字：`, currentLabel);
        if (newLabel !== null) {
            user.customLabel = newLabel.trim() || '此用户的内容已被屏蔽';
            await this.saveBlockedData();
            this.renderUserList();
            
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.url.includes('cc98.org')) {
                chrome.tabs.sendMessage(tab.id, { 
                    action: 'updateBlockedData', 
                    users: this.blockedUsers,
                    boards: this.blockedBoards
                });
            }
        }
        
        this.closeAllMenus();
    }

    setupEventListeners() {
        // 用户管理事件
        document.getElementById('addUserBtn').addEventListener('click', () => {
            const input = document.getElementById('usernameInput');
            this.addUser(input.value);
        });

        document.getElementById('usernameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addUser(e.target.value);
            }
        });
        
        // 版块管理事件
        document.getElementById('addBoardBtn').addEventListener('click', () => {
            const input = document.getElementById('boardNameInput');
            this.addBoard(input.value);
        });

        document.getElementById('boardNameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addBoard(e.target.value);
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
    
    truncateLabel(label, maxLength = 20) {
        if (label.length <= maxLength) {
            return label;
        }
        return label.substring(0, maxLength) + '...';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new BlockManager();
});