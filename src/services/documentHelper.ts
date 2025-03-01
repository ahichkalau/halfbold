import {jsPDF} from "jspdf";

// Константы для настроек RTF
const RTF_FONT_TABLE = "{\\fonttbl{\\f0 Arial;}{\\f1 Times New Roman;}{\\f2 Courier New;}}";
const RTF_COLOR_TABLE = "{\\colortbl;\\red0\\green0\\blue0;\\red255\\green0\\blue0;\\red102\\green102\\blue102;}";

export const htmlToRtf = (html: string): string => {
    // Базовые настройки RTF с расширенным набором шрифтов и цветов
    let rtf = "{\\rtf1\\ansi\\deff0" + RTF_FONT_TABLE + RTF_COLOR_TABLE;

    // Выполняем замены для различных тегов и спецсимволов с улучшенной поддержкой Unicode
    let rtfContent = html
        // Обработка unicode символов
        .replace(/[\u0080-\uFFFF]/g, (match) => {
            const code = match.charCodeAt(0);
            return `\\u${code}?`;
        })
        // Спецсимвол неразрывного пробела
        .replace(/&nbsp;/g, " ")

        // Абзацы (<p>...</p>)
        .replace(/<p>([\s\S]*?)<\/p>/gi, "\\par $1\\par ")

        // Кастомные теги с улучшенной обработкой
        .replace(/<br-bold>([\s\S]*?)<\/br-bold>/gi, "\\b $1\\b0 ")
        .replace(/<br-edge>([\s\S]*?)<\/br-edge>/gi, "\\cf3 $1\\cf0 ")

        // Для разного fixation-strength используем разные стили
        .replace(/<br-fixation fixation-strength="1">(.*?)<\/br-fixation>/gi, "\\cf0\\b $1\\b0\\cf0 ")
        .replace(/<br-fixation fixation-strength="2">(.*?)<\/br-fixation>/gi, "\\cf0\\b $1\\b0\\cf0 ")
        .replace(/<br-fixation fixation-strength="3">(.*?)<\/br-fixation>/gi, "\\cf3 $1\\cf0 ")
        .replace(/<br-fixation fixation-strength="4">(.*?)<\/br-fixation>/gi, "\\cf3 $1\\cf0 ")
        .replace(/<br-span>([\s\S]*?)<\/br-span>/gi, "\\cf2 $1\\cf0 ")
        .replace(/<br-span>([\s\S]*?)<\/br-span>/gi, "$1")

        // Стандартные HTML-теги
        .replace(/<b>([\s\S]*?)<\/b>/gi, "\\b $1\\b0 ")
        .replace(/<strong>([\s\S]*?)<\/strong>/gi, "\\b $1\\b0 ")
        .replace(/<i>([\s\S]*?)<\/i>/gi, "\\i $1\\i0 ")
        .replace(/<em>([\s\S]*?)<\/em>/gi, "\\i $1\\i0 ")
        .replace(/<u>([\s\S]*?)<\/u>/gi, "\\ul $1\\ulnone ")
        .replace(/<h1>([\s\S]*?)<\/h1>/gi, "\\fs36\\b $1\\b0\\fs24 ")
        .replace(/<h2>([\s\S]*?)<\/h2>/gi, "\\fs32\\b $1\\b0\\fs24 ")
        .replace(/<h3>([\s\S]*?)<\/h3>/gi, "\\fs28\\b $1\\b0\\fs24 ")
        .replace(/<h4>([\s\S]*?)<\/h4>/gi, "\\fs26\\b $1\\b0\\fs24 ")
        .replace(/<h5>([\s\S]*?)<\/h5>/gi, "\\fs24\\b $1\\b0\\fs24 ")
        .replace(/<h6>([\s\S]*?)<\/h6>/gi, "\\fs22\\b $1\\b0\\fs24 ")

        // Параграфы и переносы строк
        .replace(/<\/?p>/gi, "\\par ")
        .replace(/<br\s*\/?>/gi, "\\par ")
        .replace(/\r?\n/g, "\\par ")

        // Спецсимволы
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, "\"")
        .replace(/&apos;/gi, "'");

    // Сохраняем последовательности пробелов
    rtfContent = rtfContent.replace(/ {2,}/g, match => {
        return ' ' + '\\~'.repeat(match.length - 1);
    });

    // Формируем итоговый RTF с правильным форматированием страницы
    rtf += "{\\pard\\fs24 " + rtfContent + "\\par}}"

    return rtf;
};

// // Функция для преобразования HTML с кастомными тегами в простой HTML для PDF
// const prepareHtmlForPdf = useCallback((html: string): string => {
//     // Заменяем кастомные теги на стандартные HTML-теги с соответствующими стилями
//     return html
//         // Кастомные теги для formatting
//         .replace(/<br-bold>([\s\S]*?)<\/br-bold>/gi, '<strong style="font-weight: bold;">$1</strong>')
//         .replace(/<br-edge>([\s\S]*?)<\/br-edge>/gi, '<span style="color: #666666;">$1</span>')
//         .replace(/<br-fixation fixation-strength="1">(.*?)<\/br-fixation>/gi, '<strong>$1</strong>')
//         .replace(/<br-fixation fixation-strength="2">(.*?)<\/br-fixation>/gi, '<strong>$1</strong>')
//         .replace(/<br-fixation fixation-strength="3">(.*?)<\/br-fixation>/gi, '<span style="color: #666666;">$1</span>')
//         .replace(/<br-fixation fixation-strength="4">(.*?)<\/br-fixation>/gi, '<span style="color: #666666;">$1</span>')
//         .replace(/<br-span>([\s\S]*?)<\/br-span>/gi, '<span style="color: #FF0000;">$1</span>')
//         // Структурные элементы
//         .replace(/<\/?p>/gi, '<br>')
//         .replace(/\r?\n/g, '<br>');
// }, []);

// const handleDownloadPdf = useCallback(() => {
//     if (!formattedText) return;
//     setIsProcessing(true);
//
//     setTimeout(() => {
//         try {
//             // Create new PDF document with Unicode support
//             const pdf = new jsPDF({
//                 orientation: 'portrait',
//                 unit: 'mm',
//                 format: 'a4',
//                 compress: true,
//                 putOnlyUsedFonts: true,
//                 hotfixes: ["px_scaling"]
//             });
//
//             // Use built-in fonts with best Unicode support
//             // Default to helvetica, which has better support than most
//             pdf.setFont('helvetica');
//
//             const margin = 10;
//             const pageWidth = pdf.internal.pageSize.width;
//             const pageHeight = pdf.internal.pageSize.height;
//             const textWidth = pageWidth - (2 * margin);
//
//             // Function to detect script type with improved detection
//             const detectScript = (text: string): string => {
//                 if (/[\u0600-\u06FF]/.test(text)) return 'arabic';
//                 if (/[\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F]/.test(text)) return 'cyrillic'; // Extended Cyrillic range
//                 if (/[\u0900-\u097F]/.test(text)) return 'devanagari';
//                 if (/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'japanese';
//                 if (/[\u4e00-\u9fff]/.test(text)) return 'chinese';
//                 if (/[\uAC00-\uD7AF]/.test(text)) return 'korean';
//                 if (/[\u0370-\u03FF\u1F00-\u1FFF]/.test(text)) return 'greek';
//                 if (/[\u0590-\u05FF]/.test(text)) return 'hebrew';
//                 if (/[\u0E00-\u0E7F]/.test(text)) return 'thai';
//                 return 'latin';
//             };
//
//             // Function to handle text direction
//             const isRTL = (script: string): boolean => {
//                 return ['arabic', 'hebrew'].includes(script);
//             };
//
//             // Enhanced Unicode text encoding
//             const encodeText = (text: string): string => {
//                 // Convert characters to proper encoding format for jsPDF
//                 const encoded = text.split('').map(char => {
//                     const code = char.charCodeAt(0);
//                     // Special handling for Cyrillic characters
//                     if (code >= 0x0400 && code <= 0x04FF) {
//                         return String.fromCharCode(code);
//                     }
//                     // For other characters
//                     return code > 127 ?
//                         encodeURIComponent(char).replace(/%/g, '\\') :
//                         char;
//                 }).join('');
//
//                 return encoded;
//             };
//
//             // Modified writeLine function with safer Unicode handling
//             function writeLine(segments, startX, yPos) {
//                 segments.forEach(segment => {
//                     if (segment.isSpace) return;
//
//                     const script = detectScript(segment.firstHalf + segment.secondHalf);
//
//                     // Calculate spacing based on script type and word length
//                     const getSpacing = (word, script) => {
//                         if (script === 'arabic' || script === 'hebrew') return -0.5;
//                         if (['chinese', 'japanese', 'korean'].includes(script)) return 1;
//                         if (script === 'cyrillic') {
//                             // Adjust spacing for Cyrillic based on word length
//                             if (word.length <= 2) return 0.1;
//                             if (word.length <= 4) return 0.4;
//                             if (word.length <= 6) return 0.9;
//                             return 1.3;
//                         }
//                         if (word.length <= 2) return 0;
//                         if (word.length <= 4) return 0.3;
//                         if (word.length <= 6) return 0.8;
//                         return 1.2;
//                     };
//
//                     const spacing = getSpacing(segment.firstHalf + segment.secondHalf, script);
//
//                     try {
//                         // Write first half (bold)
//                         pdf.setFont('helvetica', 'bold');
//                         pdf.setTextColor(0, 0, 0);
//
//                         let firstHalfText = segment.firstHalf;
//                         if (script !== 'latin') {
//                             // For non-Latin scripts, use Unicode
//                             firstHalfText = segment.firstHalf;
//                         }
//
//                         pdf.text(firstHalfText, segment.x, yPos);
//
//                         // Write second half (gray)
//                         pdf.setFont('helvetica', 'normal');
//                         pdf.setTextColor(102, 102, 102);
//
//                         let secondHalfText = segment.secondHalf;
//                         if (script !== 'latin') {
//                             // For non-Latin scripts, use Unicode
//                             secondHalfText = segment.secondHalf;
//                         }
//
//                         const boldWidth = pdf.getTextWidth(segment.firstHalf);
//                         pdf.text(secondHalfText, segment.x + boldWidth + spacing, yPos);
//                     } catch (e) {
//                         console.warn('Error rendering text segment:', e);
//                         // Fallback rendering - render as a single piece with default styling
//                         pdf.setFont('helvetica', 'normal');
//                         pdf.setTextColor(0, 0, 0);
//                         pdf.text(segment.firstHalf + segment.secondHalf, segment.x, yPos);
//                     }
//                 });
//             }
//
//             // Process paragraphs
//             const cleanedHtml = prepareHtmlForPdf(formattedText);
//             const paragraphs = cleanedHtml.split('<br>').filter(p => p.trim().length > 0);
//             let y = margin;
//
//             pdf.setFontSize(11);
//
//             // Process each paragraph
//             paragraphs.forEach(paragraph => {
//                 const plainParagraph = paragraph.replace(/<[^>]*>/g, '');
//                 if (!plainParagraph.trim()) return;
//
//                 const segments = plainParagraph.split(/(\s+)/);
//                 let currentLine = '';
//                 let lineSegments = [];
//                 let x = margin;
//
//                 segments.forEach((segment, idx) => {
//                     if (!segment) return;
//
//                     const isSpace = /^\s+$/.test(segment);
//
//                     if (isSpace) {
//                         const spaceWidth = pdf.getTextWidth(' '); // Use fixed width for spaces for reliability
//                         if (x + spaceWidth <= pageWidth - margin) {
//                             lineSegments.push({
//                                 text: segment,
//                                 isSpace: true,
//                                 x: x
//                             });
//                             x += spaceWidth;
//                             currentLine += segment;
//                         } else {
//                             writeLine(lineSegments, margin, y);
//                             y += 6;
//                             if (y > pageHeight - margin) {
//                                 pdf.addPage();
//                                 y = margin;
//                             }
//                             lineSegments = [];
//                             currentLine = '';
//                             x = margin;
//                         }
//                     } else {
//                         try {
//                             const midPoint = Math.ceil(segment.length / 2);
//                             const firstHalf = segment.substring(0, midPoint);
//                             const secondHalf = segment.substring(midPoint);
//
//                             // Get script type for this word
//                             const script = detectScript(segment);
//
//                             // Get word width with error handling
//                             let firstHalfWidth = 0;
//                             let secondHalfWidth = 0;
//
//                             try {
//                                 pdf.setFont('helvetica', 'bold');
//                                 firstHalfWidth = pdf.getTextWidth(firstHalf);
//
//                                 pdf.setFont('helvetica', 'normal');
//                                 secondHalfWidth = pdf.getTextWidth(secondHalf);
//                             } catch (e) {
//                                 // Fallback for width calculation errors
//                                 const avgCharWidth = 2.5; // approximate width in mm for an average character
//                                 firstHalfWidth = firstHalf.length * avgCharWidth;
//                                 secondHalfWidth = secondHalf.length * avgCharWidth;
//                                 console.warn('Using fallback width calculation for:', segment);
//                             }
//
//                             const wordWidth = firstHalfWidth + secondHalfWidth;
//
//                             if (x + wordWidth > pageWidth - margin) {
//                                 writeLine(lineSegments, margin, y);
//                                 y += 6;
//                                 if (y > pageHeight - margin) {
//                                     pdf.addPage();
//                                     y = margin;
//                                 }
//                                 lineSegments = [];
//                                 currentLine = '';
//                                 x = margin;
//                             }
//
//                             lineSegments.push({
//                                 firstHalf,
//                                 secondHalf,
//                                 isSpace: false,
//                                 x: x
//                             });
//                             x += wordWidth;
//                             currentLine += segment;
//                         } catch (e) {
//                             console.warn('Error processing segment:', segment, e);
//                             // Skip problematic segments
//                         }
//                     }
//                 });
//
//                 if (lineSegments.length > 0) {
//                     writeLine(lineSegments, margin, y);
//                     y += 6;
//                 }
//
//                 y += 4;
//
//                 if (y > pageHeight - margin) {
//                     pdf.addPage();
//                     y = margin;
//                 }
//             });
//
//             const fileName = `formatted-text-${new Date().toISOString().slice(0, 10)}.pdf`;
//             pdf.save(fileName);
//
//         } catch (error) {
//             console.error('Error creating PDF:', error);
//             alert('Error creating PDF file. Please try again.');
//         } finally {
//             setIsProcessing(false);
//         }
//     }, 0);
// }, [formattedText, prepareHtmlForPdf]);