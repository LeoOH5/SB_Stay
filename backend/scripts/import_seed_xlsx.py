"""검토용 엑셀 → 시드 JSON: uv run python scripts/import_seed_xlsx.py [입력.xlsx] [--check]

export_seed_xlsx.py 로 만든 파일을 읽어 app/seeds/data/*.json 을 다시 쓴다.
칸 종류는 지금 JSON에서 추론하고, 파일마다 원래 들여쓰기·줄바꿈 형식과 키 순서를 지킨다.
틀린 셀이 하나라도 있으면 시트·행·열을 모두 출력하고 아무 파일도 쓰지 않는다.
"""
import argparse
import json
import re
import sys
from datetime import UTC, date, datetime
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

try:
    from scripts import export_seed_xlsx as ex
except ModuleNotFoundError:  # python scripts/import_seed_xlsx.py 로 직접 실행
    import export_seed_xlsx as ex

# 다른 표 번호 확인: (시트, 칸) → 시트 id
REFS = {
    ("dorm_rooms", "university_id"): "universities",
    ("tour_places", "tour_id"): "tours",
    ("tour_places", "place_id"): "places",
    ("buddy_profiles", "university_id"): "universities",
    ("packages", "dorm_room_id"): "dorm_rooms",
    ("packages", "tour_id"): "tours",
    ("packages", "buddy_profile_id"): "buddy_profiles",
}
TRUE, FALSE = {"true", "1", "y", "yes", "예"}, {"false", "0", "n", "no", "아니오"}


class CellError(ValueError):
    pass


# ---------- JSON 형식 (파일마다 원래 모양 유지)
def detect_style(raw: str) -> tuple:
    """('indent', n, 끝 줄바꿈) | ('rows', 앞칸, 끝 줄바꿈). 못 찾으면 indent=2 + 줄바꿈"""
    data = json.loads(raw)
    for nl in (True, False):
        for n in (1, 2, 4):
            if dump(data, ("indent", n, nl)) == raw:
                return ("indent", n, nl)
        m = re.match(r"\[\n( +)\{", raw)
        if m and dump(data, ("rows", m.group(1), nl)) == raw:
            return ("rows", m.group(1), nl)
    return ("indent", 2, True)


def dump(rows: list, style: tuple) -> str:
    kind, arg, nl = style
    if kind == "rows" and rows:
        text = "[\n" + ",\n".join(arg + json.dumps(r, ensure_ascii=False) for r in rows) + "\n]"
    else:
        text = json.dumps(rows, ensure_ascii=False, indent=arg if kind == "indent" else 2)
    return text + ("\n" if nl else "")


def _read(path: Path) -> str:
    return path.read_bytes().decode("utf-8")  # 줄바꿈 그대로 (바이트 단위 비교)


# ---------- 셀 → 값
def _blank(v) -> bool:
    return v is None or (isinstance(v, str) and not v.strip())


def _int(v) -> int:
    if isinstance(v, bool):
        raise CellError("정수가 아니에요")
    if isinstance(v, int):
        return v
    if isinstance(v, float) and v.is_integer():
        return int(v)
    if isinstance(v, str) and re.fullmatch(r"\s*-?\d+\s*", v):
        return int(v)
    raise CellError("정수가 아니에요")


def _float(v) -> float:
    if isinstance(v, bool):
        raise CellError("숫자가 아니에요")
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).strip())
    except ValueError:
        raise CellError("숫자가 아니에요") from None


def _json(v, want: type):
    try:
        out = json.loads(v) if isinstance(v, str) else None
    except json.JSONDecodeError as e:
        raise CellError(f"JSON 형식 오류 ({e.msg})") from None
    if not isinstance(out, want):
        raise CellError("JSON 객체 {…} 여야 해요" if want is dict else "JSON 목록 […] 이어야 해요")
    return out


def from_cell(v, kind: str):
    """셀 값 → JSON 값 (export_seed_xlsx.to_cell 의 반대). 빈칸은 None"""
    if _blank(v):
        return None
    if kind == "int":
        return _int(v)
    if kind == "float":
        return _float(v)
    if kind == "bool":
        if isinstance(v, bool):
            return v
        s = str(v).strip().lower()
        if s in TRUE or s in FALSE:
            return s in TRUE
        raise CellError("TRUE 또는 FALSE 여야 해요")
    if kind == "date":
        if isinstance(v, (datetime, date)):
            return (v.date() if isinstance(v, datetime) else v).isoformat()
        s = str(v).strip()
        try:
            if ex.DATE_RE.match(s):
                return date.fromisoformat(s).isoformat()
        except ValueError:
            pass
        raise CellError("날짜는 2027-01-05 형식")
    if kind == "datetime":
        if isinstance(v, datetime):  # 엑셀 날짜 셀은 시간대가 없어 UTC로 본다
            return v.replace(tzinfo=UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
        s = str(v).strip()
        try:
            if ex.DATETIME_RE.match(s):
                datetime.fromisoformat(s)
                return s
        except ValueError:
            pass
        raise CellError("시각은 2026-12-01T10:00:00Z 형식")
    if kind == "str":
        if isinstance(v, datetime):
            return v.date().isoformat() if v.time() == datetime.min.time() else v.isoformat()
        if isinstance(v, float) and v.is_integer():
            return str(int(v))
        return v if isinstance(v, str) else str(v)
    if kind in ("list_str", "list_int"):
        s = str(v).strip()
        items = _json(s, list) if s.startswith("[") else [x.strip() for x in s.split("|") if x.strip()]
        if kind == "list_int":
            return [_int(x) for x in items]
        if not all(isinstance(x, str) for x in items):
            raise CellError("글자 목록이어야 해요 (a|b|c)")
        return items
    if kind == "list_json":
        return _json(str(v).strip(), list)
    if kind == "json":
        return _json(str(v).strip(), dict)
    # any: 원본이 모두 null인 칸 — 숫자·참거짓은 그대로, 글자는 JSON이면 풀고 아니면 글자
    if isinstance(v, str):
        try:
            return json.loads(v)
        except json.JSONDecodeError:
            return v
    return v


# ---------- 시트 읽기
def read_sheet(ws, sheet, cols: list[str], kinds: dict, errors: list[str]) -> list[tuple[int, dict]]:
    head = [c.value for c in ws[1]]
    while head and head[-1] is None:
        head.pop()
    if head != cols:
        errors.append(f"[{sheet.name}] 1행 칸 이름이 달라요. 기대: {cols} / 실제: {head} (칸 이름은 바꾸지 말고, JSON이 바뀌었으면 다시 내보내 주세요)")
        return []
    out, seen = [], {}
    for r, row in enumerate(ws.iter_rows(min_row=2, max_col=len(cols), values_only=True), start=2):
        if all(_blank(v) for v in row):
            continue
        rec = {}
        for i, (c, v) in enumerate(zip(cols, row), start=1):
            if c in sheet.readonly:
                continue
            try:
                rec[c] = from_cell(v, kinds.get(c, "any"))
            except CellError as e:
                errors.append(f"[{sheet.name}] {r}행 {get_column_letter(i)}열({c}): {e} — 값 {v!r}")
        key = tuple(rec.get(k) for k in sheet.key)
        if any(k is None for k in key):
            errors.append(f"[{sheet.name}] {r}행: {'·'.join(sheet.key)} 칸이 비었어요")
            continue
        if key in seen:
            errors.append(f"[{sheet.name}] {r}행: {'·'.join(sheet.key)} {key} 가 {seen[key]}행과 겹쳐요")
            continue
        seen[key] = r
        out.append((r, rec))
    return out


def _merge(orig: dict | None, rec: dict, keys: list[str]) -> dict:
    """원본 키 순서로. 빈칸이고 원본 줄에 없던 키는 넣지 않는다"""
    return {k: rec.get(k) for k in keys if k in rec and (rec[k] is not None or orig is None or k in orig)}


def collect(xlsx: Path, data: Path = ex.DATA) -> tuple[dict[str, str], list[str]]:
    """엑셀 → {파일 이름: 새 JSON 글자}, 오류 목록"""
    wb = load_workbook(xlsx)
    errors: list[str] = []
    parsed: dict[str, list[tuple[int, dict]]] = {}
    originals: dict[str, list[dict]] = {}
    for sheet in ex.SHEETS:
        rows = originals.setdefault(sheet.file, json.loads(_read(data / sheet.file)))
        if sheet.name not in wb.sheetnames:
            errors.append(f"[{sheet.name}] 시트가 없어요")
            continue
        parsed[sheet.name] = read_sheet(wb[sheet.name], sheet, ex.sheet_columns(sheet, rows), ex.column_kinds(rows), errors)

    ids = {name: {rec.get("id") for _, rec in rows} for name, rows in parsed.items()}
    for (name, col), target in REFS.items():
        for r, rec in parsed.get(name, []):
            if rec.get(col) is not None and target in ids and rec[col] not in ids[target]:
                errors.append(f"[{name}] {r}행 {col}: {target}에 없는 번호 {rec[col]}")
    if "places" in parsed and "place_stories" in parsed:
        a, b = ids["places"], ids["place_stories"]
        if a != b:
            errors.append(f"[place_stories] places와 id가 달라요 (places에만: {sorted(a - b)}, place_stories에만: {sorted(b - a)})")
    if errors:
        return {}, errors

    out: dict[str, str] = {}
    for file, rows in originals.items():
        sheets = [s for s in ex.SHEETS if s.file == file]
        keys = ex.all_keys(rows)
        by_key = {tuple(r.get(k) for k in sheets[0].key): r for r in rows}
        extra = {rec["id"]: rec for s in sheets[1:] for _, rec in parsed[s.name]}  # place_stories
        new_rows = []
        for _, rec in parsed[sheets[0].name]:
            orig = by_key.get(tuple(rec.get(k) for k in sheets[0].key))
            new_rows.append(_merge(orig, rec | extra.get(rec.get("id"), {}), keys))
        out[file] = dump(new_rows, detect_style(_read(data / file)))
    return out, []


def main() -> None:
    ap = argparse.ArgumentParser(description="검토용 엑셀 → 시드 JSON")
    ap.add_argument("xlsx", nargs="?", type=Path, default=ex.DEFAULT_XLSX)
    ap.add_argument("--data", type=Path, default=ex.DATA, help="시드 JSON 폴더")
    ap.add_argument("--check", action="store_true", help="검사만 하고 쓰지 않음")
    a = ap.parse_args()
    out, errors = collect(a.xlsx, a.data)
    if errors:
        print(f"오류 {len(errors)}건 — JSON은 고치지 않았어요", file=sys.stderr)
        for e in errors:
            print("  " + e, file=sys.stderr)
        sys.exit(1)
    for file, text in out.items():
        path = a.data / file
        same = _read(path) == text
        if not same and not a.check:
            path.write_bytes(text.encode("utf-8"))
        print(f"{file}: {'변경 없음' if same else '바뀜 (검사만)' if a.check else '저장'}")


if __name__ == "__main__":
    main()
