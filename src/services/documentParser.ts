import Logger from '~services/Logger';
import defaultPrefs from '~services/preferences';

import NodeObserver from './observer';
import { makeExcluder } from './siteElementExclusions';
import siteOverrides from './siteOverrides';

const { MAX_FIXATION_PARTS, FIXATION_LOWER_BOUND, BR_WORD_STEM_PERCENTAGE } = defaultPrefs;
// which tag's content should be ignored from bolded
const IGNORE_NODE_TAGS = new Set(['STYLE', 'SCRIPT', 'BR-SPAN', 'BR-FIXATION', 'BR-BOLD', 'BR-EDGE', 'SVG', 'INPUT', 'TEXTAREA', '<!--']);
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

const setReadingMode = (enableReading, document, contentStyle) => {
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

function hasLatex(sentence: string) {
	const result = /((\\)([\(\[]|begin))+/.test(sentence);
	return result;
}

let changedNodes = new Set<Node>();

function processChangedNodes() {
	function processBatch() {
		const nodesToProcess = Array.from(changedNodes).slice(0, 20);

		nodesToProcess.forEach((modifiedNode) => {
			if (!modifiedNode?.parentElement) {
				changedNodes.delete(modifiedNode);
				return;
			}

			const brSpan = document.createElement('br-span');
			brSpan.innerHTML = highlightText(modifiedNode.nodeValue);
			if (modifiedNode.previousSibling instanceof Element && modifiedNode.previousSibling.tagName === 'BR-SPAN') {
				if (modifiedNode.previousSibling?.innerHTML === brSpan.innerHTML) {
					changedNodes.delete(modifiedNode);
					modifiedNode.textContent = '';

					return;
				}
				modifiedNode.previousSibling.remove();
			}

			modifiedNode.parentElement.insertBefore(brSpan, modifiedNode);
			modifiedNode.textContent = '';
			changedNodes.delete(modifiedNode);
		});

		if (changedNodes.size > 0) {
			requestAnimationFrame(processBatch);
		}
	}

	try {
		processBatch();
	} catch (err) {
		Logger.logError('Unable to parse');
	}
}

function parseNode(node) {
	if (!node?.parentElement?.tagName || IGNORE_NODE_TAGS.has(node.parentElement.tagName)) {
		return;
	}

	if (ignoreOnMutation(node)) {
		//Logger.logInfo('found br-ignore-on-mutation', 'skipping');
		return;
	}

	if (node?.parentElement?.closest('body') && excludeByOrigin(node?.parentElement)) {
		node.parentElement.setAttribute('br-ignore-on-mutation', 'true');
		return;
	}

	if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim().length > 2) {
		changedNodes.add(node);
		if (changedNodes.size > 10) {
			processChangedNodes();
		}
	}

	if (node.hasChildNodes()) {
		Array.from(node.childNodes).forEach((child) => {
			parseNode(child);
		});
	}
}

// function parseSeveralNodes(node) {
// 	if (!node?.parentElement?.tagName || IGNORE_NODE_TAGS.has(node.parentElement.tagName)) {
// 		return;
// 	}

// 	if (ignoreOnMutation(node)) {
// 		//Logger.logInfo('found br-ignore-on-mutation', 'skipping');
// 		return;
// 	}

// 	if (node?.parentElement?.closest('body') && excludeByOrigin(node?.parentElement)) {
// 		node.parentElement.setAttribute('br-ignore-on-mutation', 'true');
// 		return;
// 	}

// 	if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim().length > 2) {
// 		try {
// 			const brSpan = document.createElement('br-span');
// 			brSpan.innerHTML = highlightText(node.nodeValue);
// 			if (node.previousSibling instanceof Element && node.previousSibling.tagName === 'BR-SPAN') {
// 				if (node.previousSibling?.innerHTML === brSpan.innerHTML) {
// 					Logger.logInfo('Same node, skip', node);
// 					node.textContent = '';

// 					return;
// 				}
// 				node.previousSibling.remove();
// 			}

// 			node.parentElement.insertBefore(brSpan, node);
// 			node.textContent = '';
// 		} catch (err) {
// 			Logger.logError('Unable to parse');
// 		}
// 	} else if (node.hasChildNodes()) {
// 		Array.from(node.childNodes).forEach((child) => {
// 			parseSeveralNodes(child);
// 		});
// 	}
// }

function ignoreOnMutation(node) {
	return node?.parentElement?.closest('[br-ignore-on-mutation]');
}

let queuedMutations = [];
let mutationFrameRequested = false;

function mutationCallback(mutationRecords) {
	//Logger.logInfo('Mutations callback', mutationRecords);

	queuedMutations.push(...mutationRecords);
	if (!mutationFrameRequested) {
		mutationFrameRequested = true;
		requestAnimationFrame(processMutations);
	}
}

function processMutations() {
	const body = queuedMutations[0]?.target?.parentElement?.closest('body');
	if (body && ['textarea:focus', 'input:focus'].some((query) => body.querySelector(query))) {
		Logger.logInfo('Focused or active input found, exiting mutationCallback');
		return;
	}

	const mutationsToProcess = queuedMutations.splice(0, 80);

	//if (mutationsToProcess.length < 10) {
	mutationsToProcess.forEach((mutation) => {
		if (mutation.type == 'childList') {
			[...mutation.addedNodes].forEach((node) => {
				if (!IGNORE_NODE_TAGS.has(node.tagName)) {
					parseNode(node);
				}
			});
		}
		if (mutation.type == 'characterData') {
			if (!IGNORE_NODE_TAGS.has(mutation.target?.parentNode)) {
				parseNode(mutation.target?.parentNode);
			}
		}
	});
	// } else {
	// 	mutationsToProcess.forEach((mutation) => {
	// 		if (mutation.type == 'childList') {
	// 			[...mutation.addedNodes].forEach((node) => {
	// 				if (!IGNORE_NODE_TAGS.has(node.tagName)) {
	// 					parseNode(node);
	// 				}
	// 			});
	// 		}
	// 		if (mutation.type == 'characterData') {
	// 			if (!IGNORE_NODE_TAGS.has(mutation.target?.parentNode)) {
	// 				parseSeveralNodes(mutation.target?.parentNode);
	// 			}
	// 		}
	// 	});
	// }

	if (queuedMutations.length > 0) {
		requestAnimationFrame(processMutations);
	} else {
		mutationFrameRequested = false;
	}
	processChangedNodes();
}

const observedNodes = [];

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

function observeVisibleNodes() {
	const nodes = document.body.querySelectorAll('div, span, p, li, a');
	nodes.forEach((node) => {
		observerInteraction.observe(node);
		observedNodes.push(node);
	});
}

function unobserveNodes() {
	Logger.logInfo('Unobserve noddes', observedNodes);
	observedNodes.forEach((node: Node) => {
		if (node instanceof Element) {
			observerInteraction.unobserve(node);
		}
	});
	observedNodes.length = 0;
	observerInteraction.disconnect();
}

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
