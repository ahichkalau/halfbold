import Logger from '~services/Logger';
import { USER_PREF_STORE_KEY } from '~services/config';
import defaultPrefs from '~services/preferences';

import NodeObserver from './observer';
import { makeExcluder } from './siteElementExclusions';
import siteOverrides from './siteOverrides';

const { MAX_FIXATION_PARTS, FIXATION_LOWER_BOUND, BR_WORD_STEM_PERCENTAGE } = defaultPrefs;
// which tag's content should be ignored from bolded
const IGNORE_NODE_TAGS = ['STYLE', 'SCRIPT', 'BR-SPAN', 'BR-FIXATION', 'BR-BOLD', 'BR-EDGE', 'SVG', 'INPUT', 'TEXTAREA'];
const MUTATION_TYPES = ['childList', 'characterData'];

const IGNORE_MUTATIONS_ATTRIBUTES = ['br-ignore-on-mutation'];
/** @type {NodeObserver} */
let observer;

/** @type {string} */
let origin = '';

let excludeByOrigin: ReturnType<typeof makeExcluder>;

// making half of the letters in a word bold
function highlightText(sentenceText) {
	return sentenceText.replace(/\p{L}+/gu, (word) => {
		const { length } = word;

		const brWordStemWidth = length > 3 ? Math.round(length * BR_WORD_STEM_PERCENTAGE) : length;

		const firstHalf = word.slice(0, brWordStemWidth);
		const secondHalf = word.slice(brWordStemWidth);
		const htmlWord = `<br-bold>${makeFixations(firstHalf)}</br-bold>${secondHalf.length ? `<br-edge>${secondHalf}</br-edge>` : ''}`;
		return htmlWord;
	});
}

function hasLatex(sentence: string) {
	const result = /((\\)([\(\[]|begin))+/.test(sentence);
	// Logger.logInfo({ node: sentence, result });
	return result;
}

function makeFixations(textContent: string) {
	const COMPUTED_MAX_FIXATION_PARTS = textContent.length >= MAX_FIXATION_PARTS ? MAX_FIXATION_PARTS : textContent.length;

	const fixationWidth = Math.ceil(textContent.length * (1 / COMPUTED_MAX_FIXATION_PARTS));

	if (fixationWidth === FIXATION_LOWER_BOUND) {
		return `<br-fixation fixation-strength="1">${textContent}</br-fixation>`;
	}

	const fixationsSplits = new Array(COMPUTED_MAX_FIXATION_PARTS).fill(null).map((item, index) => {
		const wordStartBoundary = index * fixationWidth;
		const wordEndBoundary = wordStartBoundary + fixationWidth > textContent.length ? textContent.length : wordStartBoundary + fixationWidth;

		return `<br-fixation fixation-strength="${index + 1}">${textContent.slice(wordStartBoundary, wordEndBoundary)}</br-fixation>`;
	});

	return fixationsSplits.join('');
}

function isTextNodeWithLatex(node) {
	const result = node.nodeType === Node.TEXT_NODE && hasLatex(node.textContent);
	// Logger.logInfo('found text_node with latex', result);
	return result;
}

function parseNode(node) {
	if (!node?.parentElement?.tagName || IGNORE_NODE_TAGS.includes(node.parentElement.tagName)) {
		return;
	}

	if (node?.parentElement?.closest('body') && excludeByOrigin(node?.parentElement)) {
		node.parentElement.setAttribute('br-ignore-on-mutation', 'true');
		Logger.logInfo('found node to exclude', node, node.parentElement);
		return;
	}

	if (ignoreOnMutation(node)) {
		Logger.logInfo('found br-ignore-on-mutation', 'skipping');
		return;
	}

	if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim().length > 2) {
		Logger.logInfo(node.nodeValue);
		try {
			const brSpan = document.createElement('br-span');
			brSpan.innerHTML = highlightText(node.nodeValue);

			if (node.previousSibling?.tagName === 'BR-SPAN') {
				node.previousSibling.remove();
			}

			node.parentElement.insertBefore(brSpan, node);
			node.textContent = '';

			//parent.replaceChild(brSpan, node);
		} catch (err) {
			Logger.logError(err);
		}
	} else if (node.hasChildNodes()) {
		Array.from(node.childNodes).forEach((child) => parseNode(child));
	}
}

const setReadingMode = (enableReading, document, contentStyle) => {
	if (true) {
		return setReadingModeBeta(enableReading, document, contentStyle);
	} else {
		return setReadingModeStandard(enableReading, document, contentStyle);
	}
};

const setReadingModeBeta = (enableReading, document, contentStyle) => {
	Logger.logInfo('reading mode beta');
	const endTimer = Logger.logTime('ToggleReading-Time');
	origin = document?.URL ?? '';
	excludeByOrigin = makeExcluder(origin);

	try {
		if (enableReading) {
			const containsBoldElements = document.querySelector('br-bold') !== null;

			if (!containsBoldElements) {
				addStyles(contentStyle, document);
			}

			document.body.setAttribute('br-mode', 'on');
			observeVisibleNodes();

			if (!observer) {
				observer = new NodeObserver(document.body, null, mutationCallback);
				observer.observe();
			}
		} else {
			document.body.setAttribute('br-mode', 'off');
			unobserveNodes();
			if (observer) {
				observer.destroy();
				observer = null;
			}
		}
	} catch (error) {
		Logger.logError(error);
	} finally {
		endTimer();
	}
};

const setReadingModeStandard = (enableReading, /** @type {Document} */ document, contentStyle) => {
	Logger.logInfo('reading mode standart');
	const endTimer = Logger.logTime('ToggleReading-Time');
	origin = document?.URL ?? '';
	excludeByOrigin = makeExcluder(origin);

	try {
		if (enableReading) {
			const boldedElements = document.getElementsByTagName('br-bold');

			// makes sure to only run once regadless of how many times
			// setReadingMode(true) is called, consecutively
			if (boldedElements.length < 1) {
				addStyles(contentStyle, document);
			}

			document.body.setAttribute('br-mode', 'on');
			[...document.body.childNodes].forEach(parseNode);

			/** make an observer if one does not exist and body[br-mode=on] */
			if (!observer) {
				observer = new NodeObserver(document.body, null, mutationCallback);
				observer.observe();
			}
		} else {
			document.body.setAttribute('br-mode', 'off');
			if (observer) {
				observer.destroy();
				observer = null;
			}
		}
	} catch (error) {
		Logger.logError(error);
	} finally {
		endTimer();
	}
};

function ignoreOnMutation(node) {
	return node?.parentElement?.closest('[br-ignore-on-mutation]');
}

function mutationCallback(mutationRecords: MutationRecord[]) {
	const body = mutationRecords[0]?.target?.parentElement?.closest('body');
	if (body && ['textarea:focus', 'input:focus'].filter((query) => body?.querySelector(query)).length) {
		Logger.logInfo('focused or active input found, exiting mutationCallback');
		return;
	}

	Logger.logInfo('mutationCallback fired ', mutationRecords.length, mutationRecords);
	mutationRecords.forEach(({ type, addedNodes, target }) => {
		if (!MUTATION_TYPES.includes(type)) {
			return;
		}

		// Some changes don't add nodes
		// but values are changed
		// To account for that,
		// recursively parse the target node as well
		// parseNode(target);

		[...addedNodes, target].forEach((node) => {
			if (!ignoreOnMutation(node)) {
				parseNode(node);
			}
		});
	});
}

const observedNodes = new Set();

function observeVisibleNodes() {
	const nodes = document.body.querySelectorAll('div, span, p, li, a');
	nodes.forEach((node) => {
		observerInteraction.observe(node);
		observedNodes.add(node);
	});
}

function unobserveNodes() {
	Logger.logInfo('Unobserve noddes', observedNodes);
	observedNodes.forEach((node: Node) => {
		if (node instanceof Element) {
			observerInteraction.unobserve(node);
		} else {
			console.error('Attempted to unobserve a non-element node');
		}
		observedNodes.delete(node);
	});
	observerInteraction.disconnect();
}

const screenHeight = window.innerHeight;
const observerInteraction = new IntersectionObserver(
	(entries, observer) => {
		entries.forEach((entry) => {
			if (entry.isIntersecting) {
				parseNode(entry.target);
				observer.unobserve(entry.target);
			}
		});
	},
	{
		root: null,
		threshold: 0.1,
		rootMargin: `${screenHeight}px 0px ${screenHeight}px 0px`,
	},
);

function addStyles(styleText, document) {
	const style = document.createElement('style');
	style.setAttribute('br-style', '');
	style.textContent = styleText + siteOverrides.getSiteOverride(document?.URL);
	Logger.logInfo('contentStyle', style.textContent);
	document.head.appendChild(style);
}

const setAttribute = (documentRef) => (attribute, value) => {
	documentRef.body.setAttribute(attribute, value);
};
const getAttribute = (documentRef) => (attribute) => documentRef.body.getAttribute(attribute);

const setProperty = (documentRef) => (property, value) => {
	documentRef.body.style.setProperty(property, value);
};

const getProperty = (documentRef) => (property) => documentRef.body.style.getPropertyValue(property);

const setSaccadesStyle = (documentRef) => (style) => {
	Logger.logInfo('saccades-style', style);

	if (/bold/i.test(style)) {
		const [, value] = style.split('-');
		setProperty(documentRef)('--br-boldness', value);
		setProperty(documentRef)('--br-line-style', '');
	}

	if (/line$/i.test(style)) {
		const [value] = style.split('-');
		setProperty(documentRef)('--br-line-style', value);
		setProperty(documentRef)('--br-boldness', '');
	}
};

// function getConfigFromStorage() {
// 	const storedConfig = localStorage.getItem(USER_PREF_STORE_KEY);
// 	return storedConfig ? JSON.parse(storedConfig) : null;
// }

// function getShowBetaValue() {
// 	const config = getConfigFromStorage();
// 	if (!config || !config.global) {
// 		console.log('No global configuration found.');
// 		return null;
// 	}

// 	const showBeta = config.global.renderModeBeta;
// 	return showBeta;
// }

export default {
	setReadingMode,
	makeHandlers: (documentRef) => ({
		setAttribute: setAttribute(documentRef),
		getAttribute: getAttribute(documentRef),
		setProperty: setProperty(documentRef),
		getProperty: getProperty(documentRef),
		setSaccadesStyle: setSaccadesStyle(documentRef),
	}),
	hasLatex,
};
