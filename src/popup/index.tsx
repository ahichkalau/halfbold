import './../styles/style.css';

import PopupContextProvider from './context';
import PopupPage from './popup';

function PopupShell() {
	return (
		<PopupContextProvider>
			<PopupPage />
		</PopupContextProvider>
	);
}

export default PopupShell;
