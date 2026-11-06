"""공공데이터로 관광지 좌표·사진 채우기 (한국관광공사 TourAPI + 카카오 로컬)

1) 가져오기:  uv run python scripts/fetch_tourapi.py fetch
   places.json(25곳) + places_pending.json(좌표 없는 곳)을 이름으로 찾아 검토용 엑셀을 만든다.
   - TourAPI 국문(KorService2 searchKeyword2, 서울): 좌표(mapx·mapy), 대표 사진(firstimage), 저작권 유형(cpyrhtDivCd), 주소
   - TourAPI에서 못 찾으면 카카오 로컬 키워드 검색으로 좌표만
   주소에 '성북구'가 있는 결과만 쓴다. 키: .env 의 TOUR_API_KEY(공공데이터포털 서비스키, 디코딩 값), KAKAO_REST_KEY
2) 엑셀 확인: 'apply' 칸이 Y인 줄만 반영된다. 기본값은 좌표 차이가 50 m 넘거나 사진이 새로 생기는 줄.
3) 반영하기:  uv run python scripts/fetch_tourapi.py apply [검토.xlsx]
   places.json 의 lat·lng·photo_url·photo_credit 을 고치고, 좌표가 생긴 places_pending 장소는 places.json 으로 옮긴다.
   그다음 uv run python -m app.seeds
사진은 공공누리 제1유형(출처표시)만 쓴다. 다른 유형은 photo_url을 비워 둔다.
"""
import argparse
import json
import math
import os
import re
import sys
import time
from pathlib import Path

import httpx
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "app" / "seeds" / "data"
PLACES, PENDING = DATA / "places.json", DATA / "places_pending.json"
REVIEW = ROOT / "tourapi_review.xlsx"
TOUR_BASE = "https://apis.data.go.kr/B551011/KorService2"
KAKAO_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"
GU = "성북구"
MOVE_M = 50  # 이보다 멀면 좌표를 바꾸자고 표시
FAR_M = 1500  # 기존 좌표에서 이보다 먼 결과는 다른 장소로 보고 버린다
CENTER = (127.0250, 37.6030)  # 성북구 가운데쯤 (경도, 위도)
RADIUS_M = 6000
OK_LICENSE = {"Type1"}  # 공공누리 제1유형: 출처표시 후 자유 이용
COLS = ["apply", "id", "name", "source", "matched", "address", "old_lat", "old_lng", "new_lat", "new_lng",
        "distance_m", "photo_url", "photo_credit", "note"]


def env(key: str) -> str:
    """환경변수 → 없으면 backend/.env 에서 읽는다 (값은 출력하지 않는다)"""
    if os.environ.get(key):
        return os.environ[key]
    f = ROOT / ".env"
    if f.exists():
        for line in f.read_text(encoding="utf-8").splitlines():
            k, _, v = line.partition("=")
            if k.strip() == key:
                return v.strip().strip('"').strip("'")
    return ""


def clean(name: str) -> str:
    """'수연산방(이태준 가옥)' → '수연산방', '서울 성북동 별서' → '성북동 별서'"""
    name = re.sub(r"\(.*?\)", "", name).strip()
    return re.sub(r"^서울\s+", "", name)


def norm(name: str) -> str:
    """비교용: 괄호·띄어쓰기·지역 접두어를 뺀다 ('서울 성북동 이종석 별장' → '이종석별장')"""
    n = re.sub(r"\(.*?\)|\[.*?\]", "", name or "")
    n = re.sub(r"^(서울특별시|서울)\s*", "", n.strip())
    n = re.sub(r"^(성북구립|성북구|성북동|동선동|장위동|삼선동|돈암동)\s*", "", n.strip())
    return re.sub(r"[\s·.,_-]", "", n)


def name_score(want: str, title: str) -> int:
    """3 같음 · 2 한쪽이 다른 쪽을 포함 · 0 다름"""
    a, b = norm(want), norm(title)
    if not a or not b:
        return 0
    if a == b:
        return 3
    return 2 if (a in b or b in a) and min(len(a), len(b)) >= 2 else 0


def distance_m(a_lat, a_lng, b_lat, b_lng) -> float | None:
    if None in (a_lat, a_lng, b_lat, b_lng):
        return None
    dy = (float(a_lat) - float(b_lat)) * 111_000
    dx = (float(a_lng) - float(b_lng)) * 111_000 * math.cos(math.radians(float(a_lat)))
    return round(math.hypot(dx, dy), 1)


def items_of(payload: dict) -> list[dict]:
    """TourAPI 응답 → item 목록 (없으면 [], 하나면 [item])"""
    body = (payload.get("response") or {}).get("body") or {}
    items = body.get("items") or {}
    if not isinstance(items, dict):  # 결과가 없으면 "" 로 온다
        return []
    it = items.get("item") or []
    return it if isinstance(it, list) else [it]


def pick_tour(items: list[dict], name: str, old: tuple | None = None) -> dict | None:
    """성북구 주소이고 이름이 맞는 것. 기존 좌표가 있으면 가까운 것을 고르고 FAR_M보다 먼 것은 버린다"""
    cands = []
    for i in items:
        sc = name_score(name, i.get("title") or "")
        if sc == 0 or GU not in (i.get("addr1") or ""):
            continue
        d = distance_m(old[0], old[1], i.get("mapy"), i.get("mapx")) if old and None not in old and i.get("mapy") else None
        if d is not None and d > FAR_M:
            continue
        cands.append((sc, -(d or 0), i))
    return max(cands, key=lambda c: (c[0], c[1]))[2] if cands else None


def pick_kakao(docs: list[dict], name: str = "", old: tuple | None = None) -> dict | None:
    """카카오 결과를 TourAPI 모양으로 바꿔 같은 규칙으로 고른다"""
    items = [{"title": d.get("place_name"), "addr1": d.get("road_address_name") or d.get("address_name"),
              "mapx": d.get("x"), "mapy": d.get("y"), "_doc": d} for d in docs
             if GU in (d.get("address_name") or "") or GU in (d.get("road_address_name") or "")]
    if not name:
        return items[0]["_doc"] if items else None
    hit = pick_tour(items, name, old)
    return hit["_doc"] if hit else None


def _tour_get(client: httpx.Client, op: str, params: dict) -> dict:
    r = client.get(f"{TOUR_BASE}/{op}", params={"MobileOS": "ETC", "MobileApp": "SBStay", "_type": "json", **params})
    r.raise_for_status()
    try:
        return r.json()
    except ValueError:  # 키 오류는 XML로 온다
        raise RuntimeError(f"TourAPI 응답이 JSON이 아님 (서비스키 확인): {r.text[:200]}") from None


def tour_nearby_all(client: httpx.Client, key: str) -> list[dict]:
    """성북구 가운데에서 반경 6 km 안의 관광정보 전부 (페이지를 다 돈다). 이름 검색이 놓치는 곳을 잡는다"""
    out, page = [], 1
    while page <= 30:
        data = _tour_get(client, "locationBasedList2", {"serviceKey": key, "mapX": CENTER[0], "mapY": CENTER[1],
                                                       "radius": RADIUS_M, "numOfRows": 100, "pageNo": page, "arrange": "E"})
        items = items_of(data)
        out += items
        total = int(((data.get("response") or {}).get("body") or {}).get("totalCount") or 0)
        if not items or len(out) >= total:
            break
        page += 1
        time.sleep(0.1)
    return [i for i in out if GU in (i.get("addr1") or "")]


def tour_search(client: httpx.Client, key: str, name: str) -> list[dict]:
    data = _tour_get(client, "searchKeyword2", {"serviceKey": key, "keyword": clean(name), "numOfRows": 100, "pageNo": 1, "arrange": "A"})
    return items_of(data)


def kakao_search(client: httpx.Client, key: str, name: str) -> list[dict]:
    r = client.get(KAKAO_URL, params={"query": f"{GU} {clean(name)}", "size": 15}, headers={"Authorization": f"KakaoAK {key}"})
    r.raise_for_status()
    return r.json().get("documents") or []


def credit(item: dict) -> str | None:
    lic = item.get("cpyrhtDivCd") or ""
    if lic not in OK_LICENSE:
        return None
    return f"한국관광공사 TourAPI · 공공누리 제1유형 ({item.get('title', '')})"


def row_for(place: dict, tour: dict | None, kakao: dict | None) -> dict:
    row = {"id": place["id"], "name": place["name"], "old_lat": place.get("lat"), "old_lng": place.get("lng"),
           "source": "", "matched": "", "address": "", "new_lat": None, "new_lng": None, "photo_url": None,
           "photo_credit": None, "note": "", "apply": "N"}
    if tour:
        row.update(source="TourAPI", matched=tour.get("title"), address=tour.get("addr1"),
                   new_lat=float(tour["mapy"]) if tour.get("mapy") else None,
                   new_lng=float(tour["mapx"]) if tour.get("mapx") else None)
        img, cr = tour.get("firstimage") or None, credit(tour)
        if img and cr:
            row.update(photo_url=img, photo_credit=cr)
        elif img:
            row["note"] = f"사진 저작권 유형 {tour.get('cpyrhtDivCd') or '없음'} → 사진은 안 씀"
    elif kakao:
        row.update(source="카카오 로컬", matched=kakao.get("place_name"),
                   address=kakao.get("road_address_name") or kakao.get("address_name"),
                   new_lat=float(kakao["y"]), new_lng=float(kakao["x"]))
    else:
        row["note"] = "찾지 못함"
    row["distance_m"] = distance_m(row["old_lat"], row["old_lng"], row["new_lat"], row["new_lng"])
    moved = row["new_lat"] is not None and (row["old_lat"] is None or (row["distance_m"] or 0) > MOVE_M)
    new_photo = row["photo_url"] and row["photo_url"] != place.get("photo_url")
    row["apply"] = "Y" if moved or new_photo else "N"
    return row


def fetch(out: Path) -> None:
    tour_key, kakao_key = env("TOUR_API_KEY"), env("KAKAO_REST_KEY")
    if not tour_key and not kakao_key:
        sys.exit("TOUR_API_KEY 또는 KAKAO_REST_KEY 를 backend/.env 에 넣어 주세요")
    places = json.loads(PLACES.read_text(encoding="utf-8"))
    pending = json.loads(PENDING.read_text(encoding="utf-8")) if PENDING.exists() else []
    rows = []
    with httpx.Client(timeout=15) as c:
        nearby = []
        if tour_key:
            try:
                nearby = tour_nearby_all(c, tour_key)
                print(f"TourAPI 성북구 관광정보 {len(nearby)}건을 받았어요\n")
            except (httpx.HTTPError, RuntimeError) as e:
                print(f"  ! 위치 기반 목록 실패: {e}")
        for p in places + pending:
            old = (p.get("lat"), p.get("lng")) if p.get("lat") is not None else None
            tour = pick_tour(nearby, p["name"], old)
            kakao = None
            try:
                if not tour and tour_key:
                    tour = pick_tour(tour_search(c, tour_key, p["name"]), p["name"], old)
                if not tour and kakao_key:
                    kakao = pick_kakao(kakao_search(c, kakao_key, p["name"]), p["name"], old)
            except (httpx.HTTPError, RuntimeError) as e:
                print(f"  ! {p['id']} {p['name']}: {e}")
            row = row_for(p, tour, kakao)
            rows.append(row)
            print(f"{p['id']:>4} {p['name'][:16]:<16} {row['source'] or '-':<10} {row['matched'] or '':<18} {row['distance_m'] if row['distance_m'] is not None else '-':>8} m  사진 {'O' if row['photo_url'] else '-'}  → {row['apply']}")
            time.sleep(0.1)
    write_review(rows, out)
    print(f"\n저장: {out}\napply 칸을 확인한 뒤: uv run python scripts/fetch_tourapi.py apply \"{out}\"")


def write_review(rows: list[dict], out: Path) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "review"
    ws.append(COLS)
    for c in ws[1]:
        c.font = Font(bold=True)
    yellow = PatternFill("solid", fgColor="FFF2CC")
    for r in rows:
        ws.append([r.get(k) for k in COLS])
        if r["apply"] == "Y":
            ws.cell(ws.max_row, 1).fill = yellow
    ws.freeze_panes = "A2"
    for col, w in zip("ABCDEFGHIJKLMN", [7, 6, 22, 11, 22, 30, 11, 11, 11, 11, 10, 40, 40, 30]):
        ws.column_dimensions[col].width = w
    wb.save(out)


def read_review(path: Path) -> list[dict]:
    ws = load_workbook(path, data_only=True)["review"]
    head = [c.value for c in ws[1]]
    return [dict(zip(head, r)) for r in ws.iter_rows(min_row=2, values_only=True) if r and r[1] is not None]


def apply(path: Path) -> None:
    places = json.loads(PLACES.read_text(encoding="utf-8"))
    pending = json.loads(PENDING.read_text(encoding="utf-8")) if PENDING.exists() else []
    by_id = {p["id"]: p for p in places}
    pend_by_id = {p["id"]: p for p in pending}
    moved, changed = [], 0
    for r in read_review(path):
        if str(r.get("apply") or "").strip().upper() != "Y":
            continue
        pid = int(r["id"])
        target = by_id.get(pid) or pend_by_id.get(pid)
        if not target:
            print(f"  ! id {pid} 없음 — 건너뜀")
            continue
        if r.get("new_lat") is not None and r.get("new_lng") is not None:
            target["lat"], target["lng"] = round(float(r["new_lat"]), 6), round(float(r["new_lng"]), 6)
        if r.get("photo_url"):
            target["photo_url"], target["photo_credit"] = r["photo_url"], r.get("photo_credit")
        if pid in pend_by_id and target.get("lat") is not None:
            moved.append(target)
        changed += 1
    places += moved
    places.sort(key=lambda p: p["id"])
    pending = [p for p in pending if p not in moved]
    PLACES.write_text(json.dumps(places, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    PENDING.write_text(json.dumps(pending, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"반영 {changed}곳, 새로 추가 {len(moved)}곳 ({', '.join(p['name'] for p in moved) or '-'})")
    print("다음: uv run python -m app.seeds")


def main() -> None:
    ap = argparse.ArgumentParser(description="TourAPI·카카오로 관광지 좌표·사진 채우기")
    ap.add_argument("mode", choices=["fetch", "apply"])
    ap.add_argument("xlsx", nargs="?", default=str(REVIEW))
    a = ap.parse_args()
    (fetch if a.mode == "fetch" else apply)(Path(a.xlsx))


if __name__ == "__main__":
    main()
