"""시드 JSON → 검토용 엑셀: uv run python scripts/export_seed_xlsx.py [출력.xlsx]

app/seeds/data/*.json 을 표마다 시트 하나로 쓴다. 고친 뒤 import_seed_xlsx.py 로 JSON에 되돌린다.
목록은 `a|b|c`, 빈 목록은 `[]`, JSON 객체·객체 목록은 JSON 글자, 빈칸은 null.
시트 정의(SHEETS)와 칸 종류 추론은 import 스크립트도 같이 쓴다.
"""
import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "app" / "seeds" / "data"
DEFAULT_XLSX = ROOT / "SBStay_seed_data.xlsx"


@dataclass(frozen=True)
class Sheet:
    name: str
    file: str
    key: tuple[str, ...] = ("id",)
    only: tuple[str, ...] = ()  # 이 칸만 (place_stories)
    exclude: tuple[str, ...] = ()  # 이 칸은 빼고 (places)
    readonly: tuple[str, ...] = ()  # 참고용 칸 (가져오기에서 무시)


SHEETS = [
    Sheet("universities", "universities.json"),
    Sheet("dorm_rooms", "dorm_rooms.json"),
    Sheet("places", "places.json", exclude=("story_doc", "sources")),
    Sheet("place_stories", "places.json", only=("id", "story_doc", "sources")),
    Sheet("tours", "tours.json"),
    Sheet("tour_places", "tour_places.json", key=("tour_id", "place_id")),
    Sheet("buddy_profiles", "buddy_profiles.json", readonly=("user_name", "user_email")),
    Sheet("packages", "packages.json"),
]
WIDE = {"story_doc": 100, "description": 50, "intro": 50, "rules": 50, "sources": 60, "checkin_guide": 60}

README = [
    "SB Stay 시드 데이터 검토용 엑셀",
    "",
    "1. 각 시트의 셀을 고친다. 첫 줄(칸 이름)과 시트 이름은 바꾸지 않는다.",
    "2. id 칸(tour_places는 tour_id·place_id)은 바꾸지 않는다. 다른 표가 이 번호로 연결된다. 새 줄을 넣을 때만 안 쓰는 번호를 쓴다.",
    "3. 목록은 a|b|c 처럼 | 로 나눠 쓴다 (예: ko|en|ja). 빈 목록은 [] 로, 빈칸은 null(값 없음)이다.",
    "4. JSON 객체(checkin_guide)나 객체 목록(sources)은 JSON 글자 그대로 고친다 (큰따옴표 \" 사용).",
    "5. 날짜는 2027-01-05, 시각은 2026-12-01T10:00:00Z 형식. 참/거짓 칸은 TRUE / FALSE.",
    "6. places의 이야기 자료(story_doc)와 출처(sources)는 place_stories 시트에 있다 (id로 연결).",
    "7. buddy_profiles의 user_name·user_email은 참고용(회색 글씨)이라 고쳐도 반영되지 않는다 (users.json에서 고친다).",
    "8. 다 고쳤으면 backend 폴더에서: uv run python scripts/import_seed_xlsx.py [이 파일]",
    "   형식이 틀린 셀이 있으면 시트·행·열을 알려 주고 JSON은 하나도 고치지 않는다.",
    "9. 반영 후 uv run python -m app.seeds 로 DB에 다시 넣는다.",
]

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
DATETIME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$")


def load(data: Path, file: str) -> list[dict]:
    return json.loads((data / file).read_text(encoding="utf-8"))


def all_keys(rows: list[dict]) -> list[str]:
    """원본 키 순서 (처음 나온 순)"""
    keys: dict[str, None] = {}
    for r in rows:
        keys.update(dict.fromkeys(r))
    return list(keys)


def _kind_of(v) -> str:
    if isinstance(v, bool):
        return "bool"
    if isinstance(v, int):
        return "int"
    if isinstance(v, float):
        return "float"
    if isinstance(v, str):
        return "datetime" if DATETIME_RE.match(v) and "T" in v else "date" if DATE_RE.match(v) else "str"
    if isinstance(v, dict):
        return "json"
    if isinstance(v, list):
        inner = {_kind_of(x) for x in v}
        if not inner:
            return "list"
        if inner <= {"str", "date", "datetime"}:
            return "list_str"
        return "list_int" if inner == {"int"} else "list_json"
    return "any"


def column_kinds(rows: list[dict]) -> dict[str, str]:
    """칸 종류 추론: int float bool str date datetime list_str list_int list_json json any"""
    out = {}
    for k in all_keys(rows):
        kinds = {_kind_of(r[k]) for r in rows if r.get(k) is not None} - {"list"}
        if kinds == {"int", "float"}:
            kinds = {"float"}
        if kinds <= {"str", "date", "datetime"} and len(kinds) > 1:
            kinds = {"str"}
        if {"list_str", "list_int", "list_json"} & kinds and len(kinds) > 1:
            kinds = {"list_json"}
        if not kinds and any(r.get(k) == [] for r in rows):
            kinds = {"list_str"}
        out[k] = kinds.pop() if len(kinds) == 1 else "any"
    return out


def sheet_columns(sheet: Sheet, rows: list[dict]) -> list[str]:
    keys = all_keys(rows)
    if sheet.only:
        return [k for k in sheet.only if k in keys]
    cols = [k for k in keys if k not in sheet.exclude]
    if sheet.readonly:  # 참고 칸은 user_id 바로 뒤
        at = cols.index("user_id") + 1 if "user_id" in cols else len(cols)
        cols[at:at] = list(sheet.readonly)
    return cols


def to_cell(v, kind: str):
    """JSON 값 → 셀 값 (import_seed_xlsx.from_cell 의 반대)"""
    if v is None:
        return None
    if isinstance(v, list):
        plain = kind in ("list_str", "list_int") and v and all(
            isinstance(x, (str, int)) and not isinstance(x, bool) and str(x) == str(x).strip() and str(x)
            and "|" not in str(x) and not str(x).startswith("[") for x in v)
        return "|".join(str(x) for x in v) if plain else json.dumps(v, ensure_ascii=False)
    if isinstance(v, dict):
        return json.dumps(v, ensure_ascii=False)
    return v


def _width(values: list) -> float:
    def w(s: str) -> int:
        line = max(s.split("\n"), key=len)
        return sum(2 if ord(c) > 0x2E80 else 1 for c in line)
    return min(max((w(str(v)) for v in values if v is not None), default=4) + 2, 60)


def build(data: Path = DATA) -> Workbook:
    wb = Workbook()
    ws = wb.active
    ws.title = "readme"
    for line in README:
        ws.append([line])
    ws["A1"].font = Font(bold=True, size=13)
    ws.column_dimensions["A"].width = 110
    users = {u["id"]: u for u in load(data, "users.json")}
    for sheet in SHEETS:
        rows = load(data, sheet.file)
        kinds = column_kinds(rows)
        cols = sheet_columns(sheet, rows)
        ws = wb.create_sheet(sheet.name)
        ws.append(cols)
        for r in rows:
            u = users.get(r.get("user_id"), {})
            extra = {"user_name": u.get("name"), "user_email": u.get("email")}
            ws.append([extra[c] if c in sheet.readonly else to_cell(r.get(c), kinds.get(c, "any")) for c in cols])
        for i, c in enumerate(cols, 1):
            head = ws.cell(row=1, column=i)
            head.font = Font(bold=True, italic=c in sheet.readonly, color="808080" if c in sheet.readonly else None)
            letter = get_column_letter(i)
            values = [ws.cell(row=j, column=i).value for j in range(1, ws.max_row + 1)]
            ws.column_dimensions[letter].width = WIDE.get(c, _width(values))
            if kinds.get(c) not in ("int", "float", "bool"):  # 글자 칸: 엑셀이 날짜·숫자로 바꾸지 않게
                for j in range(2, ws.max_row + 1):
                    cell = ws.cell(row=j, column=i)
                    cell.number_format = "@"
                    if c in WIDE:
                        cell.alignment = Alignment(wrap_text=True, vertical="top")
        ws.freeze_panes = "A2"
    return wb


def main() -> None:
    ap = argparse.ArgumentParser(description="시드 JSON → 검토용 엑셀")
    ap.add_argument("xlsx", nargs="?", type=Path, default=DEFAULT_XLSX)
    ap.add_argument("--data", type=Path, default=DATA, help="시드 JSON 폴더")
    a = ap.parse_args()
    build(a.data).save(a.xlsx)
    print(f"저장: {a.xlsx}")


if __name__ == "__main__":
    main()
