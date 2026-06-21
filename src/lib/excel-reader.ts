/**
 * Excel解析工具 (v2)
 * 适配真实母表(4个工作表)和子表(3层合并表头)结构
 */
import * as XLSX from "xlsx";
import type { MasterRecord } from "./score-utils";

// ============ 母表解析 ============

export interface ParsedMasterData {
  records: MasterRecord[];
  courseName: string;
  className: string;
  teacherName: string;
  warnings: string[];
}

/**
 * 解析母表Excel文件
 * 读取"综合成绩"表获取作业/考试/签到/课程积分
 * 读取"考试统计"表获取期中/期末卷面成绩
 */
export async function parseMasterFile(file: File): Promise<ParsedMasterData> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const warnings: string[] = [];

  // 查找"综合成绩"工作表
  const summarySheetName = workbook.SheetNames.find((n) =>
    n.includes("综合成绩")
  );
  if (!summarySheetName) {
    throw new Error("母表中未找到「综合成绩」工作表，请检查文件格式");
  }

  // 查找"考试统计"工作表
  const examSheetName = workbook.SheetNames.find((n) =>
    n.includes("考试")
  );

  // 解析综合成绩表 (前2行是标题和信息行，第3行是表头)
  const summarySheet = workbook.Sheets[summarySheetName];
  // 用 header:1 读取二维数组，便于定位真实表头行
  const summaryAoa: unknown[][] = XLSX.utils.sheet_to_json(summarySheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  // 找到表头行 (包含"学号"或"学生姓名"的行)
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(5, summaryAoa.length); i++) {
    const row = summaryAoa[i];
    if (row && row.some((c) => {
      const s = String(c ?? "");
      return s.includes("学号") || s.includes("学生姓名") || s.includes("序号");
    })) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) {
    throw new Error("综合成绩表中未找到表头行（需包含「学号」或「学生姓名」）");
  }

  // 用表头行构建 records (从 headerRowIdx+1 开始是数据)
  const headers = (summaryAoa[headerRowIdx] as unknown[]).map((h) => String(h ?? "").trim());
  const summaryRows: Record<string, unknown>[] = [];
  for (let i = headerRowIdx + 1; i < summaryAoa.length; i++) {
    const row = summaryAoa[i];
    if (!row) continue;
    const obj: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      if (headers[j]) obj[headers[j]] = row[j];
    }
    summaryRows.push(obj);
  }

  // 解析考试统计表 (建立学号→期中/期末 的映射)
  const examMap = new Map<string, { midterm: number; final: number }>();
  if (examSheetName) {
    const examSheet = workbook.Sheets[examSheetName];
    const examAoa: unknown[][] = XLSX.utils.sheet_to_json(examSheet, {
      header: 1,
      defval: null,
      raw: true,
    });
    // 考试统计表第1行就是表头
    let examHeaderIdx = 0;
    for (let i = 0; i < Math.min(3, examAoa.length); i++) {
      if (examAoa[i] && examAoa[i].some((c) => String(c ?? "").includes("学号"))) {
        examHeaderIdx = i;
        break;
      }
    }
    const examHeaders = (examAoa[examHeaderIdx] as unknown[]).map((h) => String(h ?? "").trim());
    for (let i = examHeaderIdx + 1; i < examAoa.length; i++) {
      const row = examAoa[i];
      if (!row) continue;
      const obj: Record<string, unknown> = {};
      for (let j = 0; j < examHeaders.length; j++) {
        if (examHeaders[j]) obj[examHeaders[j]] = row[j];
      }
      const id = findValue(obj, ["学号/工号", "学号", "学生学号"]);
      const midterm = parseNumber(findValue(obj, ["期中考试", "期中"]));
      const final = parseNumber(findValue(obj, ["期末考试", "期末"]));
      if (id) {
        examMap.set(String(id).trim(), { midterm, final });
      }
    }
  } else {
    warnings.push("母表中未找到「考试统计」工作表，期中/期末成绩将为空");
  }

  // 解析综合成绩表的列
  if (summaryRows.length === 0) {
    throw new Error("综合成绩表中没有数据");
  }

  // 综合成绩表表头: 序号|学生姓名|学号/工号|学院|专业|班级|作业(100%)|考试(100%)|签到(100%)|课程积分(100%)|综合成绩
  const records: MasterRecord[] = [];
  let courseName = "";
  let className = "";
  let teacherName = "";

  for (const row of summaryRows) {
    const studentId = String(findValue(row, ["学号/工号", "学号"]) ?? "").trim();
    const name = String(findValue(row, ["学生姓名", "姓名"]) ?? "").trim();

    // 跳过空行和说明行
    if (!studentId || !/\d/.test(studentId) || studentId.length > 20) {
      // 尝试从信息行提取课程/班级/教师
      const info = String(findValue(row, ["综合成绩（各权重项百分制得分）"]) ?? "");
      if (info.includes("课程：")) {
        const courseMatch = info.match(/课程：\s*([^\s]+)/);
        const classMatch = info.match(/班级：\s*([^\s]+)/);
        const teacherMatch = info.match(/任课教师：\s*([^\s]+)/);
        if (courseMatch) courseName = courseMatch[1];
        if (classMatch) className = classMatch[1];
        if (teacherMatch) teacherName = teacherMatch[1];
      }
      continue;
    }

    const homework = parseNumber(findValue(row, ["作业(100%)", "作业"]));
    const examScore = parseNumber(findValue(row, ["考试(100%)", "考试"]));
    const attendance = parseNumber(findValue(row, ["签到(100%)", "签到"]));
    const coursePoints = parseNumber(
      findValue(row, ["课程积分(100%)", "课程积分"])
    );
    const cls = String(findValue(row, ["班级"]) ?? "").trim();

    // 从考试统计表获取期中/期末
    const exam = examMap.get(studentId) ?? examMap.get(studentId.replace(/^0+/, ""));

    records.push({
      studentId,
      name,
      homework,
      examScore,
      attendance,
      coursePoints,
      midterm: exam?.midterm ?? 0,
      final: exam?.final ?? 0,
      class: cls,
    });
  }

  if (records.length === 0) {
    warnings.push("未能从综合成绩表识别到有效学生数据");
  }

  return { records, courseName, className, teacherName, warnings };
}

// ============ 子表解析 ============

export interface ParsedSubData {
  students: { studentId: string; name: string }[];
  courseName: string;
  className: string;
  teacherName: string;
  warnings: string[];
}

/**
 * 解析子表Excel文件
 * 子表有3层合并表头，学生数据从第6行开始
 * 列结构: A序号 B学号 C姓名 D性别 E出勤 F课堂参与 G笔记 H随堂考 I作业1 J作业2 K作业3 L作业4 M平时总 N期中 O期末 P总评 Q等级 R备注
 */
export async function parseSubTemplateFile(file: File): Promise<ParsedSubData> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  // 查找所有包含"成绩明细"的工作表，选择有学生数据的那一个
  const candidateSheets = workbook.SheetNames.filter((n) =>
    n.includes("成绩明细")
  );
  if (candidateSheets.length === 0) {
    throw new Error("子表中未找到「成绩明细表」工作表");
  }

  let sheetName = "";
  let aoa: unknown[][] = [];
  let studentsFound = 0;

  // 遍历候选工作表，找到有学生数据的那个
  for (const name of candidateSheets) {
    const s = workbook.Sheets[name];
    const a = XLSX.utils.sheet_to_json(s, {
      header: 1,
      defval: null,
      raw: true,
    }) as unknown[][];
    // 统计有效学生行 (B列学号+C列姓名，从第6行开始)
    let count = 0;
    for (let i = 5; i < a.length; i++) {
      const row = a[i];
      if (!row) continue;
      const sid = String(row[1] ?? "").trim();
      const sname = String(row[2] ?? "").trim();
      if (sid && sname && /\d/.test(sid) && sid.length <= 20) count++;
    }
    if (count > studentsFound) {
      studentsFound = count;
      sheetName = name;
      aoa = a;
    }
  }

  if (!sheetName) {
    sheetName = candidateSheets[0];
    const s = workbook.Sheets[sheetName];
    aoa = XLSX.utils.sheet_to_json(s, {
      header: 1,
      defval: null,
      raw: true,
    }) as unknown[][];
  }

  const warnings: string[] = [];

  if (aoa.length < 6) {
    throw new Error("子表数据不足，请检查文件格式");
  }

  // 第1行: 标题 "xx学院xx专业xx班级学生成绩明细表"
  const titleRow = aoa[0];
  const title = String(titleRow[0] ?? "");

  // 第2行: "课程名称:xxx 授课教师姓名：xxx 班级：xxx"
  const infoRow = aoa[1];
  const info = String(infoRow[0] ?? "");
  const courseMatch = info.match(/课程名称[:：]\s*([^\s授]+)/);
  const teacherMatch = info.match(/授课教师姓名[:：]\s*([^\s班]+)/);
  const classMatch = info.match(/班级[:：]\s*([^\s]*)/);

  const courseName = courseMatch?.[1]?.trim() ?? "";
  const teacherName = teacherMatch?.[1]?.trim() ?? "";
  const className = classMatch?.[1]?.trim() || extractClassFromTitle(title);

  // 学生数据从第6行开始 (索引5)，列B=学号(索引1)，列C=姓名(索引2)
  const students: { studentId: string; name: string }[] = [];
  for (let i = 5; i < aoa.length; i++) {
    const row = aoa[i];
    if (!row) continue;
    const studentId = String(row[1] ?? "").trim();
    const name = String(row[2] ?? "").trim();

    if (studentId && name && /\d/.test(studentId) && studentId.length <= 20) {
      students.push({ studentId, name });
    }
  }

  if (students.length === 0) {
    warnings.push("未从子表识别到学生名单（需第6行起，B列学号+C列姓名）");
  }

  return { students, courseName, className, teacherName, warnings };
}

function extractClassFromTitle(title: string): string {
  // "传媒学院新媒体摄影专业2501班级学生成绩明细表" → 提取班级
  const m = title.match(/([\u4e00-\u9fa5]+?\d{4}\d*班级)/);
  return m?.[1] ?? "";
}

// ============ 通用工具 ============

/** 从行对象中按多个候选列名查找值 */
function findValue(
  row: Record<string, unknown>,
  candidates: string[]
): unknown {
  const keys = Object.keys(row);
  for (const c of candidates) {
    // 精确匹配
    const found = keys.find((k) => k.trim() === c);
    if (found && row[found] !== "" && row[found] != null) return row[found];
  }
  for (const c of candidates) {
    // 包含匹配
    const found = keys.find((k) => k.includes(c));
    if (found && row[found] !== "" && row[found] != null) return row[found];
  }
  return undefined;
}

function parseNumber(value: unknown): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return isNaN(value) ? 0 : value;
  const str = String(value).trim().replace(/[^\d.\-]/g, "");
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}
