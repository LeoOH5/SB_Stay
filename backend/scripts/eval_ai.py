"""AI 품질 평가 세트 (v3.9) — DB 없이 시드 장소 자료(places.json)만으로 돈다.

무엇을 재나
1. AI-02 근거 일치율: 장소 자료의 '질문-답'을 그대로 물었을 때 자료의 답을 돌려주는 비율 (한·영)
2. AI-02 '자료에 없음' 정확도: 자료에 없는 질문(주차·와이파이·환전 등 16개 × 장소)에 지어내지 않고
   "자료에 없어요"라고 답하는 비율
3. AI-02 숫자 차단율: LLM 답에 자료에 없는 숫자(연도·금액·시간)를 섞으면 버리는 비율, 자료 숫자만 쓴 답은 통과시키는 비율
4. AI-05 숫자 누락 검사: 번역 초안에서 원문 숫자가 빠지면 경고하는 비율

기본은 LLM 없이 규칙 기반 경로(폴백)를 잰다 — 결과가 늘 같아서 CI(tests/test_ai_eval.py)가 기준선 아래로 떨어지는지 막는다.
--llm 을 주면 .env 의 LLM 키로 AI-02 실제 답도 재서 같은 표로 보여 준다 (키가 없으면 건너뜀).

    uv run python -m scripts.eval_ai          # 규칙 기반 (CI와 같음)
    uv run python -m scripts.eval_ai --llm    # 실제 LLM 답도 함께
"""
import argparse
import asyncio
import json
from dataclasses import dataclass, field
from pathlib import Path

from app.services import llm, notice, story

PLACES_JSON = Path(__file__).resolve().parents[1] / "app" / "seeds" / "data" / "places.json"

# 장소 자료에 없는 질문 (관광객이 실제로 물을 만한 것 위주)
OUT_OF_DOC = {
    "ko": ["주차장이 있나요?", "와이파이 비밀번호가 뭐예요?", "강아지 데리고 들어가도 되나요?", "근처에 ATM이 있나요?",
           "오늘 밤 케이팝 공연은 어디서 해요?", "환전은 어디서 하나요?", "유모차 대여가 되나요?", "지하철 막차는 몇 시예요?"],
    "en": ["Is there a parking lot?", "What is the Wi-Fi password?", "Can I bring my dog inside?", "Is there an ATM nearby?",
           "Where is a K-pop concert tonight?", "Where can I exchange money?", "Can I rent a stroller?", "When is the last subway train?"],
}
FAKE_NUMBER = "1234"  # 어떤 장소 자료에도 없는 숫자 (연도처럼 보이게)


@dataclass
class Score:
    ok: int = 0
    total: int = 0
    misses: list[str] = field(default_factory=list)

    def add(self, good: bool, note: str = "") -> None:
        self.total += 1
        self.ok += int(good)
        if not good and note:
            self.misses.append(note)

    @property
    def rate(self) -> float:
        return self.ok / self.total if self.total else 1.0


def load_places(path: Path = PLACES_JSON) -> list[dict]:
    return [p for p in json.loads(path.read_text(encoding="utf-8")) if p.get("story_doc")]


def eval_grounded(places: list[dict]) -> Score:
    """자료의 질문을 그대로 물으면 자료의 답을 돌려주는가 (규칙 검색)"""
    s = Score()
    for p in places:
        docs = story.parse(p["story_doc"])
        for lang in ("ko", "en"):
            doc, used = story.pick_doc(docs, lang)
            for q, a in docs[used].qa:
                ans, grounded = story.fallback_answer(doc, q, lang)
                s.add(grounded and ans == a, f"{p['name']} [{lang}] {q}")
    return s


def eval_not_found(places: list[dict]) -> Score:
    """자료에 없는 질문에 '자료에 없어요'라고 답하는가 (지어내지 않음)"""
    s = Score()
    for p in places:
        docs = story.parse(p["story_doc"])
        for lang, qs in OUT_OF_DOC.items():
            doc, _ = story.pick_doc(docs, lang)
            for q in qs:
                ans, grounded = story.fallback_answer(doc, q, lang)
                s.add(not grounded, f"{p['name']} [{lang}] {q} → {ans[:40]}")
    return s


def eval_number_guard(places: list[dict]) -> tuple[Score, Score]:
    """LLM 답 검사: 자료에 없는 숫자가 섞이면 버리고(blocked), 자료 숫자만 쓴 답은 통과(passed)"""
    blocked, passed = Score(), Score()
    for p in places:
        doc_text = story.clean_doc(p["story_doc"])
        nums = sorted(story._NUM.findall(doc_text))
        good = f"{p['name']}의 이야기예요." + (f" {nums[0]}" if nums else "")
        try:
            story.validate_llm({"answer": good, "grounded": True}, doc_text)
            passed.add(True)
        except ValueError:
            passed.add(False, f"{p['name']} 자료 숫자만 쓴 답이 막힘")
        bad = f"{p['name']}은 {FAKE_NUMBER}년에 지어졌어요."
        try:
            story.validate_llm({"answer": bad, "grounded": True}, doc_text)
            blocked.add(False, f"{p['name']} 없는 숫자가 통과")
        except ValueError:
            blocked.add(True)
    return blocked, passed


NOTICE_CASES = [
    ("체크인은 15:00, 체크아웃은 11:00입니다.", {"en": "Check-in is at 15:00 and check-out at 11:00."}, False),
    ("체크인은 15:00, 체크아웃은 11:00입니다.", {"en": "Check-in is in the afternoon and check-out at 11:00."}, True),
    ("보증금 20,000원은 영수증 확인 뒤 돌려드려요.", {"ja": "保証金20,000ウォンは領収書確認後に返金します。"}, False),
    ("보증금 20,000원은 영수증 확인 뒤 돌려드려요.", {"ja": "保証金は領収書確認後に返金します。"}, True),
    ("비상 연락처 02-1234-5678, 302호", {"zh": "紧急联系 02-1234-5678，302号房"}, False),
    ("비상 연락처 02-1234-5678, 302호", {"zh": "紧急联系 02-1234-5678"}, True),
]


def eval_notice() -> Score:
    """AI-05: 원문 숫자가 빠진 초안은 경고하고, 다 있으면 경고하지 않는가"""
    s = Score()
    for text, drafts, should_warn in NOTICE_CASES:
        warned = bool(notice.check(text, drafts))
        s.add(warned == should_warn, f"{text} → {drafts}")
    return s


async def eval_llm(places: list[dict], limit: int = 20) -> tuple[Score, Score] | None:
    """실제 LLM으로 AI-02: 자료 질문에 grounded=true, 자료 밖 질문에 grounded=false 를 내는가 (숫자 검사 포함)"""
    if not llm.enabled():
        return None
    inside, outside = Score(), Score()
    cases = []
    for p in places:
        docs = story.parse(p["story_doc"])
        cases += [(p, "ko", q, True) for q, _ in docs["ko"].qa[:1]]
        cases += [(p, "en", OUT_OF_DOC["en"][len(cases) % 8], False)]
    for p, lang, q, expect in cases[:limit]:
        doc_text = story.clean_doc(p["story_doc"])
        place = type("P", (), {"name": p["name"], "name_en": p.get("name_en", "")})
        system, user = story.llm_prompt(place, doc_text, q, lang)
        try:
            _, grounded = story.validate_llm(await llm.complete_json(system, user), doc_text)
        except (llm.LLMUnavailable, ValueError):
            grounded = None  # 실패·숫자 검사 탈락 → 서비스는 규칙 답으로 대신함
        target = inside if expect else outside
        target.add(grounded is expect, f"{p['name']} [{lang}] {q} → {grounded}")
    return inside, outside


def run(with_llm: bool = False) -> dict[str, Score]:
    places = load_places()
    blocked, passed = eval_number_guard(places)
    res = {
        "AI-02 근거 일치율 (자료 질문 → 자료 답)": eval_grounded(places),
        "AI-02 '자료에 없음' 정확도 (자료 밖 질문)": eval_not_found(places),
        "AI-02 숫자 차단율 (없는 숫자 섞인 LLM 답)": blocked,
        "AI-02 정상 답 통과율 (자료 숫자만 쓴 답)": passed,
        "AI-05 숫자 누락 경고 정확도": eval_notice(),
    }
    if with_llm:
        out = asyncio.run(eval_llm(places))
        if out:
            res["AI-02 LLM 자료 질문 grounded"] = out[0]
            res["AI-02 LLM 자료 밖 질문 거절"] = out[1]
        else:
            print("LLM 키가 없어 LLM 평가는 건너뜀")
    return res


def main() -> None:
    ap = argparse.ArgumentParser(description="SB Stay AI 품질 평가 세트")
    ap.add_argument("--llm", action="store_true", help="실제 LLM 답도 잰다 (.env 의 LLM 키 필요)")
    ap.add_argument("--misses", action="store_true", help="틀린 사례를 보여 준다")
    args = ap.parse_args()
    res = run(args.llm)
    width = max(len(k) for k in res)
    for k, s in res.items():
        print(f"{k:<{width}}  {s.ok:>4}/{s.total:<4}  {s.rate * 100:5.1f}%")
        if args.misses:
            for m in s.misses[:20]:
                print(f"    - {m}")


if __name__ == "__main__":
    main()
