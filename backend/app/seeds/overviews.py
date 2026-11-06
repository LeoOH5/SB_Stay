"""AI-02 근거 보강: 한국관광공사 TourAPI 장소 개요를 places.story_doc 에 붙인다.

- 개요는 scripts/fetch_tourapi.py overview 로 받아 data/place_overviews.json 에 저장한다 (앱이 매번 API를 부르지 않는다).
- 시드 때 장소마다 국문 개요는 '## 한국관광공사 자료' 문단으로, 영문 개요는 English 부분의 'Story:' 줄로 붙인다.
- 출처(sources)에 '한국관광공사 TourAPI'를 더한다. AI-02 는 story_doc 안에서만 답하므로 이 글도 근거가 된다.
"""
import html
import re

OVERVIEWS = "place_overviews.json"
KO_HEAD = "## 한국관광공사 자료"
TOURAPI_URL = "https://api.visitkorea.or.kr/"


def clean_overview(raw: str | None) -> str:
    """TourAPI overview(HTML 섞임) → 문단을 빈 줄로 나눈 평문"""
    if not raw:
        return ""
    s = re.sub(r"<br\s*/?>", "\n", raw, flags=re.IGNORECASE)
    s = html.unescape(re.sub(r"<[^>]+>", " ", s)).replace("\xa0", " ")
    paras = [re.sub(r"\s+", " ", p).strip() for p in s.split("\n")]
    return "\n\n".join(p for p in paras if p)


def merge(place: dict, ov: dict | None) -> dict:
    """place(dict) 에 개요를 붙인 새 dict. 이미 붙어 있으면 다시 붙이지 않는다."""
    if not ov:
        return place
    p = dict(place)
    doc = p.get("story_doc") or ""
    head, sep, eng = doc.partition("## English")
    ko, en = ov.get("ko") or {}, ov.get("en") or {}
    ko_text, en_text = clean_overview(ko.get("overview")), clean_overview(en.get("overview"))
    if ko_text and KO_HEAD not in head:
        head = head.rstrip() + f"\n\n{KO_HEAD}\n" + ko_text + "\n\n"
    if en_text:
        lines = "\n".join(f"Story: {para}" for para in en_text.split("\n\n"))
        if lines not in eng:
            sep = sep or "## English"
            eng = eng.rstrip() + "\n" + lines + "\n"
    p["story_doc"] = head + sep + eng
    srcs = list(p.get("sources") or [])
    for lang, item in (("국문", ko), ("영문", en)):
        if not (item.get("overview") and item.get("contentid")):
            continue
        title = f"한국관광공사 TourAPI {lang} · {item.get('title') or p.get('name')} (contentid {item['contentid']})"
        if all(s.get("title") != title for s in srcs):
            srcs.append({"title": title, "url": TOURAPI_URL})
    p["sources"] = srcs
    return p
