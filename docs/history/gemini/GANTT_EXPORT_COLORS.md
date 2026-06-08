# Gantt Export - Color Background Issue

## Problem
The `xlsx` library (Community Edition) does **NOT** support cell background fill colors. The `fill.fgColor` property is ignored when writing the Excel file.

## Solutions

### Option 1: Manual Coloring in Excel (Current Approach)
After exporting:
1. Open the Excel file
2. Select the timeline columns (L onwards)
3. Use Excel's conditional formatting to color cells based on the formula values

### Option 2: Use ExcelJS (Recommended)
Install ExcelJS which has full styling support:
```bash
npm install exceljs
```

Then rewrite the export function to use ExcelJS instead of xlsx.

### Option 3: Use xlsx-style (Fork with Styling)
```bash
npm install xlsx-style
```

This is a fork of xlsx that adds styling support.

## Current Status
- Formulas are working correctly (bars show/hide based on dates)
- Dynamic updates work (changing dates updates the bars)
- Colors are NOT working due to library limitations

## Recommendation
Please install ExcelJS and I can rewrite the export to use it, which will give you:
- Full background color support
- Better styling options
- More reliable Excel file generation
