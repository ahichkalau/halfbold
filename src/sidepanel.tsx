import "~styles/style.scss";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useStorage } from "@plasmohq/storage/hook";
import { type Prefs } from "../index";
import {APP_PREFS_STORE_KEY, COLOR_MODE_STATE_TRANSITIONS, DisplayColorMode} from "~services/config";
import documentParser, { highlightText } from "~services/documentParser";
import contentStyle from 'data-text:./styles/contentStyle.scss';
import usePrefs from "~services/usePrefs";
import './styles/toggle.scss';
// Импортируем библиотеку для PDF
import { jsPDF } from "jspdf";
import {htmlToRtf} from "~services/documentHelper";
// Добавляем plugin для работы с HTML

function SidebarPage() {
    const [appConfigPrefs, setAppConfigPrefs] = useStorage<Prefs>(APP_PREFS_STORE_KEY);
    const [text, setText] = useState("");
    const [formattedText, setFormattedText] = useState<string>("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [prefs, setPrefs] = usePrefs(() => "local");

    // Используем useMemo для кэширования обработчиков
    const handlers = useMemo(() => documentParser.makeHandlers(document), []);
    const { setAttribute, setProperty, setSaccadesStyle } = handlers;

    // Оптимизируем форматирование с помощью useCallback
    const formatText = useCallback((input: string) => {
        return highlightText(input);
    }, []);

    // Оптимизированный обработчик преобразования текста
    const handleTransformClick = useCallback(() => {
        if (!text.trim()) return;

        setIsProcessing(true);

        // Используем setTimeout для избежания блокировки UI
        setTimeout(() => {
            try {
                const newFormattedText = formatText(text);
                setFormattedText(newFormattedText);

                // Применяем стили и настройки
                setProperty('--fixation-edge-opacity', prefs.fixationEdgeOpacity + '%');
                setProperty('--br-line-height', prefs.lineHeight);
                setSaccadesStyle(prefs.saccadesStyle);
                setAttribute('saccades-color', prefs.saccadesColor);
                setAttribute('fixation-strength', prefs.fixationStrength);
                setAttribute('saccades-interval', prefs.saccadesInterval);

                // Включаем режим чтения и применяем стили
                documentParser.setReadingMode(true, document, contentStyle);
            } catch (error) {
                console.error('Error transforming text:', error);
                alert('Error processing text. Please try again with a smaller portion of text.');
            } finally {
                setIsProcessing(false);
            }
        }, 0);
    }, [text, prefs, formatText, setAttribute, setProperty, setSaccadesStyle]);

    // Очистка ввода
    const handleClearClick = useCallback(() => {
        setText("");
        setFormattedText("");
    }, []);

    // Оптимизированное сохранение в RTF
    const handleDownloadRtf = useCallback(() => {
        if (!formattedText) return;

        setIsProcessing(true);

        // Обработка в отдельном потоке для предотвращения зависания UI
        setTimeout(() => {
            try {
                const rtfContent = htmlToRtf(formattedText);
                const fileName = `formatted-text-${new Date().toISOString().slice(0, 10)}.rtf`;

                const blob = new Blob([rtfContent], { type: "application/rtf" });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href); // Освобождаем ресурсы
            } catch (error) {
                console.error('Error downloading RTF:', error);
                alert('Error creating RTF file. Please try again with a smaller portion of text.');
            } finally {
                setIsProcessing(false);
            }
        }, 0);
    }, [formattedText]);

    // Оптимизированный обработчик изменения цветовой схемы
    const handleDisplayColorModeChange = useCallback(async (currentDisplayColorMode) => {
        if (![...Object.values(DisplayColorMode)].includes(currentDisplayColorMode)) {
            alert('Invalid display mode');
            return;
        }

        const transition = COLOR_MODE_STATE_TRANSITIONS.find(([key]) =>
            new RegExp(currentDisplayColorMode, 'i').test(key)
        );

        if (!transition) return;

        const [, displayColorMode] = transition;

        try {
            await setAppConfigPrefs({
                ...appConfigPrefs,
                displayColorMode
            });
        } catch (error) {
            console.error('Error changing display mode:', error);
        }
    }, [appConfigPrefs, setAppConfigPrefs]);

    // Мемоизируем значение проверки режима
    const isLightMode = useMemo(() =>
            appConfigPrefs?.displayColorMode === 'light',
        [appConfigPrefs?.displayColorMode]
    );

    return (
        <div className={`sidebar_container jr_wrapper_container ${appConfigPrefs?.displayColorMode}-mode text-capitalize`}>
            <div className="sidebar-body flex flex-column text-alternate">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Enter your text here"
                    className="sidebar-input text-primary text-md"
                    disabled={isProcessing}
                />

                <div className="button-group" style={{ display: "flex", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
                    <button
                        className="flex flex-column align-items-center text-capitalize"
                        style={{ flex: "1 0 auto", minWidth: "120px" }}
                        onClick={handleTransformClick}
                        disabled={isProcessing || !text.trim()}>
                        <span className="text-bold">
                            {isProcessing ? "Processing..." : "Transform text"}
                        </span>
                    </button>

                    <button
                        className="flex flex-column align-items-center text-capitalize"
                        style={{ flex: "1 0 auto", minWidth: "110px" }}
                        onClick={handleClearClick}
                        disabled={isProcessing || (!text && !formattedText)}>
                        <span className="text-bold">Clear input</span>
                    </button>

                    <button
                        className="flex flex-column align-items-center text-capitalize"
                        style={{ flex: "1 0 auto", minWidth: "120px" }}
                        onClick={handleDownloadRtf}
                        disabled={isProcessing || !formattedText}>
                        <span className="text-bold">
                            {isProcessing ? "Creating..." : "Save as RTF"}
                        </span>
                    </button>

                    {/*<button*/}
                    {/*    className="flex flex-column align-items-center text-capitalize"*/}
                    {/*    style={{ flex: "1 0 auto", minWidth: "120px" }}*/}
                    {/*    onClick={handleDownloadPdf}*/}
                    {/*    disabled={isProcessing || !formattedText}>*/}
                    {/*    <span className="text-bold">*/}
                    {/*        {isProcessing ? "Creating..." : "Save as PDF"}*/}
                    {/*    </span>*/}
                    {/*</button>*/}

                    <div className="toggle flex align-items-center h-60" style={{ marginLeft: "auto" }}>
                        <label className="toggle_label">
                            <input
                                className="toggle_input"
                                type="checkbox"
                                value={`${Object.fromEntries(COLOR_MODE_STATE_TRANSITIONS)[appConfigPrefs?.displayColorMode]} mode toggle`}
                                onChange={() => handleDisplayColorModeChange(appConfigPrefs?.displayColorMode)}
                                aria-description="light mode dark mode toggle"
                                id="display_mode_switch"
                                checked={isLightMode}
                                disabled={isProcessing}
                            />
                            <span className="toggle_slider"></span>
                        </label>
                    </div>
                </div>

                {formattedText && (
                    <div
                        id="formattedTextContainer"
                        className="formatted-text"
                        style={{
                            marginTop: "10px",
                            padding: "10px",
                            border: "1px solid #ccc",
                            borderRadius: "5px",
                            whiteSpace: "pre-wrap",
                            resize: "vertical",
                            overflow: "auto"
                        }}
                        dangerouslySetInnerHTML={{ __html: formattedText }}
                    />
                )}
            </div>
        </div>
    );
}

export default SidebarPage;