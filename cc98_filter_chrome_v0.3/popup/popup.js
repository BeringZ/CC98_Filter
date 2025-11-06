class BlockManager {
    constructor() {
        // 初始化屏蔽管理器的状态
        this.blockedUsers = [];
        this.blockedBoards = [];
        this.activeMenu = null;
        this.currentTab = 'user';
        this.init();
    }

    async init() {
        console.log('BlockManager 初始化开始');
        try {
            await this.loadBlockedData();
            this.setupTabNavigation();
            this.setupEventListeners();
            this.renderUserList();
            this.renderBoardList();
            this.setupGlobalClickHandler();
            this.updateStats(); // 初始化统计信息
            console.log('BlockManager 初始化完成');
        } catch (error) {
            console.error('BlockManager 初始化错误:', error);
        }
    }

    // ==================== 标签页导航功能 ====================
    setupTabNavigation() {
        console.log('设置标签页导航');
        // 设置用户和版块标签页的切换事件监听器
        document.getElementById('userTabBtn').addEventListener('click', () => {
            console.log('切换到用户标签页');
            this.switchTab('user');
        });
        
        document.getElementById('boardTabBtn').addEventListener('click', () => {
            console.log('切换到版块标签页');
            this.switchTab('board');
        });
    }

    switchTab(tab) {
        // 切换当前显示的标签页（用户/版块）
        this.currentTab = tab;
        
        // 显示/隐藏对应的管理区域
        document.getElementById('userManagement').style.display = 
            tab === 'user' ? 'block' : 'none';
        document.getElementById('boardManagement').style.display = 
            tab === 'board' ? 'block' : 'none';
        
        // 更新标签按钮激活状态
        document.getElementById('userTabBtn').classList.toggle('active', tab === 'user');
        document.getElementById('boardTabBtn').classList.toggle('active', tab === 'board');
        
        // 更新输入框提示
        document.getElementById('itemInput').placeholder = 
            tab === 'user' ? '输入用户名，回车进行添加' : '输入版块名，回车进行添加';
        
        // 不需要更新统计信息，因为统计信息始终显示用户数
    }

    // ==================== 全局点击事件处理 ====================
    setupGlobalClickHandler() {
        // 设置全局点击事件处理，用于关闭打开的菜单
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.function-menu') && !e.target.closest('.function-btn')) {
                this.closeAllMenus();
            }
        });
    }

    closeAllMenus() {
        // 关闭所有打开的下拉菜单
        const menus = document.querySelectorAll('.function-menu');
        menus.forEach(menu => menu.style.display = 'none');
        this.activeMenu = null;
    }

    // ==================== 数据存储与更新 ====================
    async loadBlockedData() {
        // 从本地存储加载屏蔽数据
        const result = await chrome.storage.local.get(['blockedUsers', 'blockedBoards']);
        this.blockedUsers = result.blockedUsers || [];
        this.blockedBoards = result.blockedBoards || [];
        console.log('加载屏蔽数据完成:', {
            users: this.blockedUsers.length,
            boards: this.blockedBoards.length
        });
    }

    async saveBlockedData() {
        // 保存屏蔽数据到本地存储，并通知内容脚本更新
        await chrome.storage.local.set({
            blockedUsers: this.blockedUsers,
            blockedBoards: this.blockedBoards
        });
        
        this.updateStats(); // 每次保存数据后更新统计信息
        
        // 通知内容脚本更新屏蔽数据
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url.includes('cc98.org')) {
            chrome.tabs.sendMessage(tab.id, { 
                action: 'updateBlockedData', 
                users: this.blockedUsers,
                boards: this.blockedBoards
            });
        }
        
        console.log('屏蔽数据保存完成');
    }

    updateStats() {
        // 更新屏蔽统计信息显示 - 始终显示用户数
        const enabledUsers = this.blockedUsers.filter(user => user.enabled).length;
        const blockedCountElement = document.getElementById('blockedCount');
        const statsTextElement = document.getElementById('statsText');
        
        if (blockedCountElement) {
            blockedCountElement.textContent = enabledUsers;
        }
        
        if (statsTextElement) {
            statsTextElement.textContent = `已屏蔽用户: ${enabledUsers} 个`;
        }
        
        console.log('统计信息更新完成:', { enabledUsers });
    }

    // ==================== 事件监听器设置 ====================
    setupEventListeners() {
        console.log('开始设置事件监听器');
        
        // 添加按钮
        const addBtn = document.getElementById('addItemBtn');
        if (addBtn) {
            console.log('找到添加按钮');
            addBtn.addEventListener('click', () => {
                console.log('添加按钮被点击');
                const input = document.getElementById('itemInput');
                if (input) {
                    this.handleAddItem(input.value);
                }
            });
        } else {
            console.error('未找到添加按钮');
        }
        
        // 输入框回车
        const itemInput = document.getElementById('itemInput');
        if (itemInput) {
            console.log('找到输入框');
            itemInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    console.log('输入框回车');
                    this.handleAddItem(e.target.value);
                }
            });
        } else {
            console.error('未找到输入框');
        }
        
        // 导出按钮
        const exportBtn = document.getElementById('exportDataBtn');
        if (exportBtn) {
            console.log('找到导出按钮');
            exportBtn.addEventListener('click', () => {
                console.log('导出按钮被点击');
                this.exportData();
            });
        } else {
            console.error('未找到导出按钮');
        }
        
        // 导入按钮
        const importBtn = document.getElementById('importDataBtn');
        const importFileInput = document.getElementById('importFileInput');
        
        if (importBtn) {
            console.log('找到导入按钮');
            importBtn.addEventListener('click', () => {
                console.log('导入按钮被点击');
                if (importFileInput) {
                    importFileInput.click();
                }
            });
        } else {
            console.error('未找到导入按钮');
        }
        
        if (importFileInput) {
            console.log('找到文件输入框');
            importFileInput.addEventListener('change', (e) => {
                console.log('文件选择变化');
                this.handleFileSelect(e);
            });
        } else {
            console.error('未找到文件输入框');
        }
        
        console.log('事件监听器设置完成');
    }

    // ==================== 数据导出功能 ====================
    exportData() {
        // 导出屏蔽数据为JSON文件
        console.log('开始导出数据');
        const data = {
            version: "1.0",
            pluginVersion: chrome.runtime.getManifest().version,
            timestamp: Date.now(),
            blockedUsers: this.blockedUsers,
            blockedBoards: this.blockedBoards
        };
        
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `cc98_filter_backup_v${data.pluginVersion}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            alert('数据导出成功！文件已保存到下载目录');
            console.log('数据导出完成');
        }, 0);
    }

    handleFileSelect(event) {
        // 处理导入文件选择
        console.log('处理文件选择');
        const file = event.target.files[0];
        if (!file) {
            console.log('未选择文件');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                console.log('文件解析成功');
                
                // 验证数据格式
                if (!data.blockedUsers || !Array.isArray(data.blockedUsers) || 
                    !data.blockedBoards || !Array.isArray(data.blockedBoards)) {
                    throw new Error('无效的备份文件格式，缺少必要数据字段');
                }
                
                // 检查版本兼容性
                if (data.version && parseFloat(data.version) > 1.0) {
                    if (!confirm('警告：备份文件版本高于当前插件版本，导入可能导致数据不兼容。确定要继续吗？')) {
                        return;
                    }
                }
                
                // 询问用户是合并还是覆盖
                const merge = confirm('选择"确定"将合并数据（保留现有数据并添加新数据），选择"取消"将覆盖现有数据（原有数据将丢失）');
                
                if (merge) {
                    // 合并数据 - 保留现有数据中的唯一项
                    const mergedUsers = [...this.blockedUsers];
                    const mergedBoards = [...this.blockedBoards];
                    
                    // 添加新的用户（避免重复）
                    const newUsers = [];
                    data.blockedUsers.forEach(newUser => {
                        if (!mergedUsers.some(u => u.username === newUser.username)) {
                            mergedUsers.push(newUser);
                            newUsers.push(newUser);
                        }
                    });
                    
                    // 添加新的版块（避免重复）
                    const newBoards = [];
                    data.blockedBoards.forEach(newBoard => {
                        if (!mergedBoards.some(b => b.name === newBoard.name)) {
                            mergedBoards.push(newBoard);
                            newBoards.push(newBoard);
                        }
                    });
                    
                    this.blockedUsers = mergedUsers;
                    this.blockedBoards = mergedBoards;
                    
                    alert(`成功合并 ${newUsers.length} 个新用户和 ${newBoards.length} 个新版块`);
                } else {
                    // 直接替换数据
                    this.blockedUsers = data.blockedUsers;
                    this.blockedBoards = data.blockedBoards;
                    alert(`成功覆盖，导入 ${data.blockedUsers.length} 个用户和 ${data.blockedBoards.length} 个版块`);
                }
                
                this.saveBlockedData();
                this.renderUserList();
                this.renderBoardList();
            } catch (error) {
                console.error('导入错误:', error);
                if (error instanceof SyntaxError) {
                    alert('导入失败: 文件格式错误，可能不是有效的JSON文件');
                } else {
                    alert(`导入失败: ${error.message}`);
                }
            }
            
            // 重置文件输入
            event.target.value = '';
        };
        
        reader.readAsText(file);
    }

    // ==================== 处理添加项目的方法 ====================
    handleAddItem(value) {
        if (!value || !value.trim()) {
            console.log('输入值为空，跳过添加');
            return;
        }
        
        console.log('处理添加项目，当前标签页:', this.currentTab, '值:', value);
        
        if (this.currentTab === 'user') {
            this.addUser(value);
        } else {
            this.addBoard(value);
        }
    }

    // ==================== 用户管理功能 ====================
    async addUser(username) {
        // 添加新用户到屏蔽列表
        if (!username.trim()) {
            console.log('用户名为空，跳过添加');
            return;
        }
        
        console.log('尝试添加用户:', username.trim());
        
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
        await this.saveBlockedData(); // 这会触发updateStats
        this.renderUserList();
        
        // 清空输入框
        const input = document.getElementById('itemInput');
        if (input) {
            input.value = '';
        }
        
        console.log('用户添加成功:', username.trim());
    }

    async toggleUser(username, enabled) {
        // 切换用户屏蔽状态（启用/禁用）
        const user = this.blockedUsers.find(user => user.username === username);
        if (user) {
            user.enabled = enabled;
            if (enabled) {
                user.lastBlockTime = Date.now();
            }
            await this.saveBlockedData(); // 这会触发updateStats
            this.renderUserList();
            console.log('用户状态切换:', username, enabled);
        }
    }

    async removeUser(username) {
        // 从屏蔽列表中移除用户
        this.blockedUsers = this.blockedUsers.filter(user => user.username !== username);
        await this.saveBlockedData(); // 这会触发updateStats
        this.renderUserList();
        console.log('用户移除成功:', username);
    }

    renderUserList() {
        // 渲染用户屏蔽列表
        const container = document.getElementById('userListContainer');
        if (!container) {
            console.error('未找到用户列表容器');
            return;
        }
        
        if (this.blockedUsers.length === 0) {
            container.innerHTML = '<div class="empty-list">暂无屏蔽用户</div>';
            console.log('用户列表为空');
            return;
        }

        container.innerHTML = this.blockedUsers.map(user => `
            <div class="item">
                <!-- 第一列：用户名和标签 -->
                <div class="item-col item-col-left">
                    <div class="item-name">${this.escapeHtml(user.username)}</div>
                    ${user.customLabel ? `<div class="item-label">${this.escapeHtml(this.truncateLabel(user.customLabel))}</div>` : ''}
                </div>
                
                <!-- 第二列：开关和功能键 -->
                <div class="item-col item-col-center">
                    <label class="toggle-switch">
                        <input type="checkbox" ${user.enabled ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                    <div class="function-container">
                        <button class="function-btn" data-username="${user.username}">···</button>
                        <div class="function-menu" id="menu-user-${user.username}">
                            <div class="menu-item" data-action="remove" data-type="user" data-id="${user.username}">移除</div>
                            <div class="menu-item" data-action="label" data-type="user" data-id="${user.username}">设置标签</div>
                        </div>
                    </div>
                </div>
                
                <!-- 第三列：时间信息 -->
                <div class="item-col item-col-right">
                    <div class="time-info">
                        <div class="time-line">首次: ${this.formatTime(user.firstBlockTime)}</div>
                        <div class="time-line">最新: ${this.formatTime(user.lastBlockTime)}</div>
                    </div>
                </div>
            </div>
        `).join('');

        // 绑定事件监听器
        this.attachItemEventListeners(container, 'user');
        console.log('用户列表渲染完成，项目数:', this.blockedUsers.length);
    }

    // ==================== 版块管理功能 ====================
    async addBoard(boardName) {
        // 添加新版块到屏蔽列表
        if (!boardName.trim()) {
            console.log('版块名为空，跳过添加');
            return;
        }
        
        console.log('尝试添加版块:', boardName.trim());
        
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
        await this.saveBlockedData(); // 这会触发updateStats
        this.renderBoardList();
        
        // 清空输入框
        const input = document.getElementById('itemInput');
        if (input) {
            input.value = '';
        }
        
        console.log('版块添加成功:', boardName.trim());
    }

    async toggleBoard(boardName, enabled) {
        // 切换版块屏蔽状态（启用/禁用）
        const board = this.blockedBoards.find(board => board.name === boardName);
        if (board) {
            board.enabled = enabled;
            if (enabled) {
                board.lastBlockTime = Date.now();
            }
            await this.saveBlockedData(); // 这会触发updateStats
            this.renderBoardList();
            console.log('版块状态切换:', boardName, enabled);
        }
    }

    async removeBoard(boardName) {
        // 从屏蔽列表中移除版块
        this.blockedBoards = this.blockedBoards.filter(board => board.name !== boardName);
        await this.saveBlockedData(); // 这会触发updateStats
        this.renderBoardList();
        console.log('版块移除成功:', boardName);
    }

    renderBoardList() {
        // 渲染版块屏蔽列表
        const container = document.getElementById('boardListContainer');
        if (!container) {
            console.error('未找到版块列表容器');
            return;
        }
        
        if (this.blockedBoards.length === 0) {
            container.innerHTML = '<div class="empty-list">暂无屏蔽版块</div>';
            console.log('版块列表为空');
            return;
        }

        container.innerHTML = this.blockedBoards.map(board => `
            <div class="item">
                <!-- 第一列：版块名 -->
                <div class="item-col item-col-left">
                    <div class="item-name">${this.escapeHtml(board.name)}</div>
                </div>
                
                <!-- 第二列：开关和功能键 -->
                <div class="item-col item-col-center">
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
                
                <!-- 第三列：时间信息 -->
                <div class="item-col item-col-right">
                    <div class="time-info">
                        <div class="time-line">首次: ${this.formatTime(board.firstBlockTime)}</div>
                        <div class="time-line">最新: ${this.formatTime(board.lastBlockTime)}</div>
                    </div>
                </div>
            </div>
        `).join('');

        // 绑定事件监听器
        this.attachItemEventListeners(container, 'board');
        console.log('版块列表渲染完成，项目数:', this.blockedBoards.length);
    }

    // ==================== 事件监听器绑定 ====================
    attachItemEventListeners(container, type) {
        console.log(`绑定${type}列表事件监听器`);
        
        // 开关事件
        container.querySelectorAll('.toggle-switch input').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const item = e.target.closest('.item');
                let id;
                
                if (type === 'user') {
                    const btn = item.querySelector('.function-btn');
                    if (!btn) return;
                    id = btn.dataset.username;
                    this.toggleUser(id, e.target.checked);
                } else {
                    const btn = item.querySelector('.function-btn');
                    if (!btn) return;
                    id = btn.dataset.boardname;
                    this.toggleBoard(id, e.target.checked);
                }
            });
        });

        // 功能按钮事件
        container.querySelectorAll('.function-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = type === 'user' ? e.target.dataset.username : e.target.dataset.boardname;
                this.toggleFunctionMenu(`${type}-${id}`, e);
            });
        });

        // 菜单项事件
        container.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.target.dataset.id;
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

    // ==================== 菜单和辅助功能 ====================
    toggleFunctionMenu(id, event) {
        // 切换功能菜单的显示状态
        event.stopPropagation();
        
        if (this.activeMenu && this.activeMenu !== id) {
            this.closeAllMenus();
        }

        const menu = document.getElementById(`menu-${id}`);
        if (!menu) {
            console.error(`未找到菜单: menu-${id}`);
            return;
        }
        
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
        // 为屏蔽用户设置自定义提示标签
        const user = this.blockedUsers.find(user => user.username === username);
        if (!user) {
            console.error(`未找到用户: ${username}`);
            return;
        }
        
        const currentLabel = user.customLabel || '此用户的内容已被屏蔽';
        
        const newLabel = prompt(`为用户 "${username}" 设置自定义提示文字：`, currentLabel);
        if (newLabel !== null) {
            user.customLabel = newLabel.trim() || '此用户的内容已被屏蔽';
            await this.saveBlockedData(); // 这会触发updateStats
            this.renderUserList();
        }
        
        this.closeAllMenus();
    }

    formatTime(timestamp) {
        // 格式化时间戳为可读日期
        return new Date(timestamp).toLocaleDateString('zh-CN');
    }

    escapeHtml(text) {
        // HTML转义，防止XSS攻击
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    truncateLabel(label, maxLength = 20) {
        // 截断长标签文本
        if (label.length <= maxLength) {
            return label;
        }
        return label.substring(0, maxLength) + '...';
    }
}

// 初始化BlockManager
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM 加载完成，初始化 BlockManager');
        new BlockManager();
    });
} else {
    console.log('DOM 已就绪，直接初始化 BlockManager');
    new BlockManager();
}