"""시드 엑셀 도구: 내보내기 → 가져오기 (DB 안 씀, 임시 폴더에서)"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
from openpyxl import load_workbook

from scripts.export_seed_xlsx import DATA, SHEETS, build
from scripts.import_seed_xlsx import collect

BACKEND = Path(__file__).resolve().parents[1]


@pytest.fixture
def seed_dir(tmp_path):
    d = tmp_path / "data"
    shutil.copytree(DATA, d)
    return d


def _run(script: str, *args) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, str(BACKEND / "scripts" / script), *map(str, args)], capture_output=True, text=True, check=False)


def _files(d: Path) -> dict[str, bytes]:
    return {p.name: p.read_bytes() for p in sorted(d.glob("*.json"))}


def test_round_trip_byte_identical(seed_dir, tmp_path):
    before = _files(seed_dir)
    xlsx = tmp_path / "seed.xlsx"
    assert _run("export_seed_xlsx.py", xlsx, "--data", seed_dir).returncode == 0
    wb = load_workbook(xlsx)
    assert wb.sheetnames == ["readme"] + [s.name for s in SHEETS]
    ws = wb["places"]
    assert ws.freeze_panes == "A2" and ws["A1"].font.bold and "story_doc" not in [c.value for c in ws[1]]
    assert [c.value for c in wb["place_stories"][1]] == ["id", "story_doc", "sources"]
    assert [c.value for c in wb["buddy_profiles"][1]][:5] == ["id", "user_id", "user_name", "user_email", "university_id"]
    assert wb["buddy_profiles"]["C2"].value == "지우" and wb["buddy_profiles"]["H2"].value == "ko|en|ja"
    r = _run("import_seed_xlsx.py", xlsx, "--data", seed_dir)
    assert r.returncode == 0, r.stderr
    assert _files(seed_dir) == before  # 고치지 않으면 바이트까지 같다


def test_edit_and_errors(seed_dir, tmp_path):
    xlsx = tmp_path / "seed.xlsx"
    wb = build(seed_dir)
    ws = wb["dorm_rooms"]
    head = [c.value for c in ws[1]]
    ws.cell(row=2, column=head.index("price_per_night") + 1, value="36000")
    ws.cell(row=2, column=head.index("rules") + 1, value="체크인 15:00 | 정숙")
    wb.save(xlsx)
    out, errors = collect(xlsx, seed_dir)
    assert not errors
    room = json.loads(out["dorm_rooms.json"])[0]
    assert room["price_per_night"] == 36000 and room["rules"] == ["체크인 15:00", "정숙"] and next(iter(room)) == "id"

    ws.cell(row=2, column=head.index("price_per_night") + 1, value="삼만")
    ws.cell(row=3, column=head.index("open_from") + 1, value="2027/01/05")
    wb["universities"]["I2"] = "{building: x}"  # checkin_guide
    wb["tour_places"]["B2"] = 9999  # 없는 장소
    wb.save(xlsx)
    before = _files(seed_dir)
    r = _run("import_seed_xlsx.py", xlsx, "--data", seed_dir)
    assert r.returncode == 1 and "오류 4건" in r.stderr
    assert "[dorm_rooms] 2행 E열(price_per_night): 정수가 아니에요" in r.stderr and "3행 G열(open_from)" in r.stderr
    assert "[universities] 2행 I열(checkin_guide): JSON 형식 오류" in r.stderr and "places에 없는 번호 9999" in r.stderr
    assert _files(seed_dir) == before  # 오류가 있으면 하나도 쓰지 않는다
