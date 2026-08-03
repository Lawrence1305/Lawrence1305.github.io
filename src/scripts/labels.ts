const SUBJECT_ZH: Record<string, string> = {
  Accounting: "会计学",
  "Additional Mathematics": "附加数学",
  Arabic: "阿拉伯语",
  Bangla: "孟加拉语",
  Biology: "生物学",
  Business: "商业学",
  "Business Studies": "商业研究",
  "Cambridge International Mathematics": "剑桥国际数学",
  Chemistry: "化学",
  Chinese: "中文",
  "Chinese Language & Literature": "中文语言与文学",
  "Classical Studies": "古典学",
  "Combined Science": "综合科学",
  "Combined Science Double Award": "综合科学(双奖)",
  "Computer Science": "计算机科学",
  Economics: "经济学",
  "English as a Second Language": "英语(第二语言)",
  "English Language": "英语语言",
  "English Language A": "英语语言A",
  "English Language B": "英语语言B",
  "English Literature": "英语文学",
  French: "法语",
  "Further Mathematics": "进阶数学",
  Geography: "地理学",
  History: "历史学",
  "Human Biology": "人体生物学",
  "Information and Communication Technology": "信息与通信技术",
  "Literature in English": "英语文学",
  Mathematics: "数学",
  "Mathematics A": "数学A",
  "Mathematics B": "数学B",
  Physics: "物理学",
  Psychology: "心理学",
  "Science (Double Award)": "科学(双奖)",
  Sociology: "社会学",
  Statistics: "统计学",
  "Thinking Skills": "思维技能",
  Urdu: "乌尔都语",
  "CORE Biology (short course)": "核心生物学(短期课程)",
  "CORE Chemistry (short course)": "核心化学(短期课程)",
  "CORE Physics (short course)": "核心物理学(短期课程)",
  "CORE English as a Second Language (short course)": "核心英语(第二语言,短期课程)",
};

const SESSION_ZH: Record<string, string> = {
  Morning: "上午",
  Afternoon: "下午",
  Evening: "晚上",
  Window: "时间段(窗口)",
};

export function subjectZh(subject: string): string {
  return SUBJECT_ZH[subject] ?? SUBJECT_ZH[subject.split(" (")[0]] ?? "";
}

export function subjectLabel(subject: string): string {
  const zh = subjectZh(subject);
  return zh ? `${subject} · ${zh}` : subject;
}

export function sessionLabel(session: string | undefined): string {
  if (!session) return "";
  return SESSION_ZH[session] ?? session;
}
