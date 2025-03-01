import { useEffect, useState } from 'react';

import RatingPrompt from '~popup/rating';
import AdvancedSettings from "~popup/components/advancedSettings";
import Logger from '~services/Logger';
import TabHelper from '~services/TabHelper';
import usePrefs from '~services/usePrefs';

import arrowDownImage from '../../assets/images/arrow_down.png';
import reloadImage from '../../assets/images/reload.png';
import unsupportedImage from '../../assets/images/unsupported.png';

import './../styles/style.css';
import './../styles/toggle.scss';
import './../styles/error.css';

import { useStorage } from '@plasmohq/storage/hook';
import type { Prefs, TabSession } from 'index';

import {
	APP_PREFS_STORE_KEY,
	COLOR_MODE_STATE_TRANSITIONS,
	DisplayColorMode,
	MaxSaccadesInterval,
	SACCADE_COLORS,
	SACCADE_STYLES,
	STORAGE_AREA,
} from '~services/config';
import documentParser from '~services/documentParser';
import defaultPrefs from '~services/preferences';
import runTimeHandler from '~services/runTimeHandler';

import Shortcut, { useShowDebugSwitch } from './shorcut';

const popupLogStyle = 'background:cyan;color:brown';

const { setAttribute, setProperty, getProperty, getAttribute, setSaccadesStyle } = documentParser.makeHandlers(document);

const FIXATION_OPACITY_STOPS = 5;
const FIXATION_OPACITY_STOP_UNIT_SCALE = Math.floor(100 / FIXATION_OPACITY_STOPS);
//1 day
const SHOW_RATING_AFTER_INTERVAL = 24 * 60 * 60 * 1000;

function PopupPage() {
	const [activeTab, setActiveTab] = useState({} as chrome.tabs.Tab);
	const [showRating, setShowRating] = useState(false);
	const [appConfigPrefs, setAppConfigPrefs] = useStorage<Prefs>(APP_PREFS_STORE_KEY);
	const [prefs, setPrefs] = usePrefs(async () => await TabHelper.getTabOrigin(await TabHelper.getActiveTab(true)), true, process.env.TARGET);
	const [tabSession, setTabSession] = useState<TabSession>(null);
	const [showMessage, setShowMessage] = useState(false);
	const [showTurnOffMessage, setTurnOffMessage] = useState(false);
	const errorOccured = !prefs || !tabSession;
	const [showAdvancedSettingsButton, setShowAdvancedSettingsButton] = useState(false);

	//rating prompt
	useEffect(() => {
		handleIncrementCounter();
		handleIntervalCounter();
	}, []);

	const handleIncrementCounter = () => {
		const ratingKey = 'ratingCounter';
		if (!localStorage.getItem(ratingKey)) {
			localStorage.setItem(ratingKey, String(1));
		}
		var ratingCounter: number = Number(localStorage.getItem(ratingKey));
		localStorage.setItem(ratingKey, String(ratingCounter + 1));
		if (ratingCounter >= 4) {
			setShowRating(true);
		}
	};

	const handleIntervalCounter = () => {
		const installDateKey = 'installDate';
		if (!localStorage.getItem(installDateKey)) {
			localStorage.setItem(installDateKey, new Date().toISOString());
		}

		const installDate = localStorage.getItem(installDateKey);
		if (installDate) {
			const installTime = new Date(installDate).getTime();
			const currentTime = new Date().getTime();
			const threeDaysInMs = SHOW_RATING_AFTER_INTERVAL;

			if (currentTime - installTime > threeDaysInMs) {
				setShowRating(true);
			}
		}
	};

	const handleCloseRatingPrompt = () => {
		setShowRating(false);
	};

	useEffect(() => {
		if (!tabSession) return;
		documentParser.setReadingMode(tabSession.brMode, document, '');
	}, [tabSession]);

	useEffect(() => {
		if (!appConfigPrefs?.transformControlPanelText || !prefs) return;

		setProperty('--fixation-edge-opacity', prefs.fixationEdgeOpacity + '%');
		setSaccadesStyle(prefs.saccadesStyle);
		setAttribute('saccades-color', prefs.saccadesColor);
		setAttribute('fixation-strength', prefs.fixationStrength);
		setAttribute('saccades-interval', prefs.saccadesInterval);
	}, [prefs]);

	useEffect(() => {
		(async () => {
			const _activeTab = await TabHelper.getActiveTab(true);
			setActiveTab(_activeTab);
			Logger.logInfo('%cactiveTab', popupLogStyle, _activeTab);

			const origin = await TabHelper.getTabOrigin(_activeTab);

			chrome.tabs.sendMessage(_activeTab.id, { type: 'getReadingMode' }, ({ data }) => {
				setTabSession({ brMode: data, origin });
			});
		})();

		runTimeHandler.runtime.onMessage.addListener((request, sender, sendResponse) => {
			Logger.logInfo('PopupMessageListenerFired PopupPage');

			switch (request.message) {
				case 'setIconBadgeText': {
					setTabSession((oldTabSession) => ({
						...oldTabSession,
						brMode: request.data,
					}));
					break;
				}
				default: {
					break;
				}
			}
		});
	}, []);

	useEffect(() => {
		let timer;
		if (showMessage) {
			timer = setTimeout(() => {
				setShowMessage(false);
			}, 15000);
		}
		return () => clearTimeout(timer);
	}, [showMessage]);

	useEffect(() => {
		let timer;
		if (showTurnOffMessage) {
			timer = setTimeout(() => {
				setTurnOffMessage(false);
			}, 5000);
		}
		return () => clearTimeout(timer);
	}, [showTurnOffMessage]);

	const makeUpdateChangeEventHandler =
		(field: string) =>
		(event, customValue = null) =>
			updateConfig(field, customValue ?? event.target.value);

	const updateConfig = (key: string, value: any, configLocal = prefs) => {
		const newConfig = { ...configLocal, [key]: value };
		setPrefs(async () => await TabHelper.getTabOrigin(await TabHelper.getActiveTab(true)), newConfig.scope, newConfig);
	};

	const handleToggle = (newBrMode: boolean) => {
		const payloadTab = {
			type: 'setReadingMode',
			data: newBrMode,
		};

		const payloadBadge = {
			message: 'setIconBadgeText',
			data: newBrMode,
			tabID: tabSession.tabID,
		};

		setTabSession({ ...tabSession, brMode: newBrMode });
		(runTimeHandler as typeof chrome).runtime.sendMessage(payloadBadge, () => Logger.LogLastError());

		TabHelper.getActiveTab(true).then((tab) => chrome.tabs.sendMessage(tab.id, payloadTab, () => Logger.LogLastError()));
	};

	const showOptimal = (key: string, value = null) => {
		if (!prefs) return null;

		if ((value ?? prefs?.[key]) == defaultPrefs?.[key]) return <span className="ml-auto text-sm">Optimal</span>;
	};

	const handleDisplayColorModeChange = async (currentDisplayColorMode) => {
		if (![...Object.values(DisplayColorMode)].includes(currentDisplayColorMode)) {
			alert('not allowed');
			return;
		}

		const [, displayColorMode] = COLOR_MODE_STATE_TRANSITIONS.find(([key]) => new RegExp(currentDisplayColorMode, 'i').test(key));

		await setAppConfigPrefs({ ...appConfigPrefs, displayColorMode });
	};

	 const getFooterLinks = (textColor = 'text-secondary') => (
		<>
			<div className="flex justify-between align-items-center h-100 text-center text-md text-bold w-full gap-3">
				<a
					className={`flex align-items-center h-60 ${textColor} text-uppercase`}
					href="https://github.com/ahichkalau/halfbold#FAQ"
					target="_blank">
					{chrome.i18n.getMessage('faqLinkText')}
				</a>

				<a
					className={`flex align-items-center h-60 ${textColor} text-capitalize`}
					href="https://docs.google.com/forms/d/e/1FAIpQLSfOMOjnKxcymYTHIppwT2TTFGVrMYhXcNtSre0OAuNDj9-M3A/viewform"
					target="_blank">
					{chrome.i18n.getMessage('reportIssueLinkText')}
				</a>
				<div className="toggle flex align-items-center h-60">
					<label className="toggle_label">
						<input
							className="toggle_input"
							type="checkbox"
							value={`${Object.fromEntries(COLOR_MODE_STATE_TRANSITIONS)[appConfigPrefs?.displayColorMode]} mode toggle`}
							onChange={() => handleDisplayColorModeChange(appConfigPrefs.displayColorMode)}
							aria-description="light mode dark mode toggle"
							id="display_mode_switch"
							checked={appConfigPrefs?.displayColorMode === 'light'}
						/>
						<span className="toggle_slider"></span>
					</label>
				</div>
			</div>
		</>
	);

	const reloadActiveTab = async (_activeTab = activeTab) => {
		await chrome.tabs.reload(_activeTab.id);
	};

	const openPermissionPage = () => {
		chrome.tabs.create({
			url: 'chrome://extensions/?id=ndgbjebkdbfehipdojkdldkddgggbdoj',
		});
	};

	const openSidePanel = async () => {
		const tab = await TabHelper.getActiveTab(true)
		await chrome.sidePanel.open({ tabId: tab.id });
		await chrome.sidePanel.setOptions({
			tabId: tab.id,
			path: chrome.runtime.getURL("sidepanel.html"),
			enabled: true
		});
		await chrome.extension.getViews({type: 'popup'}).forEach(v => v.close());
	};

	const showFileUrlPermissionRequestMessage = (tabSession: TabSession, prefs, _activeTab = activeTab) => {
		if (!/chrome/i.test(process.env.TARGET) || !/^file:\/\//i.test(tabSession?.origin ?? activeTab?.url) || prefs) {
			return null;
		}

		return (
			<>
				<h2>{chrome.i18n.getMessage('missingPermissionHeaderText')}</h2>
				<span>{chrome.i18n.getMessage('missingPermissionHeaderSubText')}</span>
				<ol className="|| flex flex-column || m-0 p-3">
					<li>
						<button className="text-capitalize" onClick={openPermissionPage}>
							{chrome.i18n.getMessage('openPermissionPageBtnText')}
						</button>
					</li>
					<li>{chrome.i18n.getMessage('grantPermissionInstructionText')}</li>
					<li>{chrome.i18n.getMessage('reloadPageAndExtensionInstructionText')}</li>
				</ol>
			</>
		);
	};

	const showUnsupportedPageErrorMessage = (_activeTab = activeTab) => {
		if (!/^chrome|edge(:\/\/|[-]extension)|chrome\.google\.com\/webstore|chromewebstore\.google\.com/i.test(_activeTab?.url)) return null;

		return (
			<>
				<div className="container">
					<img src={unsupportedImage} alt="Unsupported" />
				</div>
			</>
		);
	};

	const showPageNotDetectedErrorMessage = () => {
		return (
			<>
				<img src={reloadImage} alt="Reload" />
				<button className="text-capitalize" style={{ fontSize: '1.6rem' }} onClick={() => reloadActiveTab()}>
					{chrome.i18n.getMessage('reloadText')}
				</button>
			</>
		);
	};

	const showErrorMessage = () => {
		return (
			<>
				<div className="flex flex-column gap-1">
					<>{showFileUrlPermissionRequestMessage(tabSession, prefs) || showUnsupportedPageErrorMessage() || showPageNotDetectedErrorMessage()}</>
				</div>
				<button
					id="openSidePanel"
					className="|| flex flex-column || w-100 align-items-center text-capitalize"
					onClick={() => {openSidePanel()}}>
					Open side panel
				</button>
				<footer style={{ marginTop: '20px' }} className="popup_footer || flex flex-column || gap-1">
					{getFooterLinks()}
				</footer>
			</>
		);
	};

	const toggleAdvancedSettings = () => {
		setShowAdvancedSettingsButton(!showAdvancedSettingsButton);
	};


	return (
		<div className={`jr_wrapper_container ${appConfigPrefs?.displayColorMode}-mode text-capitalize`}>
			<div className="popup-body || flex flex-column || text-alternate">
				{errorOccured ? (
					showErrorMessage()
				) : (
					<div className={`popup-container || flex flex-column ${appConfigPrefs?.displayColorMode}-mode | gap-1`}>
						<button
							id="readingModeToggleBtn"
							className={`|| flex flex-column || w-100 align-items-center text-capitalize ${tabSession?.brMode ? 'selected' : ''}`}
							onClick={() => {
								setTurnOffMessage(prefs.onPageLoad && tabSession?.brMode);
								handleToggle(!tabSession.brMode);
							}}>
							<span>{chrome.i18n.getMessage(tabSession?.brMode ? 'onOffToggleBtnTextDisable' : 'onOffToggleBtnTextEnable')}</span>
							<span>{chrome.i18n.getMessage('onOffToggleBtnSubText')}</span>
							<Shortcut />
						</button>
						{showTurnOffMessage && (
							<>
								<label style={{ fontSize: '6vw' }} className="w-30 mb-sm responsive-label">
									{chrome.i18n.getMessage('localModeTip')}
								</label>
								<img src={arrowDownImage} alt="arrowDown" width="80px" height="80px" style={{ display: 'block', margin: 'auto' }} />
							</>
						)}

						<button
							id="onPageLoadBtn"
							className={`|| flex flex-column || w-100 align-items-center text-capitalize ${prefs.onPageLoad ? 'selected' : ''}`}
							onClick={() => {
								setShowMessage(!prefs.onPageLoad && !tabSession?.brMode);
								updateConfig('onPageLoad', !prefs.onPageLoad);
							}}>
							<span className="text-bold">
								{chrome.i18n.getMessage(prefs.onPageLoad ? 'defaultBionicModeToggleBtnOffText' : 'defaultBionicModeToggleBtnOnText')}
							</span>
							<span>{chrome.i18n.getMessage('defaultBionicModeToggleBtnSubText')}</span>
						</button>
						{showMessage && (
							<>
								<label className="info_label mb-sm">{chrome.i18n.getMessage('reloadForReadingMode')}</label>
								<button
									className="text-capitalize"
									style={{ fontSize: '1.6rem' }}
									onClick={() => {
										reloadActiveTab();
										setShowMessage(false);
									}}>
									{chrome.i18n.getMessage('reloadText')}
								</button>
							</>
						)}

						<button
							className="|| flex flex-column || w-100 align-items-center text-capitalize"
							onClick={toggleAdvancedSettings}>
							<span className="text-bold">{chrome.i18n.getMessage('advancedSettings')}</span>
						</button>

						<button
							id="openSidePanel"
							style={{ marginBottom: '10px' }}
							className="|| flex flex-column || w-100 align-items-center text-capitalize"
							onClick={() => {openSidePanel()}}>
							Open side panel
						</button>

						{showAdvancedSettingsButton && <AdvancedSettings prefs={prefs} makeUpdateChangeEventHandler={makeUpdateChangeEventHandler} updateConfig={updateConfig} />}

						{showRating && <RatingPrompt onClose={handleCloseRatingPrompt} />}
					</div>
				)}
				{!errorOccured && <footer className="popup_footer || flex flex-column || gap-1">{getFooterLinks()}</footer>}
			</div>
		</div>
	);
}

export default PopupPage;
