import { MaxSaccadesInterval, SACCADE_COLORS, SACCADE_STYLES } from "~services/config";
import defaultPrefs from "~services/preferences";

const FIXATION_OPACITY_STOPS = 5;
const FIXATION_OPACITY_STOP_UNIT_SCALE = Math.floor(100 / FIXATION_OPACITY_STOPS);

const showOptimal = (key: string, value = null, prefs) => {
    if (!prefs) return null;
    if ((value ?? prefs?.[key]) == defaultPrefs?.[key]) return <span className="ml-auto text-sm">Optimal</span>;
};

const AdvancedSettings = ({ prefs, makeUpdateChangeEventHandler, updateConfig }) => {
    return (
        <div className="advanced-settings flex flex-column">
            <div className="w-100">
                <label className="block text-capitalize">
                    Saccades Interval: <span id="saccadesLabelValue">{prefs.saccadesInterval}</span>
                    {showOptimal("saccadesInterval", null, prefs)}
                </label>
                <input
                    type="range"
                    min="0"
                    max={MaxSaccadesInterval - 1}
                    value={prefs.saccadesInterval}
                    onChange={makeUpdateChangeEventHandler("saccadesInterval")}
                    className="slider w-100"
                />
            </div>

            <div className="w-100">
                <label className="block text-capitalize">
                    Fixations Strength: <span id="fixationStrengthLabelValue">{prefs.fixationStrength}</span>
                    {showOptimal("fixationStrength", null, prefs)}
                </label>
                <input
                    type="range"
                    min="1"
                    max={prefs.MAX_FIXATION_PARTS}
                    value={prefs.fixationStrength}
                    onChange={makeUpdateChangeEventHandler("fixationStrength")}
                    className="slider w-100"
                />
            </div>

            <div className="w-100">
                <label className="block text-capitalize">
                    Fixation Edge Opacity: <span id="fixationOpacityLabelValue">{prefs.fixationEdgeOpacity}%</span>
                    {showOptimal("fixationEdgeOpacity", null, prefs)}
                </label>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={prefs.fixationEdgeOpacity}
                    onChange={makeUpdateChangeEventHandler("fixationEdgeOpacity")}
                    className="slider w-100"
                    step="10"
                />
            </div>

            <div className="w-100">
                <label className="text-dark text-capitalize" htmlFor="saccadesColor">
                    Saccades Color {showOptimal("saccadesColor", null, prefs)}
                </label>
                <select
                    name="saccadesColor"
                    id="saccadesColor"
                    className="p-2"
                    onChange={makeUpdateChangeEventHandler("saccadesColor")}
                    value={prefs.saccadesColor}>
                    {SACCADE_COLORS.map(([label, value]) => (
                        <option key={label} value={value}>
                            {label}
                        </option>
                    ))}
                </select>
            </div>

            <div className="w-100">
                <label className="text-dark text-capitalize" htmlFor="saccadesStyle">
                    Saccades Style {showOptimal("saccadesStyle", null, prefs)}
                </label>
                <select
                    name="saccadesStyle"
                    id="saccadesStyle"
                    className="p-2"
                    onChange={makeUpdateChangeEventHandler("saccadesStyle")}
                    value={prefs.saccadesStyle}>
                    {SACCADE_STYLES.map((style) => (
                        <option key={style} value={style.toLowerCase()}>
                            {style}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};

export default AdvancedSettings;
