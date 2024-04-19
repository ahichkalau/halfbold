import { useEffect, useState } from 'react';

import Logger from '~services/Logger';
import runTimeHandler from '~services/runTimeHandler';

import { usePopupContext } from './context';

export function useShortcut() {
	const [shortcut, setShortcut] = useState(undefined);

	const getShortcut = () => {
		(runTimeHandler as typeof chrome).runtime
			.sendMessage({ message: 'getShortcut' })
			.then((shortcutResponse) => setShortcut(shortcutResponse))
			.catch(Logger.logError);
	};

	useEffect(getShortcut, []);

	return shortcut;
}

export default function Shortcut() {
	const shortcut = useShortcut();

	if (!shortcut) {
		return <></>;
	}

	return (
		<span className="text-capitalize">
			{chrome.i18n.getMessage('shortcutLabelText')}:{shortcut}
		</span>
	);
}

export function useShowDebugSwitch() {
	const {
		store: { isDebugDataVisible },
		dispatch,
	} = usePopupContext();

	const setIsDebugDataVisible = (value: typeof isDebugDataVisible) => dispatch(['isDebugDataVisible', value]);
	return [isDebugDataVisible, setIsDebugDataVisible] as [typeof isDebugDataVisible, typeof setIsDebugDataVisible];
}
