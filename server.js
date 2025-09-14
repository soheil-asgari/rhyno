import express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import ExcelJS from 'exceljs';
import puppeteer from "puppeteer";
import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";
import path from 'path';
import { fileURLToPath } from 'url';



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, "outputs");
const app = express();
app.use(bodyParser.json());

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const DOMAIN = process.env.DOMAIN || "http://dl.rhyno-cdn.shop";


// ---------- Helpers ----------
function applyHeaderStyle(row) {
    row.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Vazirmatn' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
        };
    });
}

function applyDataStyle(row) {
    row.eachCell(cell => {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = { name: 'Vazirmatn' };
        cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
        };
    });
}

// ---------- Route ----------
app.post("/tools/generate_excel", async (req, res) => {
    try {
        let { headers, data, filename, sheetNames } = req.body;

        filename = filename || `output_${Date.now()}.xlsx`;
        const finalSheetNames = (Array.isArray(sheetNames) && sheetNames.length > 0) ? sheetNames : ["Sheet1"];

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(finalSheetNames[0]);

        if (Array.isArray(headers) && headers.length > 0) {
            worksheet.columns = headers.map(h => ({ header: h, key: h, width: 25 }));
        }

        if (Array.isArray(data) && data.length > 0) {
            worksheet.addRows(data);
        }

        // ✅✅✅ منطق جدید و هوشمند برای جمع خودکار ستون‌های عددی ✅✅✅
        if (Array.isArray(data) && data.length > 0 && Array.isArray(headers)) {
            const totalRowNumber = data.length + 2;
            let labelPlaced = false;

            for (let colIndex = 0; colIndex < headers.length; colIndex++) {
                const isNumericColumn = data.every(row =>
                    row && row[colIndex] !== null && row[colIndex] !== '' && !isNaN(parseFloat(row[colIndex]))
                );

                if (isNumericColumn) {
                    const column = worksheet.getColumn(colIndex + 1);
                    if (!column || !column.letter) continue;

                    const columnLetter = column.letter;
                    const formulaCellAddress = `${columnLetter}${totalRowNumber}`;
                    const formulaString = `SUM(${columnLetter}2:${columnLetter}${totalRowNumber - 1})`;

                    const formulaCell = worksheet.getCell(formulaCellAddress);
                    formulaCell.value = { formula: formulaString };
                    formulaCell.font = { bold: true, name: 'Vazirmatn' };
                    formulaCell.numFmt = '#,##0';

                    if (!labelPlaced) {
                        const firstColumn = worksheet.getColumn(1);
                        if (firstColumn.letter) {
                            const labelCell = worksheet.getCell(`${firstColumn.letter}${totalRowNumber}`);
                            labelCell.value = "جمع کل";
                            labelCell.font = { bold: true, name: 'Vazirmatn' };
                            labelPlaced = true;
                        }
                    }
                }
            }
        }

        // --- Styling ---
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) {
                applyHeaderStyle(row);
            } else if (data && rowNumber <= data.length + 1) {
                applyDataStyle(row);
            }
        });

        // Freeze header
        worksheet.views = [{ state: 'frozen', ySplit: 1 }];

        const filepath = path.join(OUTPUT_DIR, filename);
        await workbook.xlsx.writeFile(filepath);

        res.json({
            message: `فایل اکسل هوشمند با موفقیت ایجاد شد.`,
            url: `${DOMAIN}/outputs/${filename}`
        });

    } catch (error) {
        console.error("خطا در ساخت فایل اکسل حرفه‌ای:", error);
        res.status(500).json({ message: "خطا در ساخت فایل اکسل رخ داد." });
    }
});



app.post("/tools/generate_pdf", async (req, res) => {
    try {
        let { title, content, filename, titleFontSize, contentFontSize } = req.body;
        filename = filename || `output_${Date.now()}.pdf`;
        title = title || "";
        content = content || "";
        const finalTitleFontSize = titleFontSize || 36;
        const finalContentFontSize = contentFontSize || 14;
        const filepath = path.join(OUTPUT_DIR, filename);
        const fontPath = path.join(__dirname, 'fonts', 'Vazirmatn-Regular.ttf');
        const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>@font-face {font-family: 'Vazir';src: url('file://${fontPath}');}body {font-family: 'Vazir', sans-serif;direction: rtl;text-align: center;padding: 50px;}h1 {font-size: ${finalTitleFontSize}px;}p {font-size: ${finalContentFontSize}px;text-align: right;}</style></head><body><h1>${title}</h1><p>${content}</p></body></html>`;
        const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        await page.pdf({ path: filepath, format: 'A4', printBackground: true });
        await browser.close();
        res.json({ message: `فایل PDF با موفقیت ایجاد شد.`, url: `${DOMAIN}/outputs/${filename}` });
    } catch (error) {
        console.error("خطا در ساخت PDF با Puppeteer:", error);
        res.status(500).json({ message: "خطا در ساخت فایل PDF رخ داد." });
    }
});

app.post("/tools/generate_word", async (req, res) => {
    let { title, content, filename } = req.body;
    title = title || `سند Word`;
    content = content || `این یک متن آزمایشی به زبان فارسی است.`;
    filename = filename || `output_${Date.now()}.docx`;
    const doc = new Document({
        styles: { default: { document: { run: { font: "Vazir", rightToLeft: true } } } },
        sections: [{
            properties: {},
            children: [
                new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 28 })], alignment: AlignmentType.CENTER, rightToLeft: true }),
                new Paragraph({ children: [new TextRun({ text: content, size: 24 })], alignment: AlignmentType.RIGHT, rightToLeft: true }),
            ],
        }],
    });
    const buffer = await Packer.toBuffer(doc);
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, buffer);
    res.json({ message: `فایل Word ایجاد شد.`, url: `${DOMAIN}/outputs/${filename}` });
});



app.use("/outputs", express.static(OUTPUT_DIR));
app.listen(3000, () => console.log("✅ MCP Server running on port 3000"));
