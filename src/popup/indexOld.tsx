import { useEffect, useState } from 'react';

import RatingPrompt from '~popup/rating';
import Logger from '~services/Logger';
import TabHelper from '~services/TabHelper';
import usePrefs from '~services/usePrefs';

import './../styles/style.css';
import './../styles/toggle.scss';
import './../styles/error.css';

import { useStorage } from '@plasmohq/storage';
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

const SHOW_FOOTER_MESSAGE_DURATION = 12_000;
const FOOT_MESSAGAES_ANIMATION_DELAY = 300;
const FIRST_FOOTER_MESSAGE_INDEX = 1;

function IndexPopupOld() {
	const [activeTab, setActiveTab] = useState({} as chrome.tabs.Tab);
	const [footerMessageIndex, setFooterMeessageIndex] = useState(null);
	const [isDebugDataVisible, setIsDebugDataVisible] = useShowDebugSwitch();
	const [showRating, setShowRating] = useState(false);
	const [counter, setCounter] = useState(0);
	const handleIncrementCounter = () => {
		setCounter((prevCounter) => prevCounter + 1);
		if (counter >= 4) {
			setShowRating(true);
		}
	};

	const handleCloseRatingPrompt = () => {
		setShowRating(false);
	};
	const [prefs, setPrefs] = usePrefs(async () => await TabHelper.getTabOrigin(await TabHelper.getActiveTab(true)), true, process.env.TARGET);

	const [tabSession, setTabSession] = useState<TabSession>(null);

	const [appConfigPrefs, setAppConfigPrefs] = useStorage<Prefs>({
		key: APP_PREFS_STORE_KEY,
		area: STORAGE_AREA,
	});

	const footerMessagesLength = 3;
	const nextMessageIndex = (oldFooterMessageIndex) =>
		typeof oldFooterMessageIndex !== 'number' ? FIRST_FOOTER_MESSAGE_INDEX : (oldFooterMessageIndex + 1) % footerMessagesLength;

	useEffect(() => {
		if (!tabSession) return;

		documentParser.setReadingMode(tabSession.brMode, document, '');
	}, [tabSession]);

	useEffect(() => {
		Logger.logInfo('%cprefstore updated', popupLogStyle, prefs);

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

			const brMode = chrome.tabs.sendMessage(_activeTab.id, { type: 'getReadingMode' }, ({ data }) => {
				setTabSession({ brMode: data, origin });
			});
		})();

		runTimeHandler.runtime.onMessage.addListener((request, sender, sendResponse) => {
			Logger.logInfo('PopupMessageListenerFired');

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

		let footerInterval;

		setTimeout(() => {
			setFooterMeessageIndex(nextMessageIndex);

			footerInterval = setInterval(() => {
				setFooterMeessageIndex(nextMessageIndex);
			}, SHOW_FOOTER_MESSAGE_DURATION);
		}, FOOT_MESSAGAES_ANIMATION_DELAY);

		return () => {
			clearInterval(footerInterval);
		};
	}, []);

	const makeUpdateChangeEventHandler =
		(field: string) =>
		(event, customValue = null) =>
			updateConfig(field, customValue ?? event.target.value);

	const updateConfig = (key: string, value: any, configLocal = prefs) => {
		const newConfig = { ...configLocal, [key]: value };

		setPrefs(async () => await TabHelper.getTabOrigin(await TabHelper.getActiveTab(true)), newConfig.scope, newConfig);
	};

	const handleToggle = (newBrMode: boolean) => {
		const payload = {
			type: 'setReadingMode',
			message: 'setIconBadgeText',
			data: newBrMode,
		};
		handleIncrementCounter();
		setTabSession({ ...tabSession, brMode: newBrMode });
		(runTimeHandler as typeof chrome).runtime.sendMessage(payload, () => Logger.LogLastError());

		TabHelper.getActiveTab(true).then((tab) => chrome.tabs.sendMessage(tab.id, payload, () => Logger.LogLastError()));
	};

	const showOptimal = (key: string, value = null) => {
		if (!prefs) return null;

		if ((value ?? prefs?.[key]) == defaultPrefs?.[key]) return <span className="ml-auto text-sm">Optimal</span>;
	};

	const handleDisplayColorModeChange = async (currentDisplayColorMode) => {
		console.log('handleDisplayColorModeChange', currentDisplayColorMode);

		if (![...Object.values(DisplayColorMode)].includes(currentDisplayColorMode)) {
			alert('not allowed');
			return;
		}

		const [, displayColorMode] = COLOR_MODE_STATE_TRANSITIONS.find(([key]) => new RegExp(currentDisplayColorMode, 'i').test(key));

		await setAppConfigPrefs({ ...appConfigPrefs, displayColorMode });
		console.log('handleDisplayColorModeChange', appConfigPrefs);
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
							onClick={() => handleDisplayColorModeChange(appConfigPrefs.displayColorMode)}
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

	const showDebugInline = (environment = 'production') => {
		if (/production/i.test(environment)) return;

		const debugData = (
			<>
				<span className="w-full">tabSession {JSON.stringify(tabSession)}</span>
				<span className="w-full">prefs: {JSON.stringify(prefs)}</span>
				<span className="w-full">appConfigPrefs: {JSON.stringify(appConfigPrefs)}</span>
				<span className="w-full">footerMessageIndex: {footerMessageIndex}</span>
			</>
		);

		return (
			<div className=" || flex flex-column || w-full text-wrap p-1">
				<label htmlFor="isDebugDataVisibleInput">
					show
					<input
						type="checkbox"
						name="isDebugDataVisibleInput"
						id="isDebugDataVisibleInput"
						onChange={(event) => setIsDebugDataVisible(event.currentTarget.checked)}
						checked={isDebugDataVisible}
					/>
				</label>
				{isDebugDataVisible && debugData}
			</div>
		);
	};

	const reloadActiveTab = async (_activeTab = activeTab) => {
		await chrome.tabs.reload(_activeTab.id);
	};

	const openPermissionPage = () => {
		chrome.tabs.create({
			url: 'chrome://extensions/?id=ndgbjebkdbfehipdojkdldkddgggbdoj',
		});
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
		if (!/^chrome(:\/\/|[-]extension)/i.test(_activeTab?.url)) return null;

		return (
			<>
				<div className="container">
					<div className="col-sm-12">
						<div
							className="alert fade alert-simple alert-warning alert-dismissible text-left font__family-montserrat font__size-16 font__weight-light brk-library-rendered rendered show"
							role="alert"
							data-brk-library="component__alert">
							<strong className="font__weight-semibold text-center">Warning!</strong>
							<p className="errorMessage m-0">{chrome.i18n.getMessage('pageNotSupportedHeaderText')}</p>
							<p className="errorMessage m-1">{chrome.i18n.getMessage('reloadPromptText')}</p>
						</div>
					</div>
				</div>
			</>
		);
	};

	const showPageNotDetectedErrorMessage = () => {
		return (
			<>
				<div className="container">
					<div className="col-sm-12">
						<div
							className="alert fade alert-simple alert-warning alert-dismissible text-left font__family-montserrat font__size-16 font__weight-light brk-library-rendered rendered show"
							role="alert"
							data-brk-library="component__alert">
							<strong className="font__weight-semibold">Warning!</strong> {chrome.i18n.getMessage('pageNotDetectedText')}
						</div>
					</div>
				</div>
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
				<footer style={{ marginTop: '20px' }} className="popup_footer || flex flex-column || gap-1">
					{getFooterLinks()}
				</footer>
			</>
		);
	};

	const errorOccured = !prefs || !tabSession;

	const showAdvancedSettings = () => {
		return (
			<>
				<div className="flex flex-column">
					<div className="flex w-100 justify-between">
						<div className="w-100 pr-mr">
							<button
								id="globalPrefsBtn"
								data-scope="global"
								className={`|| flex flex-column align-items-center || w-100 text-capitalize ${/global/i.test(prefs.scope) ? 'selected' : ''}`}
								onClick={(event) => updateConfig('scope', 'global')}>
								<span>{chrome.i18n.getMessage('globalPreferenceToggleBtnText')}</span>
								<span className="text-sm pt-sm">{chrome.i18n.getMessage('globalPreferenceToggleBtnSubText')}</span>
							</button>
						</div>

						<div className="w-100 pl-md">
							<button
								id="localPrefsBtn"
								data-scope="local"
								className={`|| flex flex-column align-items-center || w-100 text-capitalize ${/local/i.test(prefs.scope) ? 'selected' : ''}`}
								onClick={(event) => updateConfig('scope', 'local')}>
								<span>{chrome.i18n.getMessage('sitePreferenceToggleBtnText')}</span>
								<span className="text-sm pt-sm">{chrome.i18n.getMessage('sitePreferenceToggleBtnSubText')}</span>
							</button>
						</div>
					</div>
				</div>

				<div className="w-100">
					<label className="block text-capitalize">
						{chrome.i18n.getMessage('saccadesIntervalLabel')}: <span id="saccadesLabelValue">{prefs.saccadesInterval}</span>{' '}
						{showOptimal('saccadesInterval')}
					</label>

					<div className="slidecontainer">
						<input
							type="range"
							min="0"
							max={MaxSaccadesInterval - 1}
							value={prefs.saccadesInterval}
							onChange={makeUpdateChangeEventHandler('saccadesInterval')}
							className="slider w-100"
							id="saccadesSlider"
						/>

						<datalist id="saccadesSlider" className="|| flex justify-between || text-sm ">
							{new Array(prefs.MAX_FIXATION_PARTS).fill(null).map((_, index) => (
								<option key={`saccades-interval-${index}`} value={index + 1} label={'' + index}></option>
							))}
						</datalist>
					</div>
				</div>

				<div className="w-100">
					<label className="block text-capitalize">
						{chrome.i18n.getMessage('fixationsStrengthLabel')}: <span id="fixationStrengthLabelValue">{prefs.fixationStrength}</span>{' '}
						{showOptimal('fixationStrength')}
					</label>

					<div className="slidecontainer">
						<input
							type="range"
							min="1"
							max={prefs.MAX_FIXATION_PARTS}
							value={prefs.fixationStrength}
							onChange={makeUpdateChangeEventHandler('fixationStrength')}
							className="slider w-100"
							id="fixationStrengthSlider"
						/>

						<datalist id="fixationStrengthSlider" className="|| flex justify-between || text-sm ">
							{new Array(prefs.MAX_FIXATION_PARTS).fill(null).map((_, index) => (
								<option key={`fixation-strength-${index}`} value={index + 1} label={'' + (index + 1)}></option>
							))}
						</datalist>
					</div>
				</div>

				<div className="w-100">
					<label className="block text-capitalize">
						{chrome.i18n.getMessage('fixationsEdgeOpacityLabel')}: <span id="fixationOpacityLabelValue">{prefs.fixationEdgeOpacity}%</span>{' '}
						{showOptimal('fixationEdgeOpacity')}
					</label>

					<div className="slidecontainer">
						<input
							type="range"
							min="0"
							max="100"
							value={prefs.fixationEdgeOpacity}
							onChange={makeUpdateChangeEventHandler('fixationEdgeOpacity')}
							className="slider w-100"
							id="fixationEdgeOpacitySlider"
							list="fixationEdgeOpacityList"
							step="10"
						/>

						<datalist id="fixationEdgeOpacityList" className="|| flex justify-between || text-sm ">
							{new Array(FIXATION_OPACITY_STOPS + 1)
								.fill(null)
								.map((_, stopIndex) => stopIndex * FIXATION_OPACITY_STOP_UNIT_SCALE)
								.map((value) => (
									<option key={`opacity-stop-${value}`} value={value} label={'' + value}></option>
								))}
						</datalist>
					</div>
				</div>

				<div className="|| flex flex-column || w-100 gap-1">
					<label className="text-dark text-capitalize" htmlFor="saccadesColor">
						{chrome.i18n.getMessage('saccadesColorLabel')} {showOptimal('saccadesColor')}
					</label>

					<select
						name="saccadesColor"
						id="saccadesColor"
						className="p-2"
						onChange={makeUpdateChangeEventHandler('saccadesColor')}
						value={prefs.saccadesColor}>
						{SACCADE_COLORS.map(([label, value]) => (
							<option key={label} value={value}>
								{label} {showOptimal('saccadesColor', label.toLowerCase() === 'original' ? '' : label.toLowerCase())}
							</option>
						))}
					</select>
				</div>

				<div className="|| flex flex-column || w-100 gap-1">
					<label className="text-dark text-capitalize" htmlFor="saccadesStyle">
						{chrome.i18n.getMessage('saccadesStyleLabel')} {showOptimal('saccadesStyle')}
					</label>

					<select
						name="saccadesStyle"
						id="saccadesStyle"
						className="p-2"
						onChange={makeUpdateChangeEventHandler('saccadesStyle')}
						value={prefs.saccadesStyle}>
						{SACCADE_STYLES.map((style) => (
							<option key={style} value={style.toLowerCase()}>
								{style} {showOptimal('saccadesStyle', style.toLowerCase())}
							</option>
						))}
					</select>
				</div>

				<div className="w-100">
					<label className="block text-capitalize mb-sm" id="lineHeightLabel">
						{chrome.i18n.getMessage('lineHeightTogglesLabel')}
					</label>

					<div className="|| flex justify-center || w-100">
						<button
							id="lineHeightDecrease"
							data-op="decrease"
							className="mr-md w-100 text-capitalize"
							onClick={() => updateConfig('lineHeight', Number(prefs.lineHeight) - 0.5)}>
							<span className="block">{chrome.i18n.getMessage('smallerLineHeightBtnText')}</span>
							<span className="text-sm">{chrome.i18n.getMessage('smallerLineHeightBtnSubText')}</span>
						</button>

						<button
							id="lineHeightIncrease"
							data-op="increase"
							className="ml-md w-100 text-capitalize"
							onClick={() => updateConfig('lineHeight', Number(prefs.lineHeight) + 0.5)}>
							<span className="block text-bold">{chrome.i18n.getMessage('largerLineHeightBtnText')}</span>
							<span className="text-sm">{chrome.i18n.getMessage('largerLineHeightBtnSubText')}</span>
						</button>
					</div>
				</div>

				<button
					id="resetDefaultsBtn"
					className="|| flex flex-column || w-100 align-items-center text-capitalize"
					style={{ marginBottom: '25px' }}
					onClick={() => updateConfig('scope', 'reset')}>
					{chrome.i18n.getMessage('resetBtnText')}
				</button>
			</>
		);
	};

	const [showAdvancedSettingsButton, setShowAdvancedSettingsButton] = useState(false);

	const toggleAdvancedSettings = () => {
		setShowAdvancedSettingsButton(!showAdvancedSettingsButton);
	};

	return (
		<>
			{showDebugInline(process.env.NODE_ENV)}
			{errorOccured ? (
				showErrorMessage()
			) : (
				<div className="popup-container || flex flex-column  | gap-1" br-mode={tabSession.brMode ? 'On' : 'Off'}>
					<button
						id="readingModeToggleBtn"
						className={`|| flex flex-column || w-100 align-items-center text-capitalize ${tabSession?.brMode ? 'selected' : ''}`}
						onClick={() => handleToggle(!tabSession.brMode)}>
						<span>{chrome.i18n.getMessage(tabSession?.brMode ? 'onOffToggleBtnTextDisable' : 'onOffToggleBtnTextEnable')}</span>
						<span>{chrome.i18n.getMessage('onOffToggleBtnSubText')}</span>
						<Shortcut />
					</button>

					<button
						id="onPageLoadBtn"
						className={`|| flex flex-column || w-100 align-items-center text-capitalize ${prefs.onPageLoad ? 'selected' : ''}`}
						onClick={() => updateConfig('onPageLoad', !prefs.onPageLoad)}>
						<span className="text-bold">
							{chrome.i18n.getMessage(prefs.onPageLoad ? 'defaultBionicModeToggleBtnOffText' : 'defaultBionicModeToggleBtnOnText')}
						</span>
						<span className="text-sm pt-sm">{chrome.i18n.getMessage('defaultBionicModeToggleBtnSubText')}</span>
					</button>

					<button
						className="|| flex flex-column || w-100 align-items-center text-capitalize"
						style={{ marginBottom: '10px' }}
						onClick={toggleAdvancedSettings}>
						{chrome.i18n.getMessage('advancedSettings')}
					</button>

					{showAdvancedSettingsButton && showAdvancedSettings()}

					{showRating && <RatingPrompt onClose={handleCloseRatingPrompt} />}
				</div>
			)}
			{!errorOccured && <footer className="popup_footer || flex flex-column || gap-1">{getFooterLinks()}</footer>}
		</>
	);
}

export default IndexPopupOld;
