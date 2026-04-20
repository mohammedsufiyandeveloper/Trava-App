import { GanttTask } from "./types";
import { format, eachDayOfInterval, parseISO, min, max } from "date-fns";

const statusColors: Record<string, string> = {
    "TO_DO": "CBD5E1",      // slate-300
    "IN_PROGRESS": "93C5FD", // blue-300
    "REVIEW": "FCD34D",     // amber-300
    "HOLD": "FBBF24",       // amber-400
    "COMPLETED": "86EFAC",  // green-300
    "CANCELLED": "FCA5A5",  // red-300
};

export const exportGanttToExcel = async (tasks: GanttTask[], fileName: string = "gantt-export.xlsx") => {
    const XLSX = await import("xlsx-js-style");
    // 1. Calculate Date Range for Timeline
    const allDates: Date[] = [];
    tasks.forEach(t => {
        t.subtasks.forEach(st => {
            if (st.start) allDates.push(parseISO(st.start));
            if (st.end) allDates.push(parseISO(st.end));
        });
    });

    let timelineDates: Date[] = [];
    if (allDates.length > 0) {
        const minDate = min(allDates);
        const maxDate = max(allDates);
        timelineDates = eachDayOfInterval({ start: minDate, end: maxDate });
    }

    // Helper to calculate duration
    const getDuration = (start: string | null, end: string | null): number | null => {
        if (!start || !end) return null;
        const s = parseISO(start);
        const e = parseISO(end);
        if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
        const timeDiff = e.getTime() - s.getTime();
        const days = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // Inclusive
        return days > 0 ? days : 1;
    };

    // 2. Prepare Data Rows (Cols A-K)
    const rows: any[] = [];

    tasks.forEach(task => {
        // Add Parent Task
        rows.push({
            name: task.name,
            type: "Task",
            project: task.projectName || "Unknown",
            assignee: task.assignee?.name || "",
            status: "",
            start: null,
            end: null,
            duration: null,
            deps: "",
            tag: "",
            desc: ""
        });

        // Add Subtasks
        task.subtasks.forEach(subtask => {
            rows.push({
                name: `    ${subtask.name}`,
                type: "Subtask",
                project: task.projectName || "Unknown",
                assignee: subtask.assignee?.name || "Unassigned",
                status: subtask.status?.toUpperCase() || "",
                start: subtask.start ? parseISO(subtask.start) : null,
                end: subtask.end ? parseISO(subtask.end) : null,
                duration: getDuration(subtask.start, subtask.end),
            });
        });
    });

    // 3. Create Sheet
    const worksheet = XLSX.utils.json_to_sheet([]);
    XLSX.utils.sheet_add_json(worksheet, rows, { skipHeader: true, origin: "A2" });

    // 4. Write Headers
    const staticHeaders = ["Task Name", "Type", "Project", "Assigned To", "Status", "Start Date", "End Date", "Duration"];

    // Write Static Headers (A1:K1)
    staticHeaders.forEach((h, i) => {
        const cellRef = XLSX.utils.encode_cell({ c: i, r: 0 });
        worksheet[cellRef] = {
            t: 's',
            v: h,
            s: {
                font: { bold: true },
                fill: { fgColor: { rgb: "F3F4F6" } },
                border: {
                    top: { style: "thin", color: { rgb: "D1D5DB" } },
                    bottom: { style: "thin", color: { rgb: "D1D5DB" } }
                },
                alignment: { horizontal: "center", vertical: "center" }
            }
        };
    });

    // Write Timeline Headers (L1+)
    timelineDates.forEach((date, i) => {
        const colIndex = 11 + i; // L is 11
        const cellRef = XLSX.utils.encode_cell({ c: colIndex, r: 0 });
        worksheet[cellRef] = {
            t: 'd',
            v: date,
            z: 'mmm dd',
            s: {
                font: { bold: true, sz: 9 },
                fill: { fgColor: { rgb: "F3F4F6" } },
                alignment: { horizontal: "center", vertical: "center", textRotation: 90 },
                border: {
                    top: { style: "thin", color: { rgb: "D1D5DB" } },
                    bottom: { style: "thin", color: { rgb: "D1D5DB" } }
                }
            }
        };
    });

    // 5. Add Timeline Bars with Formulas and Styling
    const rowCount = rows.length;
    const colStart = 11; // L
    const colEnd = 11 + timelineDates.length - 1;

    for (let r = 0; r < rowCount; r++) {
        const worksheetRowIndex = r + 1;
        const excelRowNumber = r + 2;
        const rowData = rows[r];

        // Add borders to all data cells (A-K columns)
        for (let c = 0; c < 11; c++) {
            const cellRef = XLSX.utils.encode_cell({ c: c, r: worksheetRowIndex });
            if (worksheet[cellRef]) {
                worksheet[cellRef].s = {
                    ...worksheet[cellRef].s,
                    border: {
                        top: { style: "thin", color: { rgb: "E5E7EB" } },
                        bottom: { style: "thin", color: { rgb: "E5E7EB" } }
                    }
                };
            }
        }

        // Format Start Date (Col F = index 5)
        const startCellRef = XLSX.utils.encode_cell({ c: 5, r: worksheetRowIndex });
        if (worksheet[startCellRef]) {
            worksheet[startCellRef].z = "dd/mm/yyyy";
        }

        // Only apply formulas if we have start/end data (Subtasks)
        if (rowData.start && rowData.end) {
            // Overwrite End Date (Col G = index 6) with Formula: =F + H - 1
            const endCellRef = XLSX.utils.encode_cell({ c: 6, r: worksheetRowIndex });
            const startRef = `F${excelRowNumber}`;
            const durRef = `H${excelRowNumber}`;

            worksheet[endCellRef] = {
                t: 'n',
                f: `${startRef}+${durRef}-1`,
                z: "dd/mm/yyyy",
                s: {
                    border: {
                        top: { style: "thin", color: { rgb: "E5E7EB" } },
                        bottom: { style: "thin", color: { rgb: "E5E7EB" } }
                    }
                }
            };

            // Determine Color based on Status
            const normalizedStatus = (rowData.status || "").toUpperCase().trim();
            const rowColor = statusColors[normalizedStatus] || "93C5FD"; // Default to blue

            // Calculate which dates fall within the task range
            const taskStart = rowData.start;
            const taskEnd = rowData.end;

            // Add Timeline Bars with FORMULAS - will update when duration changes
            for (let c = colStart; c <= colEnd; c++) {
                const cellRef = XLSX.utils.encode_cell({ c: c, r: worksheetRowIndex });
                const colLetter = XLSX.utils.encode_col(c);
                const timelineDate = timelineDates[c - colStart];

                // Check if this timeline date is within the task's date range
                const isWithinRange = timelineDate >= taskStart && timelineDate <= taskEnd;

                // Formula: IF(AND(timeline_date >= start_date, timeline_date <= start_date + duration - 1), " ", "")
                // Using F (Start Date) and H (Duration) so it updates when you change Duration
                const formula = `IF(AND(${colLetter}$1>=$F${excelRowNumber},${colLetter}$1<=$F${excelRowNumber}+$H${excelRowNumber}-1)," ","")`;

                if (isWithinRange) {
                    // Cell is within range - add formula with colored background
                    worksheet[cellRef] = {
                        t: 's',
                        f: formula,
                        s: {
                            fill: {
                                patternType: "solid",
                                fgColor: { rgb: rowColor }
                            },
                            alignment: {
                                horizontal: "center",
                                vertical: "center"
                            },
                            border: {
                                top: { style: "thin", color: { rgb: "FFFFFF" } },
                                bottom: { style: "thin", color: { rgb: "FFFFFF" } }
                            }
                        }
                    };
                } else {
                    // Cell is outside range - add formula without colored background
                    worksheet[cellRef] = {
                        t: 's',
                        f: formula,
                        s: {
                            alignment: {
                                horizontal: "center",
                                vertical: "center"
                            },
                            border: {
                                top: { style: "thin", color: { rgb: "E5E7EB" } },
                                bottom: { style: "thin", color: { rgb: "E5E7EB" } }
                            }
                        }
                    };
                }
            }
        } else {
            // For parent tasks (no dates), add borders to timeline cells
            for (let c = colStart; c <= colEnd; c++) {
                const cellRef = XLSX.utils.encode_cell({ c: c, r: worksheetRowIndex });
                worksheet[cellRef] = {
                    t: 's',
                    v: "",
                    s: {
                        border: {
                            top: { style: "thin", color: { rgb: "E5E7EB" } },
                            bottom: { style: "thin", color: { rgb: "E5E7EB" } }
                        }
                    }
                };
            }
        }
    }

    // 6. Set Column Widths
    const wscols = [
        { wch: 40 }, // Task Name
        { wch: 10 }, // Type
        { wch: 20 }, // Project
        { wch: 20 }, // Assigned To
        { wch: 15 }, // Status
        { wch: 12 }, // Start Date
        { wch: 12 }, // End Date
        { wch: 15 }, // Duration
        { wch: 30 }, // Dependencies
        { wch: 15 }, // Tag
        { wch: 40 }, // Description
    ];

    const timelineCols = timelineDates.map(() => ({ wch: 3 }));
    worksheet["!cols"] = [...wscols, ...timelineCols];

    // Set the range for the worksheet
    const lastRow = rowCount + 1;
    const lastCol = colEnd;
    worksheet['!ref'] = `A1:${XLSX.utils.encode_col(lastCol)}${lastRow}`;

    // 7. Create workbook
    const workbook = XLSX.utils.book_new();
    workbook.Props = {
        Title: "Gantt Chart Export",
        Subject: "Task Timeline",
        Author: "Tusker Management",
        CreatedDate: new Date()
    };

    workbook.Workbook = {
        Views: [{
            RTL: false
        }]
    };

    XLSX.utils.book_append_sheet(workbook, worksheet, "Gantt Tasks");

    // 8. Write file with styling support
    XLSX.writeFile(workbook, fileName, {
        bookType: 'xlsx',
        cellStyles: true
    });
};

export const exportGanttToPDF = async (tasks: GanttTask[], fileName: string = "gantt-export.pdf") => {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;

    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(16);
    doc.text("Gantt Chart Export", 14, 15);
    
    const tableData: any[][] = [];
    
    tasks.forEach(task => {
        tableData.push([
            task.name,
            task.assignee?.name || "",
            "",
            "",
            ""
        ]);
        
        task.subtasks.forEach(subtask => {
            const startDateStr = subtask.start ? format(parseISO(subtask.start), 'dd/MM/yyyy') : 'N/A';
            const endDateStr = subtask.end ? format(parseISO(subtask.end), 'dd/MM/yyyy') : 'N/A';
            
            tableData.push([
                `   ${subtask.name}`,
                subtask.assignee?.name || "Unassigned",
                subtask.status?.replace(/_/g, ' ') || "TO DO",
                subtask.days?.toString() || "-",
                `${startDateStr} - ${endDateStr}`
            ]);
        });
    });

    autoTable(doc, {
        head: [['Task Name', 'Assignee', 'Status', 'Days', 'Dates']],
        body: tableData,
        startY: 20,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0] },
        didParseCell: function(data) {
            // @ts-ignore
            if (data.row.raw[2] === "" && data.row.raw[3] === "" && data.row.raw[4] === "") {
                data.cell.styles.fontStyle = 'bold';
            }
        }
    });

    doc.save(fileName);
};
