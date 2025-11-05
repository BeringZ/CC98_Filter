
chrome.runtime.onInstalled.addListener(() => {
    console.log('CC98过滤助手已安装');
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url.includes('cc98.org')) {
        // 内容脚本会自动运行，这里可以添加其他逻辑
    }
});