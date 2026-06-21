/**
 * 客户端 Excel 生成（纯浏览器，无 fs/child_process 依赖）
 *
 * 用于替代服务端 API：
 * - generateExportExcel: 生成成绩明细表导出文件
 * - generateMasterTemplate: 生成母表模板
 * - generateSubTemplate: 生成子表名单模板
 *
 * 使用 exceljs（在浏览器中通过 Buffer/ArrayBuffer 写出）
 */
import ExcelJS from "exceljs";
import type { SubRecord, GradeConfig } from "@/lib/score-utils";

// ============ 样式常量 ============

const COLORS = {
  title: "FF065F46",
  group: "FF047857",
  subGroupClass: "FF0D9488",
  subGroupAfter: "FF0891B2",
  header: "FFD1FAE5",
  warn: "FFFEE2E2",
  mismatch: "FFFEF3C7",
  total: "FFF0FDF4",
  border: "FF9CA3AF",
  borderLight: "FFD1D5DB",
  text: "FF374151",
  textDark: "FF065F46",
  textMuted: "FF6B7280",
};

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: COLORS.border } },
  left: { style: "thin", color: { argb: COLORS.border } },
  bottom: { style: "thin", color: { argb: COLORS.border } },
  right: { style: "thin", color: { argb: COLORS.border } },
};

const thinBorderLight: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: COLORS.borderLight } },
  left: { style: "thin", color: { argb: COLORS.borderLight } },
  bottom: { style: "thin", color: { argb: COLORS.borderLight } },
  right: { style: "thin", color: { argb: COLORS.borderLight } },
};

const fill = (argb: string) => ({
  type: "pattern" as const,
  pattern: "solid",
  fgColor: { argb },
});

// ============ 导出 Excel ============

export interface ExportParams {
  records: SubRecord[];
  config: GradeConfig;
  courseName: string;
  className: string;
  teacherName: string;
}

/**
 * 生成成绩明细表导出文件，返回 Blob
 */
export async function generateExportExcel(params: ExportParams): Promise<Blob> {
  const { records, config, courseName, className, teacherName } = params;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "平时成绩小分计算工具";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("成绩明细表", {
    views: [{ state: "frozen", ySplit: 5, xSplit: 3 }],
  });

  // 列宽
  const colWidths = [5, 14, 10, 5, 8, 8, 8, 8, 8, 8, 8, 8, 10, 9, 9, 9, 7, 16];
  colWidths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  // ===== 第1行: 标题 =====
  sheet.mergeCells("A1:R1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = className ? `${className}学生成绩明细表` : "学生成绩明细表";
  titleCell.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = fill(COLORS.title);
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 32;

  // ===== 第2行: 课程信息 =====
  sheet.mergeCells("A2:R2");
  const infoCell = sheet.getCell("A2");
  infoCell.value = `课程名称: ${courseName || ""}    授课教师姓名: ${teacherName || ""}    班级: ${className || ""}`;
  infoCell.font = { size: 11, color: { argb: COLORS.text } };
  infoCell.fill = fill(COLORS.total);
  infoCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  sheet.getRow(2).height = 22;

  // ===== 第3-5行: 3层表头 =====
  sheet.mergeCells("A3:A5");
  sheet.mergeCells("B3:B5");
  sheet.mergeCells("C3:C5");
  sheet.mergeCells("D3:D5");
  sheet.mergeCells("E3:M3");
  sheet.mergeCells("N3:N5");
  sheet.mergeCells("O3:O5");
  sheet.mergeCells("P3:P5");
  sheet.mergeCells("Q3:Q5");
  sheet.mergeCells("R3:R5");
  sheet.mergeCells("E4:E5");
  sheet.mergeCells("F4:H4");
  sheet.mergeCells("I4:L4");
  sheet.mergeCells("M4:M5");

  const setHeaderCell = (
    cell: string,
    value: string,
    fillArgb: string,
    opts?: { size?: number; wrap?: boolean }
  ) => {
    const c = sheet.getCell(cell);
    c.value = value;
    c.font = {
      bold: true,
      size: opts?.size ?? 10,
      color: { argb: "FFFFFFFF" },
    };
    c.fill = fill(fillArgb);
    c.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: opts?.wrap ?? true,
    };
    c.border = thinBorder;
  };

  // 第3层
  setHeaderCell("A3", "序号", COLORS.group);
  setHeaderCell("B3", "学号", COLORS.group);
  setHeaderCell("C3", "姓名", COLORS.group);
  setHeaderCell("D3", "性别", COLORS.group);
  setHeaderCell("E3", "平时成绩（30%）", COLORS.group, { size: 11 });
  setHeaderCell("N3", "期中成绩（20%）\n卷面成绩", COLORS.group);
  setHeaderCell("O3", "期末考试成绩（50%）\n卷面成绩", COLORS.group);
  setHeaderCell("P3", "总评成绩\n（百分制）", COLORS.group);
  setHeaderCell("Q3", "等级\n成绩", COLORS.group);
  setHeaderCell("R3", "备注", COLORS.group);

  // 第4层
  setHeaderCell("E4", "出勤情况\n（10分）", COLORS.subGroupAfter);
  setHeaderCell("F4", "课堂活动10分", COLORS.subGroupClass);
  setHeaderCell("I4", "课后活动10分", COLORS.subGroupAfter);
  setHeaderCell("M4", "平时总成绩\n（百分制）", COLORS.group);

  // 第5层 (子项)
  setHeaderCell("F5", "课堂参与\n（3分）", COLORS.header);
  setHeaderCell("G5", "笔记\n（3分）", COLORS.header);
  setHeaderCell("H5", "随堂考\n（4分）", COLORS.header);
  setHeaderCell("I5", "作业1\n（2分）", COLORS.header);
  setHeaderCell("J5", "作业2\n（3分）", COLORS.header);
  setHeaderCell("K5", "作业3\n（2分）", COLORS.header);
  setHeaderCell("L5", "作业4\n（3分）", COLORS.header);

  sheet.getRow(3).height = 20;
  sheet.getRow(4).height = 20;
  sheet.getRow(5).height = 28;

  // ===== 数据行 =====
  records.forEach((record, idx) => {
    const row = sheet.getRow(6 + idx);
    row.height = 20;
    const values = [
      idx + 1,
      record.studentId,
      record.name,
      "",
      record.attendance,
      record.classParticipation,
      record.notes,
      record.quiz,
      record.hw1,
      record.hw2,
      record.hw3,
      record.hw4,
      record.usualPercent,
      record.midterm ?? "",
      record.final ?? "",
      record.totalScore ?? "",
      record.grade,
      record.warning || "",
    ];
    values.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v;
      cell.border = thinBorder;
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.font = { size: 10 };
    });
    row.getCell(2).alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    row.getCell(16).font = { bold: true, size: 10 };

    if (record.matchStatus === "not_found") {
      row.eachCell((cell) => (cell.fill = fill(COLORS.warn)));
    } else if (record.matchStatus === "name_mismatch") {
      row.eachCell((cell) => (cell.fill = fill(COLORS.mismatch)));
    }
    if (record.matchStatus === "matched") {
      row.getCell(13).fill = fill(COLORS.total);
      row.getCell(13).font = { bold: true, size: 10, color: { argb: COLORS.textDark } };
    }
  });

  // ===== 统计行 =====
  const statsRow = sheet.getRow(6 + records.length);
  statsRow.height = 22;
  const valid = records.filter((r) => r.matchStatus !== "not_found");
  const n = valid.length || 1;
  const avg = (fn: (r: SubRecord) => number) =>
    Math.round(valid.reduce((s, r) => s + fn(r), 0) / n);

  statsRow.getCell(2).value = `平均分 (n=${valid.length})`;
  statsRow.getCell(2).font = { bold: true, size: 10 };
  statsRow.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
  statsRow.getCell(5).value = avg((r) => r.attendance);
  statsRow.getCell(6).value = avg((r) => r.classParticipation);
  statsRow.getCell(7).value = avg((r) => r.notes);
  statsRow.getCell(8).value = avg((r) => r.quiz);
  statsRow.getCell(9).value = avg((r) => r.hw1);
  statsRow.getCell(10).value = avg((r) => r.hw2);
  statsRow.getCell(11).value = avg((r) => r.hw3);
  statsRow.getCell(12).value = avg((r) => r.hw4);
  statsRow.getCell(13).value = avg((r) => r.usualPercent);
  statsRow.getCell(14).value = avg((r) => r.midterm ?? 0);
  statsRow.getCell(15).value = avg((r) => r.final ?? 0);
  statsRow.getCell(16).value = avg((r) => r.totalScore ?? 0);

  statsRow.eachCell((cell) => {
    cell.border = thinBorder;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.font = { bold: true, size: 10 };
    cell.fill = fill(COLORS.total);
  });

  // ===== 配置说明工作表 =====
  const configSheet = workbook.addWorksheet("配置说明");
  configSheet.columns = [
    { header: "项目", width: 28 },
    { header: "值", width: 44 },
  ];

  const cfgHeader = configSheet.getRow(1);
  cfgHeader.height = 22;
  cfgHeader.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = fill(COLORS.title);
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  const compositeName: Record<string, string> = {
    average: "平均: (课程积分 + 作业) / 2",
    homework_only: "仅作业",
    course_points_only: "仅课程积分",
    max: "取最大值: max(课程积分, 作业)",
    weighted: `加权: 课程积分×${Math.round(config.compositeWeight * 100)}% + 作业×${Math.round((1 - config.compositeWeight) * 100)}%`,
  };

  const configData: [string, string][] = [
    ["课程名称", courseName || "—"],
    ["班级", className || "—"],
    ["任课教师", teacherName || "—"],
    ["制表日期", new Date().toLocaleString("zh-CN")],
    ["", ""],
    ["【成绩构成】", ""],
    ["  平时成绩占比", `${Math.round(config.usualWeight * 100)}%`],
    ["  期中成绩占比", `${Math.round(config.midtermWeight * 100)}%`],
    ["  期末成绩占比", `${Math.round(config.finalWeight * 100)}%`],
    ["", ""],
    ["【平时成绩30分构成】", ""],
    ["  出勤情况", "10分 = round(母表签到百分制 / 10)"],
    ["  课堂活动", "10分 = round(综合分数 / 10)，拆分到课堂参与(3)+笔记(3)+随堂考(4)"],
    ["  课后活动", "10分 = round(综合分数 / 10)，拆分到作业1(2)+作业2(3)+作业3(2)+作业4(3)"],
    ["  综合分数计算方式", compositeName[config.compositeMode] || config.compositeMode],
    ["  平时总成绩(百分制)", "(出勤+课堂活动+课后活动) / 30 × 100"],
    ["", ""],
    ["【学生统计】", ""],
    ["  总人数", String(records.length)],
    ["  成功匹配", String(records.filter((r) => r.matchStatus === "matched").length)],
    ["  姓名不一致", String(records.filter((r) => r.matchStatus === "name_mismatch").length)],
    ["  未找到", String(records.filter((r) => r.matchStatus === "not_found").length)],
  ];

  configData.forEach(([k, v]) => {
    const r = configSheet.addRow({ key: k, value: v });
    if (k && !k.startsWith(" ") && v === "") {
      r.font = { bold: true, size: 11, color: { argb: COLORS.textDark } };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

// ============ 母表模板 ============

export async function generateMasterTemplate(): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "平时成绩小分计算工具";
  workbook.created = new Date();

  const headerFillObj = fill(COLORS.title);

  // ===== 综合成绩表 =====
  const ws1 = workbook.addWorksheet("综合成绩（各权重项百分制得分）");
  ws1.columns = [
    { header: "序号", key: "idx", width: 6 },
    { header: "学生姓名", key: "name", width: 12 },
    { header: "学号/工号", key: "sid", width: 16 },
    { header: "学院", key: "college", width: 14 },
    { header: "专业", key: "major", width: 20 },
    { header: "班级", key: "class", width: 16 },
    { header: "作业(100%)", key: "hw", width: 12 },
    { header: "考试(100%)", key: "exam", width: 12 },
    { header: "签到(100%)", key: "attend", width: 12 },
    { header: "课程积分(100%)", key: "cp", width: 14 },
    { header: "综合成绩", key: "total", width: 12 },
  ];
  const hr = ws1.getRow(1);
  hr.height = 22;
  hr.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = headerFillObj;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorderLight;
  });

  const sample = [
    { idx: 1, name: "张三", sid: "20230084178", college: "传媒学院", major: "摄影（新媒体摄影方向）", class: "新媒体摄影2307", hw: 84, exam: 24.9, attend: 89.29, cp: 70, total: 41.76 },
    { idx: 2, name: "李四", sid: "20230084179", college: "传媒学院", major: "摄影（新媒体摄影方向）", class: "新媒体摄影2307", hw: 84, exam: 24.9, attend: 96.43, cp: 60, total: 41.47 },
    { idx: 3, name: "王五", sid: "20230084180", college: "传媒学院", major: "摄影（新媒体摄影方向）", class: "新媒体摄影2307", hw: 0, exam: 22.2, attend: 85.71, cp: 20, total: 26.11 },
    { idx: 4, name: "赵六", sid: "20230084181", college: "传媒学院", major: "摄影（新媒体摄影方向）", class: "新媒体摄影2307", hw: 48, exam: 24, attend: 92.86, cp: 0, total: 36.89 },
  ];
  sample.forEach((s) => {
    const r = ws1.addRow(s);
    r.height = 18;
    r.eachCell((cell) => {
      cell.border = thinBorderLight;
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.font = { size: 10 };
    });
  });

  // ===== 考试统计表 =====
  const ws2 = workbook.addWorksheet("考试统计");
  ws2.columns = [
    { header: "学生姓名", key: "name", width: 12 },
    { header: "学号/工号", key: "sid", width: 16 },
    { header: "学院", key: "college", width: 14 },
    { header: "专业", key: "major", width: 20 },
    { header: "班级", key: "class", width: 16 },
    { header: "期中考试", key: "mid", width: 12 },
    { header: "期末考试", key: "fin", width: 12 },
  ];
  const hr2 = ws2.getRow(1);
  hr2.height = 22;
  hr2.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = headerFillObj;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorderLight;
  });
  const examSample = [
    { name: "张三", sid: "20230084178", college: "传媒学院", major: "摄影（新媒体摄影方向）", class: "新媒体摄影2307", mid: 83, fin: 0 },
    { name: "李四", sid: "20230084179", college: "传媒学院", major: "摄影（新媒体摄影方向）", class: "新媒体摄影2307", mid: 83, fin: 0 },
    { name: "王五", sid: "20230084180", college: "传媒学院", major: "摄影（新媒体摄影方向）", class: "新媒体摄影2307", mid: 74, fin: 0 },
  ];
  examSample.forEach((s) => {
    const r = ws2.addRow(s);
    r.height = 18;
    r.eachCell((cell) => {
      cell.border = thinBorderLight;
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.font = { size: 10 };
    });
  });

  // 说明
  ws1.addRow({});
  const note = ws1.addRow({});
  note.getCell(1).value = "说明：此模板需包含「综合成绩」和「考试统计」两个工作表。综合成绩表用于读取作业/签到/课程积分，考试统计表用于读取期中/期末卷面成绩。";
  note.getCell(1).font = { italic: true, color: { argb: COLORS.textMuted }, size: 9 };
  ws1.mergeCells(note.number, 1, note.number, 11);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

// ============ 子表模板 ============

export async function generateSubTemplate(): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "平时成绩小分计算工具";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("成绩明细表");
  const widths = [5, 14, 10, 5, 8, 8, 8, 8, 8, 8, 8, 8, 10, 9, 9, 9, 7, 16];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const groupFillObj = fill(COLORS.group);
  const headerFill2Obj = fill(COLORS.header);
  const tealFillObj = fill(COLORS.subGroupClass);
  const cyanFillObj = fill(COLORS.subGroupAfter);
  const titleFillObj = fill(COLORS.title);

  const setCell = (cell: string, value: string, f: ExcelJS.Fill, fontSize = 10) => {
    const c = ws.getCell(cell);
    c.value = value;
    c.font = { bold: true, size: fontSize, color: { argb: "FFFFFFFF" } };
    c.fill = f;
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = thinBorderLight;
  };

  // 行1: 标题
  ws.mergeCells("A1:R1");
  const t = ws.getCell("A1");
  t.value = "学生成绩明细表";
  t.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  t.fill = titleFillObj;
  t.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 32;

  // 行2: 信息
  ws.mergeCells("A2:R2");
  const info = ws.getCell("A2");
  info.value = "课程名称:                    授课教师姓名：                    班级：";
  info.font = { size: 11, color: { argb: COLORS.text } };
  info.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  ws.getRow(2).height = 22;

  // 行3-5: 表头
  ws.mergeCells("A3:A5"); ws.mergeCells("B3:B5"); ws.mergeCells("C3:C5"); ws.mergeCells("D3:D5");
  ws.mergeCells("E3:M3"); ws.mergeCells("N3:N5"); ws.mergeCells("O3:O5"); ws.mergeCells("P3:P5"); ws.mergeCells("Q3:Q5"); ws.mergeCells("R3:R5");
  ws.mergeCells("E4:E5"); ws.mergeCells("F4:H4"); ws.mergeCells("I4:L4"); ws.mergeCells("M4:M5");

  setCell("A3", "序号", groupFillObj);
  setCell("B3", "学号", groupFillObj);
  setCell("C3", "姓名", groupFillObj);
  setCell("D3", "性别", groupFillObj);
  setCell("E3", "平时成绩（30%）", groupFillObj, 11);
  setCell("N3", "期中成绩（20%）\n卷面成绩", groupFillObj);
  setCell("O3", "期末考试成绩（50%）\n卷面成绩", groupFillObj);
  setCell("P3", "总评成绩\n（百分制）", groupFillObj);
  setCell("Q3", "等级\n成绩", groupFillObj);
  setCell("R3", "备注", groupFillObj);
  setCell("E4", "出勤情况\n（10分）", cyanFillObj);
  setCell("F4", "课堂活动10分", tealFillObj);
  setCell("I4", "课后活动10分", cyanFillObj);
  setCell("M4", "平时总成绩\n（百分制）", groupFillObj);

  const setSub = (cell: string, value: string) => {
    const c = ws.getCell(cell);
    c.value = value;
    c.font = { bold: true, size: 9, color: { argb: COLORS.textDark } };
    c.fill = headerFill2Obj;
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = thinBorderLight;
  };
  setSub("F5", "课堂参与\n（3分）");
  setSub("G5", "笔记\n（3分）");
  setSub("H5", "随堂考\n（4分）");
  setSub("I5", "作业1\n（2分）");
  setSub("J5", "作业2\n（3分）");
  setSub("K5", "作业3\n（2分）");
  setSub("L5", "作业4\n（3分）");

  ws.getRow(3).height = 20;
  ws.getRow(4).height = 20;
  ws.getRow(5).height = 28;

  // 示例学生
  const students = [
    { idx: 1, sid: "20230084178", name: "张三" },
    { idx: 2, sid: "20230084179", name: "李四" },
    { idx: 3, sid: "20230084180", name: "王五" },
  ];
  students.forEach((s) => {
    const r = ws.addRow({ idx: s.idx, sid: s.sid, name: s.name });
    r.height = 20;
    r.eachCell((cell) => {
      cell.border = thinBorderLight;
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.font = { size: 10 };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

// ============ 下载辅助 ============

/**
 * 触发浏览器下载 Blob
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
