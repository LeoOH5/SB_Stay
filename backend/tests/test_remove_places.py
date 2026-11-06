"""관광지 빼기 스크립트 (DB 안 씀, 임시 폴더에서)"""
import json
import shutil

import pytest

from scripts import remove_places as rp
from scripts.export_seed_xlsx import DATA


@pytest.fixture
def seed_dir(tmp_path):
    d = tmp_path / "data"
    shutil.copytree(DATA, d)
    return d


def _ids(d, name, key="id"):
    return [r[key] for r in json.loads((d / name).read_text(encoding="utf-8"))]


def test_remove_hyehwamun(seed_dir, capsys):
    before = {p.name: p.read_bytes() for p in seed_dir.glob("*.json")}
    assert rp.main(["112", "--data", str(seed_dir)]) == 0
    assert "112 혜화문" in capsys.readouterr().out
    assert 112 not in _ids(seed_dir, "places.json") and len(_ids(seed_dir, "places.json")) == 24
    raw = (seed_dir / "places.json").read_text(encoding="utf-8")
    assert raw.startswith("[\n  {\n") and raw.endswith("}\n]\n")  # 원래 들여쓰기 2칸 유지
    assert {p.name for p in seed_dir.glob("*.json") if p.read_bytes() != before[p.name]} == {"places.json"}
    assert rp.main(["112", "--data", str(seed_dir)]) == 1  # 이미 없음


def test_refuses_when_referenced_and_reorders_course(seed_dir, capsys):
    before = {p.name: p.read_bytes() for p in seed_dir.glob("*.json")}
    assert rp.main(["104", "--data", str(seed_dir)]) == 1  # 패키지 1 코스 3 · Emma 요청 장소
    err = capsys.readouterr().err
    assert "패키지 1" in err and "예약 항목 3" in err
    assert {p.name: p.read_bytes() for p in seed_dir.glob("*.json")} == before  # 아무것도 안 씀
    assert rp.main(["114", "--data", str(seed_dir), "--check"]) == 0 and (seed_dir / "tour_places.json").read_bytes() == before["tour_places.json"]
    assert rp.main(["105", "--data", str(seed_dir)]) == 1  # 코스 5는 패키지에 있음
    assert rp.main(["114", "--data", str(seed_dir)]) == 0  # 코스 7(패키지 아님)에서 빠지고 순서 다시 매김
    stops = json.loads((seed_dir / "tour_places.json").read_text(encoding="utf-8"))
    assert [(s["place_id"], s["seq"]) for s in stops if s["tour_id"] == 7] == [(105, 1)]
    assert (seed_dir / "tour_places.json").read_text(encoding="utf-8").startswith('[\n  {\n    "tour_id"')
