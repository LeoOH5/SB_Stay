"""OpenStreetMap 실제 도보 경로 받기 (OSRM 도보 서버 routing.openstreetmap.de) → app/seeds/data/walk_routes.json

앱은 요청 중에 이 서버를 부르지 않는다. 이 스크립트를 PC에서 한 번 돌려 파일로 받고, 시드로 DB(walk_routes 표)에 넣는다.
  1) uv run python scripts/fetch_walk_routes.py --dry-run         받을 장소 쌍 개수만 보기
  2) uv run python scripts/fetch_walk_routes.py                   places.json 의 좌표 있는 모든 장소 쌍 (25곳이면 300쌍, 약 5분)
     uv run python scripts/fetch_walk_routes.py --only-courses    코스(tour_places.json)에서 이어지는 장소 쌍만
  3) uv run python -m app.seeds                                   walk_routes.json 을 DB에 넣기
이미 파일에 있는 쌍은 건너뛴다(이어 받기). 끊겨도 받은 만큼 저장돼 있으니 같은 명령을 다시 돌리면 된다.
받은 뒤 코스마다 '지금 순서' 걷는 거리와 가장 짧은 순서(services/courses.best_order)를 비교해 보여 준다 (코스 순서는 바꾸지 않는다).

서버 이용 규칙: 1초에 1번 이하, 알아볼 수 있는 User-Agent. 실패하면 한 번 더 해 보고 그래도 안 되면 경고만 내고 건너뛴다.
지도 자료 © OpenStreetMap contributors (ODbL) — 경로를 화면에 그릴 때 '경로 © OpenStreetMap'을 표시한다.
파일 모양: [{"from_place_id": 작은 id, "to_place_id": 큰 id, "distance_m": 정수, "path": [[위도, 경도], ...]}, ...]
          (쌍 순서로 정렬, 2칸 들여쓰기, path는 한 줄, 좌표는 소수 6자리. path는 from → to 방향)
"""
import argparse
import json
import sys
import time
from collections.abc import Callable
from itertools import pairwise
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "app" / "seeds" / "data"
PLACES, TOUR_PLACES, TOURS = DATA / "places.json", DATA / "tour_places.json", DATA / "tours.json"
OUT = DATA / "walk_routes.json"
OSRM_BASE = "https://routing.openstreetmap.de/routed-foot/route/v1/driving"  # 도보 서버도 경로 이름은 driving
PARAMS = {"overview": "simplified", "geometries": "geojson"}
USER_AGENT = "SBStay-hackathon/1.0 (walk routes script)"
MIN_INTERVAL_S = 1.0  # 1초에 1번 이하
RETRY_WAIT_S = 3.0
SAVE_EVERY = 10  # 이만큼 받을 때마다 파일에 저장 (끊겨도 이어 받기)


# ---------- 순수 함수 (네트워크 없음, 테스트 대상)
def has_xy(p: dict) -> bool:
    return bool(p.get("lat")) and bool(p.get("lng"))


def pair_key(a: int, b: int) -> tuple[int, int]:
    return (a, b) if a < b else (b, a)


def all_pairs(places: list[dict]) -> list[tuple[int, int]]:
    """좌표 있는 장소끼리 순서 없는 모든 쌍 (작은 id, 큰 id), 정렬"""
    ids = sorted({p["id"] for p in places if has_xy(p)})
    return [(a, b) for i, a in enumerate(ids) for b in ids[i + 1:]]


def course_pairs(places: list[dict], stops: list[dict]) -> list[tuple[int, int]]:
    """코스마다 seq 순서로 이어지는 두 장소 쌍 (둘 다 좌표 있음), 겹치는 쌍은 하나만, 정렬"""
    xy = {p["id"] for p in places if has_xy(p)}
    by_tour: dict[int, list[dict]] = {}
    for s in stops:
        by_tour.setdefault(s["tour_id"], []).append(s)
    out = set()
    for rows in by_tour.values():
        ids = [s["place_id"] for s in sorted(rows, key=lambda s: s["seq"])]
        for a, b in pairwise(ids):
            if a != b and a in xy and b in xy:
                out.add(pair_key(a, b))
    return sorted(out)


def route_url(pa: dict, pb: dict) -> str:
    """OSRM 좌표 순서는 경도,위도"""
    return f"{OSRM_BASE}/{float(pa['lng']):.6f},{float(pa['lat']):.6f};{float(pb['lng']):.6f},{float(pb['lat']):.6f}"


def parse_route(payload: dict, a: int, b: int) -> dict | None:
    """OSRM 응답 → 저장할 줄. code가 Ok가 아니거나 경로가 없으면 None. GeoJSON [경도, 위도] → [위도, 경도] 소수 6자리"""
    if not isinstance(payload, dict) or payload.get("code") != "Ok" or not payload.get("routes"):
        return None
    r = payload["routes"][0]
    coords = ((r.get("geometry") or {}).get("coordinates")) or []
    path = [[round(float(c[1]), 6), round(float(c[0]), 6)] for c in coords if isinstance(c, (list, tuple)) and len(c) >= 2]
    if r.get("distance") is None or len(path) < 2:
        return None
    return {"from_place_id": a, "to_place_id": b, "distance_m": round(float(r["distance"])), "path": path}


def normalize(row: dict) -> dict:
    """from < to 로 맞춘다 (반대면 path를 뒤집음)"""
    a, b, path = int(row["from_place_id"]), int(row["to_place_id"]), list(row.get("path") or [])
    if a > b:
        a, b, path = b, a, path[::-1]
    return {"from_place_id": a, "to_place_id": b, "distance_m": int(row["distance_m"]), "path": path}


def merge(existing: list[dict], new: list[dict]) -> list[dict]:
    """같은 쌍은 새 값으로, 쌍 순서로 정렬"""
    rows = {}
    for r in [*existing, *new]:
        n = normalize(r)
        rows[(n["from_place_id"], n["to_place_id"])] = n
    return [rows[k] for k in sorted(rows)]


def dump_routes(rows: list[dict]) -> str:
    """2칸 들여쓰기, path는 한 줄 (좌표마다 줄을 바꾸면 파일이 너무 길어진다). 끝 줄바꿈 있음"""
    if not rows:
        return "[]\n"
    items = []
    for r in rows:
        path = json.dumps(r["path"], separators=(", ", ": "))
        items.append("  {\n"
                     f'    "from_place_id": {int(r["from_place_id"])},\n'
                     f'    "to_place_id": {int(r["to_place_id"])},\n'
                     f'    "distance_m": {int(r["distance_m"])},\n'
                     f'    "path": {path}\n'
                     "  }")
    return "[\n" + ",\n".join(items) + "\n]\n"


def load_json(path: Path) -> list:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else []


def todo_pairs(pairs: list[tuple[int, int]], existing: list[dict]) -> list[tuple[int, int]]:
    """이미 받은 쌍은 뺀다 (이어 받기)"""
    done = {(n["from_place_id"], n["to_place_id"]) for n in map(normalize, existing)}
    return [p for p in pairs if p not in done]


def course_report(places: list[dict], stops: list[dict], tours: list[dict], rows: list[dict]) -> list[str]:
    """코스마다 지금 순서 걷는 거리 vs 가장 짧은 순서 (첫 장소 그대로 / 자유). 실제 경로가 없는 쌍은 추정 거리"""
    try:
        from app.services import courses
    except ModuleNotFoundError:  # python scripts/... 로 직접 실행하면 backend 폴더를 경로에 넣는다
        sys.path.insert(0, str(ROOT))
        from app.services import courses
    by_id = {p["id"]: p for p in places}
    routes = {(n["from_place_id"], n["to_place_id"]): courses.Route(n["distance_m"], n["path"]) for n in map(normalize, rows)}
    titles = {t["id"]: t.get("title", "") for t in tours}
    by_tour: dict[int, list[dict]] = {}
    for s in stops:
        by_tour.setdefault(s["tour_id"], []).append(s)
    lines = []
    for tid in sorted(by_tour):
        seq = [s for s in sorted(by_tour[tid], key=lambda s: s["seq"]) if s["place_id"] in by_id]
        st = [courses.Stop(s["place_id"], by_id[s["place_id"]].get("lat"), by_id[s["place_id"]].get("lng"), 0) for s in seq]
        if len(st) < 2:
            continue
        now = courses.path_m(st, routes)
        fixed = courses.best_order(st, keep_first=True, routes=routes)
        free = courses.best_order(st, routes=routes)
        real = sum(1 for a, b in pairwise(st) if courses.route_between(routes, a.place_id, b.place_id))

        def ids(xs):
            return "→".join(str(x.place_id) for x in xs)

        f_m, r_m = courses.path_m(fixed, routes), courses.path_m(free, routes)
        mark = "  ← 순서를 바꾸면 더 짧아요" if min(f_m, r_m) < now else ""
        lines.append(f"코스 {tid} {titles.get(tid, '')}: 지금 {ids(st)} {now:,} m (실제 경로 {real}/{len(st) - 1}구간)"
                     f" | 첫 장소 그대로 최적 {ids(fixed)} {f_m:,} m | 자유 최적 {ids(free)} {r_m:,} m{mark}")
    return lines


# ---------- 네트워크
def fetch_one(client: httpx.Client, pa: dict, pb: dict, wait: Callable[[], None]) -> dict | None:
    """한 쌍 받기. 실패하면 한 번 더. wait()는 요청 사이 간격(1초 이상)을 지킨다"""
    last = ""
    for attempt in range(2):
        wait()
        try:
            r = client.get(route_url(pa, pb), params=PARAMS)
            if r.status_code == 200:
                row = parse_route(r.json(), pa["id"], pb["id"])
                if row:
                    return row
                last = f"경로 없음 ({r.json().get('code')})"
            else:
                last = f"HTTP {r.status_code}"
        except (httpx.HTTPError, ValueError) as e:
            last = str(e)[:80]
        if attempt == 0:
            time.sleep(RETRY_WAIT_S)
    print(f"  ! {pa['id']}–{pb['id']} 건너뜀: {last}")
    return None


def _pacer(interval: float) -> Callable[[], None]:
    last = [0.0]

    def wait() -> None:
        gap = time.monotonic() - last[0]
        if gap < interval:
            time.sleep(interval - gap)
        last[0] = time.monotonic()
    return wait


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="OpenStreetMap 실제 도보 경로를 받아 walk_routes.json 에 저장 (1초에 1번)")
    ap.add_argument("--only-courses", action="store_true", help="코스에서 이어지는 장소 쌍만 받기 (tour_places.json)")
    ap.add_argument("--dry-run", action="store_true", help="받을 쌍 개수만 보여 주고 받지 않기")
    ap.add_argument("--out", type=Path, default=OUT, help="저장할 파일 (기본 app/seeds/data/walk_routes.json)")
    ap.add_argument("--limit", type=int, default=0, help="이번에 받을 최대 쌍 수 (0 = 전부)")
    a = ap.parse_args(argv)

    places, stops, tours = load_json(PLACES), load_json(TOUR_PLACES), load_json(TOURS)
    by_id = {p["id"]: p for p in places}
    pairs = course_pairs(places, stops) if a.only_courses else all_pairs(places)
    existing = load_json(a.out)
    todo = todo_pairs(pairs, existing)
    if a.limit:
        todo = todo[:a.limit]
    print(f"장소 {sum(1 for p in places if has_xy(p))}곳(좌표 있음) · 대상 쌍 {len(pairs)} · 이미 받음 {len(pairs) - len(todo_pairs(pairs, existing))}"
          f" · 이번에 받을 쌍 {len(todo)} (약 {len(todo) * MIN_INTERVAL_S / 60:.1f}분)")
    if a.dry_run:
        return 0

    got: list[dict] = []
    wait = _pacer(MIN_INTERVAL_S)

    def save() -> None:
        a.out.write_bytes(dump_routes(merge(existing, got)).encode("utf-8"))

    try:
        with httpx.Client(timeout=20, headers={"User-Agent": USER_AGENT}) as c:
            for n, (x, y) in enumerate(todo, 1):
                row = fetch_one(c, by_id[x], by_id[y], wait)
                if row:
                    got.append(row)
                    print(f"[{n}/{len(todo)}] {x} {by_id[x]['name'][:12]} – {y} {by_id[y]['name'][:12]}: {row['distance_m']:,} m · 점 {len(row['path'])}개")
                if n % SAVE_EVERY == 0:
                    save()
    except KeyboardInterrupt:
        print("\n멈춤 — 받은 만큼 저장해요. 같은 명령을 다시 돌리면 이어 받아요.")
    save()
    rows = load_json(a.out)
    print(f"\n저장: {a.out} ({len(rows)}쌍, 이번에 {len(got)}쌍). 경로 © OpenStreetMap contributors (ODbL)")
    print("\n코스 순서 비교 (지금 순서 vs 걷는 거리가 가장 짧은 순서):")
    for line in course_report(places, stops, tours, rows):
        print("  " + line)
    print("\n다음: uv run python -m app.seeds")
    return 0


if __name__ == "__main__":
    sys.exit(main())
