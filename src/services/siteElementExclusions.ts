import Logger from '~services/Logger';





const siteElementExclusions = {
	'play.google.com': ['.mat-icon-button', 'mat-icon-button', '.scrubber-container', 'header>nav>a'],
	'app.grammarly.com': ['.editor-editorContainer'],
	'notion.so': ['.notion-frame'],
	'youtube.com': ['#tooltip'],
	'linkedin.com': ['code', 'video__container', 'image__container'],
	'.': ['[contenteditable]', '[role=textbox]', 'input', 'textarea', 'svg', 'img', 'ktx-icon', '.mat-icon'], //disable input and images containers for all domains
};

export const makeExcluder = (/** @type string */ origin) => {
	Logger.logInfo('makeExcluder', origin);

	const [, exclusions] = Object.entries(siteElementExclusions).find(([domain]) => new RegExp(domain, 'i').test(origin)) ?? [null, []];
	return (element: HTMLElement) => {
		const result = exclusions.some((exclusion) => element.closest(exclusion));
		return result;
	};
};

export default {
	makeExcluder,
};