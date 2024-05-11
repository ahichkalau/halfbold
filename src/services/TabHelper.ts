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
 * Gets the origin of the provided tab, or the active tab if the provided tab is null.
 * @param {chrome.tabs.Tab | null} tab - The tab whose origin is to be fetched, or null to fetch the active tab's origin.
 * @returns {Promise<string>} A promise that resolves to the origin of the tab.
 */
const getTabOrigin = async (tab = null) => {
	return new Promise(async (resolve, reject) => {
		try {
			// If tab is null, fetch the active tab
			if (!tab) {
				const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
				tab = activeTab;
			}

			// Send message to the content script to get the origin
			chrome.tabs.sendMessage(tab.id, { type: 'getOrigin' }, (response) => {
				// Check for errors after message passing
				if (chrome.runtime.lastError) {
					Logger.logError(chrome.runtime.lastError.message);

					if (tab.url.startsWith('chrome://')) {
						Logger.logError('Cannot receive access to chrome://');
					} else {
						Logger.logError('Cannot receive access to ${tab.url}');
					}
					return;
				}

				// Check if response is defined and has data
				if (response && response.data) {
					resolve(response.data);
				} else {
					reject(new Error('No data received from the content script'));
				}
			});
		} catch (err) {
			Logger.LogLastError(err);
			reject(err);
		}
	});
};

export default { getActiveTab, getTabOrigin, isBackgroundScript };
