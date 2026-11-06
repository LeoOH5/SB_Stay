"""scripts/fetch_tourapi.py — 네트워크 없이 응답 해석·고르기·반영만 검사"""
import importlib.util
import json
from pathlib import Path

spec = importlib.util.spec_from_file_location("fetch_tourapi", Path(__file__).resolve().parents[1] / "scripts" / "fetch_tourapi.py")
ft = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ft)

ITEM = {"title": "만해한용운심우장", "addr1": "서울특별시 성북구 성북로29길 24", "mapx": "126.991816", "mapy": "37.593599",
        "firstimage": "http://tong.visitkorea.or.kr/a.jpg", "cpyrhtDivCd": "Type1", "contentid": "1"}


def test_items_of_shapes():
    assert ft.items_of({"response": {"body": {"items": ""}}}) == []
    assert ft.items_of({"response": {"body": {"items": {"item": ITEM}}}}) == [ITEM]
    assert ft.items_of({"response": {"body": {"items": {"item": [ITEM, ITEM]}}}}) == [ITEM, ITEM]


def test_pick_only_seongbuk_and_clean_name():
    other = {**ITEM, "addr1": "서울특별시 종로구 어딘가"}
    assert ft.pick_tour([other], "심우장") is None
    assert ft.pick_tour([other, ITEM], "심우장")["contentid"] == "1"
    assert ft.clean("수연산방(이태준 가옥)") == "수연산방" and ft.clean("서울 성북동 별서") == "성북동 별서"


def test_row_photo_license_and_apply_flag():
    place = {"id": 103, "name": "심우장", "lat": 37.5936, "lng": 126.9918}
    row = ft.row_for(place, ITEM, None)
    assert row["source"] == "TourAPI" and row["photo_url"] and "제1유형" in row["photo_credit"]
    assert row["apply"] == "Y"  # 좌표는 가깝지만 사진이 새로 생김
    row3 = ft.row_for(place, {**ITEM, "cpyrhtDivCd": "Type3"}, None)
    assert row3["photo_url"] is None and row3["apply"] == "N"
    pending = ft.row_for({"id": 124, "name": "권진규 아틀리에", "lat": None, "lng": None}, None,
                         {"place_name": "권진규아틀리에", "address_name": "서울 성북구 동선동", "x": "127.01", "y": "37.59"})
    assert pending["source"] == "카카오 로컬" and pending["apply"] == "Y"


def test_apply_moves_pending(tmp_path, monkeypatch):
    places = [{"id": 101, "name": "A", "lat": 37.5, "lng": 127.0}]
    pending = [{"id": 124, "name": "B", "lat": None, "lng": None}]
    (tmp_path / "places.json").write_text(json.dumps(places), encoding="utf-8")
    (tmp_path / "places_pending.json").write_text(json.dumps(pending), encoding="utf-8")
    monkeypatch.setattr(ft, "PLACES", tmp_path / "places.json")
    monkeypatch.setattr(ft, "PENDING", tmp_path / "places_pending.json")
    rows = [{**{k: None for k in ft.COLS}, "apply": "Y", "id": 124, "name": "B", "new_lat": 37.59, "new_lng": 127.01},
            {**{k: None for k in ft.COLS}, "apply": "N", "id": 101, "name": "A", "new_lat": 1.0, "new_lng": 1.0}]
    ft.write_review(rows, tmp_path / "r.xlsx")
    ft.apply(tmp_path / "r.xlsx")
    out = json.loads((tmp_path / "places.json").read_text(encoding="utf-8"))
    assert [p["id"] for p in out] == [101, 124] and out[0]["lat"] == 37.5 and out[1]["lat"] == 37.59
    assert json.loads((tmp_path / "places_pending.json").read_text(encoding="utf-8")) == []
