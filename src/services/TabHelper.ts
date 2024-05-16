import Logger from '~services/Logger';

const isBackgroundScript = () => {
	if (typeof chrome?.extension?.getBackgroundPage === 'function') {
		// https://stackoverflow.com/questions/16267668/can-js-code-in-chrome-extension-detect-that-its-executed-as-content-script
		// detect where code is running from, is it content script, popup or background?
		// thats important to know if all 3 context call the same functions, that shared function has
		// to know the context so it can work properly based on the context

		// we know we are on background script if getBackgroundPage === window
		return chrome.extension.getBackgroundPage() === window;
	}
	return false;
};

const getActiveTab = (isBgScript): Promise<chrome.tabs.Tab> =>
	new Promise((res, rej) => {
		try {
			if (isBgScript) {
				chrome.tabs.query({ active: true, currentWindow: true }, ([activeTab]) => {
					Logger.logInfo(activeTab);
					res(activeTab);
				});
			} else {
				chrome.runtime.sendMessage({ message: 'getActiveTab' }, ({ /** @type {chrome.tabs.Tab} */ data }) => {
					res(data);
				});
			}
		} catch (error) {
			rej(error);
			Logger.logError(error);
		}
	});

/**
 * Function to get the origin URL of the provided tab or the active tab if the tab is null.
 * @param {chrome.tabs.Tab} [tab] - The tab object.
 * @returns {Promise<string>} - A promise that resolves to the origin URL of the tab.
 */
const getTabOrigin = async (tab) => {
	try {
		// If tab is not provided, get the active tab.
		const activeTab = tab || (await getActiveTab(true)); // Assuming this is called from a background script
		if (!activeTab.url) {
			throw new Error('Active tab does not have a URL.');
		}
		const url = new URL(activeTab.url);
		return url.origin;
	} catch (err) {
		Logger.LogLastError(err);
		throw err;
	}
};

export default { getActiveTab, getTabOrigin, isBackgroundScript };
