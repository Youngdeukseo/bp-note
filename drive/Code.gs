// 혈압 노트 백업 수신 스크립트 (본인 구글 계정에서 실행)
// 1) 아래 TOKEN 을 본인만 아는 긴 문자열로 바꾸세요 (Convex 의 BACKUP_TOKEN 과 같아야 합니다)
const TOKEN = "여기에_긴_비밀문자열";
const FOLDER = "혈압노트 백업";

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.token !== TOKEN) return out({ ok: false, error: "token" });
    const d = body.data;
    const folder = getFolder_();
    const day = Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd");
    saveJson_(folder, "bp-note-" + day + ".json", body);
    saveJson_(folder, "bp-note-latest.json", body);
    writeSheet_(folder, d);
    return out({ ok: true, readings: d.readings.length });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

function doGet() { return out({ ok: true, msg: "혈압노트 백업 수신 대기 중" }); }

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function getFolder_() {
  const it = DriveApp.getFoldersByName(FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER);
}
function saveJson_(folder, name, obj) {
  const txt = JSON.stringify(obj);
  const it = folder.getFilesByName(name);
  if (it.hasNext()) it.next().setContent(txt);
  else folder.createFile(name, txt, MimeType.PLAIN_TEXT);
}
function writeSheet_(folder, d) {
  const name = "혈압노트 기록";
  const it = folder.getFilesByName(name);
  const ss = it.hasNext() ? SpreadsheetApp.open(it.next()) : SpreadsheetApp.create(name);
  if (!it.hasNext() && DriveApp.getFileById(ss.getId()).getParents().next().getId() !== folder.getId()) {
    const f = DriveApp.getFileById(ss.getId());
    folder.addFile(f);
    DriveApp.getRootFolder().removeFile(f);
  }
  const names = {};
  d.meds.forEach(function (m) { names[m.id] = m.name; });
  put_(ss, "혈압", ["날짜", "시간", "수축기", "이완기", "맥박", "약복용", "메모"],
    d.readings.sort(cmp_).map(function (r) {
      return [r.date, r.slot === "morning" ? "아침" : "저녁", r.sys, r.dia, r.pulse, r.meds ? "O" : "", r.note];
    }));
  put_(ss, "체중", ["날짜", "kg", "메모"], d.weights.sort(cmp_).map(function (w) { return [w.date, w.kg, w.note]; }));
  put_(ss, "약", ["약 이름", "계열", "용량", "시간", "복용중", "메모"],
    d.meds.map(function (m) {
      return [m.name, m.cls, m.dose, m.times.map(function (t) { return t === "morning" ? "아침" : "저녁"; }).join("/"), m.active ? "O" : "중단", m.note];
    }));
  put_(ss, "복용기록", ["날짜", "시간", "약", "복용"],
    d.medLogs.sort(cmp_).map(function (l) {
      return [l.date, l.slot === "morning" ? "아침" : "저녁", names[l.medId] || "(삭제된 약)", l.taken ? "O" : "X"];
    }));
  const first = ss.getSheetByName("Sheet1") || ss.getSheetByName("시트1");
  if (first && ss.getSheets().length > 1) ss.deleteSheet(first);
}
function cmp_(a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }
function put_(ss, title, head, rows) {
  const sh = ss.getSheetByName(title) || ss.insertSheet(title);
  sh.clear();
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight("bold");
  if (rows.length) sh.getRange(2, 1, rows.length, head.length).setValues(rows);
  sh.setFrozenRows(1);
}
