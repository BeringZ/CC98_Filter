// 后台脚本 - 目前主要用于监听扩展安装事件
chrome.runtime.onInstalled.addListener(() => {
    console.log('CC98过滤助手已安装');
});

// 监听标签页更新，在页面加载时注入内容脚本
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url.includes('cc98.org')) {
        // 内容脚本会自动运行，这里可以添加其他逻辑
    }
});