# British Council 考试时间表网站设计

**Date**: 2026-08-03
**Status**: Approved

## 概述

实时读取英国文化教育协会(British Council)中国官网三个考局页面的考试报名指南 PDF,解析其中的考试时间表,并在现有 Astro 个人站上新增 `/exams` 页面。学生可按考局、等级、科目筛选和搜索考试时间,勾选自己参加的考试后生成按日期排序的个人 Excel 文档下载。

## 技术选型

| 层 | 选择 | 理由 |
|---|---|---|
| 数据同步 | Python 脚本 + pdfplumber | 表格抽取能力强,已实测三个 PDF 均可解析 |
| 数据存储 | `src/data/exams.json` + `meta.json` | Astro 构建时读取,静态部署无后端 |
| 定时更新 | GitHub Actions 每天一次 + 手动 `npm run sync` | 免费、零运维,数据新鲜度最多延迟一天 |
| 网站 | Astro 新页面 `/exams` + Tailwind/DaisyUI | 集成现有站点,复用布局与部署 |
| Excel 导出 | SheetJS 客户端生成 `.xlsx` | 依赖学生勾选,必须在浏览器端生成 |

## 数据源

- 剑桥国际: `https://www.britishcouncil.cn/exams/school/Cambridge%20International`
- 牛津AQA: `https://www.britishcouncil.cn/exams/school/oxford-international-aqa-examinations`
- 培生爱德思: `https://www.britishcouncil.cn/exams/school/pearson`

同步脚本抓取页面 HTML,识别指向 `cn.live.solas.britishcouncil.digital/sites/default/files/` 的"报名指南" PDF 链接(去掉浏览器附加的跟踪参数),下载 PDF 后解析。

## 数据模型

`exams.json` 为数组,一行代表一场考试(一份试卷);`meta.json` 记录数据更新时间、各考局 PDF 来源链接与考季标签。

```json
{
  "board": "cambridge",
  "level": "A2",
  "syllabusCode": "9709",
  "subject": "Mathematics",
  "optionCode": "9709DC",
  "componentCode": "9709/35",
  "componentTitle": "Pure Mathematics 3",
  "duration": "1h50m",
  "date": "2026-10-21",
  "startTime": "08:45",
  "sourcePdf": "https://cn.live.solas.britishcouncil.digital/sites/default/files/xxx.pdf"
}
```

字段约定:

- `board`: `cambridge` | `oxfordaqa` | `pearson`。
- `level`: 剑桥按 PDF 等级列原样映射(`IG`/`AS`/`A2`/`A` 完整 A Level);牛津AQA AS/A-Level 表按数字 1→AS、2→A2,IGCSE 表归 `IG`;**培生无等级列时留空 `null`,保留单元号(如 `WBI11A`),不做额外推断**。
- `optionCode`(组合编码)仅剑桥、牛津AQA 有;培生填空字符串。
- 培生 Cash-in 合并行(X/Y 编码)不是考试,解析时剔除。
- 费用字段暂不纳入数据模型(需求确认不含费用);未来如需再加入。

## 目录结构

```
scripts/
  sync_exams.py          # 入口:抓取→下载→解析→校验→写 JSON
  parsers/
    cambridge.py
    oxfordaqa.py
    pearson.py
  requirements.txt       # pdfplumber, requests
.cache/exams/            # PDF 缓存,不入库
src/data/
  exams.json             # 同步脚本产物,构建时读取
  meta.json
src/pages/exams.astro    # 新页面
src/components/exams/    # 筛选栏、表格、已选栏、Excel 导出
```

## 同步策略

1. 抓取三个考局页面,提取报名指南 PDF 链接。
2. 下载 PDF 到 `.cache/exams/`(URL 变化时下载新文件)。
3. 三个解析器分别解析并标准化为统一数据行。
4. 校验:行数 > 0、日期可解析、试卷编码非空;校验失败则不覆盖旧 JSON,日志告警并以非零码退出。
5. 写入 `src/data/exams.json` 与 `meta.json`。

GitHub Actions 每天 08:00(UTC+8)自动运行,检测到数据变化时提交并触发站点重建;本地也可运行 `npm run sync` 手动更新。

## 页面功能

- 新路由 `/exams`,复用 `BaseLayout`,导航栏加入"考试时间表"入口。
- 考局标签页:剑桥国际 / 牛津AQA / 培生爱德思。
- 等级筛选 chips:全部 / IG / AS / A2 / 完整A Level;培生空等级行仅在"全部"下显示。
- 科目下拉(该考局全部科目,带试卷编码)+ 关键词搜索框(匹配科目名、试卷编码)。
- 表格按日期升序,列为:日期 | 开考时间 | 科目 | 试卷编码 | 试卷名称 | 时长 | 勾选。
- 已选考试实时汇总在右侧固定栏,支持一键清空;提供"科目一键全选"。
- 空状态提示(如某考局某等级暂无数据)。
- 页面展示"数据更新于 X"与各考局 PDF 来源链接(可点击核对)。

## Excel 导出

- 浏览器端用 SheetJS 生成 `.xlsx`。
- 按日期排序,同日按开考时间排序。
- 列:考局 | 等级 | 科目 | 试卷编码 | 试卷名称 | 考试日期 | 开考时间 | 时长。
- 文件名 `my-exam-timetable-<考季>.xlsx`;未勾选时禁用导出按钮并提示。

## 错误处理

- 同步脚本:网络请求失败自动重试 2 次;解析失败保留旧 JSON 并告警;结果校验失败非零退出。
- 页面端:JSON 缺失或损坏时显示友好错误提示;导出无勾选时给出提示。

## 测试

- `pytest` 覆盖三个解析器;fixture 使用当前 PDF 的截取页(避免大文件入库),断言关键行(剑桥 9709/35、牛津AQA 9202/1、培生 WBI11A)。
- JSON schema 校验脚本防止数据结构回归。
- `npm run build` 通过;手动验证筛选、勾选、Excel 下载流程。

## 范围外(未来可扩展)

- Excel 加入费用列。
- 跨考局考试日期冲突自动检测。
- 多考季历史数据对比。
