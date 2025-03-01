import Logger from '~services/Logger';
import defaultPrefs from '~services/preferences';

import NodeObserver from './observer';
import { makeExcluder } from './siteElementExclusions';
import siteOverrides from './siteOverrides';

const { MAX_FIXATION_PARTS, FIXATION_LOWER_BOUND, BR_WORD_STEM_PERCENTAGE } = defaultPrefs;
// which tag's content should be ignored from bolded
const IGNORE_NODE_TAGS = new Set(['STYLE', 'SCRIPT', 'BR-SPAN', 'BR-FIXATION', 'BR-BOLD', 'BR-EDGE', 'SVG', 'INPUT', 'TEXTAREA', '<!--']);

// Кэш для обработанных слов - ключевая оптимизация
const wordCache = new Map();
// Кэш для обработанных текстовых узлов
const nodeCache = new Map();

// Максимальный размер кэша для предотвращения утечек памяти
const MAX_CACHE_SIZE = 1000;

/** @type {NodeObserver} */
let observer;

/** @type {string} */
let origin = '';

let excludeByOrigin: ReturnType<typeof makeExcluder>;

// making half of the letters in a word bold
export function highlightText(sentenceText) {
	// Кэширование результатов для одинаковых предложений
	if (nodeCache.has(sentenceText)) {
		return nodeCache.get(sentenceText);
	}

	const result = sentenceText.replace(/\p{L}+/gu, (word) => {
		// Проверяем кэш для данного слова
		if (wordCache.has(word)) {
			return wordCache.get(word);
		}

		const { length } = word;
		const brWordStemWidth = length > 3 ? Math.round(length * BR_WORD_STEM_PERCENTAGE) : length;
		const firstHalf = word.slice(0, brWordStemWidth);
		const secondHalf = word.slice(brWordStemWidth);
		const htmlWord = `<br-bold>${makeFixations(firstHalf)}</br-bold>${secondHalf.length ? `<br-edge>${secondHalf}</br-edge>` : ''}`;

		// Кэшируем результат
		if (wordCache.size >= MAX_CACHE_SIZE) {
			// Удаляем первый элемент при достижении лимита
			const firstKey = wordCache.keys().next().value;
			wordCache.delete(firstKey);
		}
		wordCache.set(word, htmlWord);

		return htmlWord;
	});

	// Кэшируем результат для всего предложения
	if (nodeCache.size >= MAX_CACHE_SIZE) {
		const firstKey = nodeCache.keys().next().value;
		nodeCache.delete(firstKey);
	}
	nodeCache.set(sentenceText, result);

	return result;
}

// Оптимизированная функция для создания фиксаций
function makeFixations(textContent: string) {
	const COMPUTED_MAX_FIXATION_PARTS = textContent.length >= MAX_FIXATION_PARTS ? MAX_FIXATION_PARTS : textContent.length;

	if (COMPUTED_MAX_FIXATION_PARTS <= 1) {
		return `<br-fixation fixation-strength="1">${textContent}</br-fixation>`;
	}

	const fixationWidth = Math.ceil(textContent.length * (1 / COMPUTED_MAX_FIXATION_PARTS));

	if (fixationWidth === FIXATION_LOWER_BOUND) {
		return `<br-fixation fixation-strength="1">${textContent}</br-fixation>`;
	}

	// Используем строку вместо массива для лучшей производительности
	let fixationsResult = '';

	for (let i = 0; i < COMPUTED_MAX_FIXATION_PARTS; i++) {
		const wordStartBoundary = i * fixationWidth;
		const wordEndBoundary = wordStartBoundary + fixationWidth > textContent.length ? textContent.length : wordStartBoundary + fixationWidth;

		fixationsResult += `<br-fixation fixation-strength="${i + 1}">${textContent.slice(wordStartBoundary, wordEndBoundary)}</br-fixation>`;
	}

	return fixationsResult;
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

			// Отложенная инициализация для более быстрой загрузки
			setTimeout(() => {
				observeVisibleNodes();

				if (!observer) {
					observer = new NodeObserver(document.body, null, mutationCallback);
					observer.observe();
				}
			}, 0);

		} else {
			document.body.setAttribute('br-mode', 'off');
			unobserveNodes();
			if (observer) {
				observer.destroy();
				observer = null;
			}

			// Очищаем кэши при выключении режима
			wordCache.clear();
			nodeCache.clear();
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

// Используем WeakSet для лучшей работы со сборщиком мусора
const processedNodes = new WeakSet();
let changedNodes = new Set<Node>();
let isProcessingNodes = false;

function processChangedNodes() {
	if (isProcessingNodes || changedNodes.size === 0) return;

	isProcessingNodes = true;

	const batchSize = Math.min(20, changedNodes.size);
	const nodesToProcess = Array.from(changedNodes).slice(0, batchSize);

	for (const modifiedNode of nodesToProcess) {
		if (!modifiedNode?.parentElement) {
			changedNodes.delete(modifiedNode);
			continue;
		}

		// Пропускаем узлы, которые уже были обработаны
		if (processedNodes.has(modifiedNode)) {
			changedNodes.delete(modifiedNode);
			continue;
		}

		const nodeValue = modifiedNode.nodeValue;
		// Пропускаем пустые или короткие узлы
		if (!nodeValue || nodeValue.trim().length <= 2) {
			changedNodes.delete(modifiedNode);
			processedNodes.add(modifiedNode);
			continue;
		}

		const brSpan = document.createElement('br-span');
		const highlightedText = highlightText(nodeValue);
		brSpan.innerHTML = highlightedText;

		if (modifiedNode.previousSibling instanceof Element && modifiedNode.previousSibling.tagName === 'BR-SPAN') {
			if (modifiedNode.previousSibling?.innerHTML === brSpan.innerHTML) {
				changedNodes.delete(modifiedNode);
				modifiedNode.textContent = '';
				processedNodes.add(modifiedNode);
				continue;
			}
			modifiedNode.previousSibling.remove();
		}

		modifiedNode.parentElement.insertBefore(brSpan, modifiedNode);
		modifiedNode.textContent = '';
		changedNodes.delete(modifiedNode);
		processedNodes.add(modifiedNode);
	}

	isProcessingNodes = false;

	if (changedNodes.size > 0) {
		requestAnimationFrame(processChangedNodes);
	}
}

function parseNode(node) {
	// Быстрая проверка на пригодность узла
	if (!node || !node.parentElement || IGNORE_NODE_TAGS.has(node.parentElement.tagName)) {
		return;
	}

	if (ignoreOnMutation(node) || processedNodes.has(node)) {
		return;
	}

	if (node?.parentElement?.closest('body') && excludeByOrigin(node?.parentElement)) {
		node.parentElement.setAttribute('br-ignore-on-mutation', 'true');
		return;
	}

	if (node.nodeType === Node.TEXT_NODE) {
		// Быстрая проверка на значимость текста
		const text = node.nodeValue;
		if (text && text.trim().length > 2) {
			changedNodes.add(node);
			if (changedNodes.size > 10 && !isProcessingNodes) {
				requestAnimationFrame(processChangedNodes);
			}
		}
		return;
	}

	// Оптимизированный обход дочерних узлов
	if (node.childNodes && node.childNodes.length) {
		// Используем рекурсию только для значимых родительских узлов
		// Вместо Array.from используем прямой доступ к childNodes
		const { childNodes } = node;
		for (let i = 0; i < childNodes.length; i++) {
			parseNode(childNodes[i]);
		}
	}
}

function ignoreOnMutation(node) {
	return node?.parentElement?.closest('[br-ignore-on-mutation]');
}

// Оптимизация обработки мутаций
const MAX_MUTATIONS_PER_FRAME = 50;
let queuedMutations = [];
let mutationFrameRequested = false;

function mutationCallback(mutationRecords) {
	// Фильтруем и добавляем только значимые мутации
	for (const mutation of mutationRecords) {
		if ((mutation.type === 'childList' && mutation.addedNodes.length > 0) ||
			(mutation.type === 'characterData' && mutation.target?.nodeValue?.trim().length > 2)) {
			queuedMutations.push(mutation);
		}
	}

	if (!mutationFrameRequested && queuedMutations.length > 0) {
		mutationFrameRequested = true;
		requestAnimationFrame(processMutations);
	}
}

function processMutations() {
	const body = queuedMutations[0]?.target?.parentElement?.closest('body');
	if (body && ['textarea:focus', 'input:focus'].some((query) => body.querySelector(query))) {
		Logger.logInfo('Focused or active input found, exiting mutationCallback');
		queuedMutations = [];
		mutationFrameRequested = false;
		return;
	}

	const mutationsToProcess = queuedMutations.splice(0, MAX_MUTATIONS_PER_FRAME);
	const addedNodes = new Set();

	for (const mutation of mutationsToProcess) {
		if (mutation.type === 'childList') {
			for (const node of mutation.addedNodes) {
				if (!IGNORE_NODE_TAGS.has(node.tagName) && !addedNodes.has(node)) {
					addedNodes.add(node);
				}
			}
		}
		else if (mutation.type === 'characterData') {
			const target = mutation.target;
			if (target && target.parentNode && !IGNORE_NODE_TAGS.has(target.parentNode.tagName)) {
				if (!processedNodes.has(target)) {
					parseNode(target);
				}
			}
		}
	}

	// Обрабатываем добавленные узлы отдельно для лучшей производительности
	for (const node of addedNodes) {
		parseNode(node);
	}

	if (queuedMutations.length > 0) {
		requestAnimationFrame(processMutations);
	} else {
		mutationFrameRequested = false;
	}

	if (changedNodes.size > 0 && !isProcessingNodes) {
		requestAnimationFrame(processChangedNodes);
	}
}

// Использование WeakRef для предотвращения утечек памяти
const observedNodes = new Set();

// Улучшенный IntersectionObserver с оптимизированными параметрами
const screenHeight = window.innerHeight;
const observerInteraction = new IntersectionObserver(
	(entries) => {
		for (const entry of entries) {
			if (entry.isIntersecting) {
				parseNode(entry.target);
				observerInteraction.unobserve(entry.target);
				observedNodes.delete(entry.target);
			}
		}
	},
	{
		root: null,
		threshold: 0.1,
		rootMargin: `${screenHeight}px 0px ${screenHeight}px 0px`,
	},
);

function observeVisibleNodes() {
	// Используем более специфичные селекторы и добавляем элементы по частям
	const batchSize = 200;
	let observedCount = 0;

	// Функция для обработки партий элементов
	function processBatch(selector, index = 0) {
		const elements = document.body.querySelectorAll(selector);
		const start = index * batchSize;
		const end = Math.min(start + batchSize, elements.length);

		for (let i = start; i < end; i++) {
			const node = elements[i];
			if (!processedNodes.has(node)) {
				observerInteraction.observe(node);
				observedNodes.add(node);
				observedCount++;
			}
		}

		// Продолжаем обработку, если есть еще элементы
		if (end < elements.length) {
			setTimeout(() => processBatch(selector, index + 1), 0);
		}
	}

	// Обрабатываем разные типы элементов
	setTimeout(() => processBatch('p, li'), 0);
	setTimeout(() => processBatch('div'), 50);
	setTimeout(() => processBatch('span, a'), 100);
}

function unobserveNodes() {
	Logger.logInfo('Unobserve nodes', observedNodes.size);

	for (const node of observedNodes) {
		if (node instanceof Element) {
			observerInteraction.unobserve(node);
		}
	}

	observedNodes.clear();
	observerInteraction.disconnect();

	// Очищаем все кэши и коллекции
	changedNodes.clear();
	queuedMutations = [];
	wordCache.clear();
	nodeCache.clear();
}

function addStyles(styleText, document) {
	// Проверяем, существует ли уже style с нашим атрибутом
	if (document.querySelector('style[br-style]')) {
		return;
	}

	const style = document.createElement('style');
	style.setAttribute('br-style', '');
	const siteOverrideStyles = siteOverrides.getSiteOverride(document?.URL) || '';
	style.textContent = styleText + siteOverrideStyles;
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