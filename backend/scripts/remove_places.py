"""관광지 빼기: uv run python scripts/remove_places.py <id> [<id>...] [--data 폴더] [--check]

places.json · places_pending.json · tour_places.json 에서 그 id를 지운다 (파일마다 원래 JSON 모양 유지, 코스 순서 seq는 다시 매김).
v3.8: walk_routes.json(실제 도보 경로, 있으면)에서 그 장소가 낀 쌍도 지운다. 파일이 없으면 만들지 않는다.
패키지 코스·예약 요청(request.places)·버디 활동 기록(장소 이름)이 아직 그 장소를 쓰면 아무것도 지우지 않고 멈춘다.
예: 혜화문(112)은 종로구라 서비스에서 뺀다 → uv run python scripts/remove_places.py 112
"""
import argparse
import json
import sys
from pathlib import Path

try:
    from scripts.fetch_walk_routes import dump_routes
    from scripts.import_seed_xlsx import detect_style, dump
except ModuleNotFoundError:  # python scripts/remove_places.py 로 직접 실행
    from fetch_walk_routes import dump_routes
    from import_seed_xlsx import detect_style, dump

DATA = Path(__file__).resolve().parents[1] / "app" / "seeds" / "data"
PLACE_FILES = ("places.json", "places_pending.json")
ROUTES_FILE = "walk_routes.json"


def _load(data: Path, name: str) -> list[dict]:
    p = data / name
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else []


def blockers(data: Path, ids: set[int]) -> list[str]:
    """아직 그 장소를 쓰는 곳 (패키지 코스 · 예약 요청 · 활동 기록)"""
    names = {p["id"]: p["name"] for f in PLACE_FILES for p in _load(data, f) if p["id"] in ids}
    stops = _load(data, "tour_places.json")
    out = []
    for pkg in _load(data, "packages.json"):
        hit = sorted({s["place_id"] for s in stops if s["tour_id"] == pkg.get("tour_id") and s["place_id"] in ids})
        if hit:
            out.append(f"패키지 {pkg['id']}({pkg['title']})의 코스 {pkg['tour_id']}에 장소 {hit}")
    for it in _load(data, "booking_items.json"):
        hit = sorted(set((it.get("request") or {}).get("places") or []) & ids)
        if hit:
            out.append(f"예약 항목 {it['id']}의 요청 장소 {hit}")
    for a in _load(data, "buddy_activities.json"):
        hit = sorted(n for i, n in names.items() if n in (a.get("places") or []))
        if hit:
            out.append(f"버디 활동 기록 {a['id']}에 {', '.join(hit)}")
    return out


def remove(data: Path, ids: set[int]) -> dict[str, tuple[str, list[str]]]:
    """{파일: (새 글자, 지운 것 설명)} — 바뀌는 파일만"""
    out = {}
    for name in PLACE_FILES:
        rows = _load(data, name)
        gone = [r for r in rows if r["id"] in ids]
        if gone:
            keep = [r for r in rows if r["id"] not in ids]
            out[name] = (dump(keep, detect_style((data / name).read_text(encoding="utf-8"))), [f"{r['id']} {r['name']}" for r in gone])
    stops = _load(data, "tour_places.json")
    gone = [s for s in stops if s["place_id"] in ids]
    if gone:
        keep, seq = [], {}
        for s in stops:
            if s["place_id"] in ids:
                continue
            seq[s["tour_id"]] = seq.get(s["tour_id"], 0) + 1
            keep.append(s | {"seq": seq[s["tour_id"]]})
        raw = (data / "tour_places.json").read_text(encoding="utf-8")
        out["tour_places.json"] = (dump(keep, detect_style(raw)), [f"코스 {s['tour_id']} · 장소 {s['place_id']}" for s in gone])
    routes = _load(data, ROUTES_FILE)  # v3.8 도보 경로 (fetch_walk_routes.py 모양 그대로 다시 쓴다)
    gone = [r for r in routes if r["from_place_id"] in ids or r["to_place_id"] in ids]
    if gone:
        keep = [r for r in routes if r not in gone]
        out[ROUTES_FILE] = (dump_routes(keep), [f"경로 {r['from_place_id']}–{r['to_place_id']}" for r in gone])
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="시드에서 관광지 빼기")
    ap.add_argument("ids", nargs="+", type=int)
    ap.add_argument("--data", type=Path, default=DATA, help="시드 JSON 폴더")
    ap.add_argument("--check", action="store_true", help="검사만 하고 쓰지 않음")
    a = ap.parse_args(argv)
    ids = set(a.ids)
    known = {p["id"] for f in PLACE_FILES for p in _load(a.data, f)}
    if missing := sorted(ids - known):
        print(f"없는 장소 id: {missing}", file=sys.stderr)
        return 1
    if found := blockers(a.data, ids):
        print("아직 쓰는 곳이 있어 지우지 않았어요:", file=sys.stderr)
        for b in found:
            print("  " + b, file=sys.stderr)
        return 1
    for name, (text, what) in remove(a.data, ids).items():
        if not a.check:
            (a.data / name).write_bytes(text.encode("utf-8"))
        print(f"{name}: {', '.join(what)} {'지울 예정 (검사만)' if a.check else '지움'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
