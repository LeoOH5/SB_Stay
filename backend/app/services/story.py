"""AI-02 역사 스토리 (A 담당). 근거 자료는 places.story_doc 하나뿐이다 (RAG 문서).

story_doc 모양 (데이터팀 양식)
    ## 한 줄 소개 / ## 이야기 (또는 ## 기본 사실과 이야기) / ## 관광객이 물을 만한 질문과 답 / ## 볼 때 팁
    ## English  ← Intro: / Story: / - Q: … A: … / Tip: 줄 (영어 화면용, 한국어 원문을 옮긴 것)

흐름
1. story_doc을 조각(chunk)으로 나눈다: 소개, 이야기 문단, 질문-답, 팁.
2. 질문이 없으면 소개 + 첫 이야기 문단을 돌려준다.
3. 질문이 있으면 LLM에 문서 전체를 주고 "문서 안에서만" 답하게 한다.
   키가 없거나 실패하면 글자 겹침으로 가장 비슷한 조각을 찾아 그 문장을 그대로 돌려준다.
4. 어느 쪽이든 근거가 없으면 grounded=false + "자료에 없다" 안내. 출처(sources)는 항상 DB 값.
"""
import re
from dataclasses import dataclass, field

from app.models import Place

NOT_FOUND = {
    "ko": "자료에 없는 내용이에요. 버디나 운영팀에 물어봐 주세요.",
    "en": "That isn't in our materials. Please ask your buddy or our support team.",
}
NO_STORY = {
    "ko": "아직 이 장소의 이야기 자료가 없어요.",
    "en": "We don't have a story for this place yet.",
}

# 데이터팀 메모는 관광객에게 보이면 안 된다
_MARKER = re.compile(r"\s*\[확인 필요[^\]]*\]")
_INTERNAL = ("보강 필요", "없어도 됨", "누리집에서 확인", "데모")


@dataclass
class Doc:
    intro: str = ""
    story: list[str] = field(default_factory=list)  # 이야기 문단 (짧은 문서는 사실 줄도 여기)
    facts: list[str] = field(default_factory=list)  # '## 기본 사실' 줄 (검색에만 쓰고 소개에는 안 씀)
    qa: list[tuple[str, str]] = field(default_factory=list)
    tips: list[str] = field(default_factory=list)

    def empty(self) -> bool:
        return not (self.intro or self.story or self.qa)


def _clean(line: str) -> str:
    return _MARKER.sub("", line).strip()


def _keep(line: str) -> bool:
    return bool(line) and not any(w in line for w in _INTERNAL)


def parse(story_doc: str | None) -> dict[str, Doc]:
    """story_doc → {"ko": Doc, "en": Doc}. 제목(# …)·기본 사실 표 같은 줄도 놓치지 않게 느슨하게 읽는다."""
    ko, en = Doc(), Doc()
    if not story_doc:
        return {"ko": ko, "en": en}
    head, _, eng = story_doc.partition("## English")

    section = ""
    pending_q: str | None = None
    for raw in head.splitlines():
        line = raw.strip()
        if line.startswith("## "):
            section = line[3:]
            continue
        if not line or line.startswith("# "):
            continue
        text = _clean(line.lstrip("- ").strip())
        if not _keep(text):
            continue
        if "질문" in section:
            if text.startswith("Q:"):
                pending_q = text[2:].strip()
            elif text.startswith("A:") and pending_q:
                ko.qa.append((pending_q, text[2:].strip()))
                pending_q = None
        elif "소개" in section:
            ko.intro = (ko.intro + " " + text).strip()
        elif "팁" in section:
            ko.tips.append(text)
        elif section == "기본 사실":
            ko.facts.append(text)
        else:  # 이야기 / 기본 사실 / 기본 사실과 이야기 / 제목 없는 짧은 문서
            ko.story.append(text)
    if not ko.intro and ko.story:  # '한 줄 소개'가 없는 짧은 문서
        ko.intro = ko.story.pop(0)

    pending_q = None
    for raw in eng.splitlines():
        line = _clean(raw.strip().lstrip("- ").strip())
        if not _keep(line):
            continue
        if line.startswith("Intro:"):
            en.intro = line[6:].strip()
        elif line.startswith("Story:"):
            en.story.append(line[6:].strip())
        elif line.startswith("Tip:"):
            en.tips.append(line[4:].strip())
        elif line.startswith("Q:"):
            pending_q = line[2:].strip()
        elif line.startswith("A:") and pending_q:
            en.qa.append((pending_q, line[2:].strip()))
            pending_q = None
    return {"ko": ko, "en": en}


def pick_doc(docs: dict[str, Doc], language: str) -> tuple[Doc, str]:
    """요청 언어 문서가 비어 있으면 한국어 원문으로 대신한다. (문서, 실제로 쓴 언어)"""
    if not docs[language].empty():
        return docs[language], language
    return docs["ko"], "ko"


def _sentence(s: str) -> str:
    """목록 줄('…옮겼다')을 이어 붙일 때 문장이 붙어 보이지 않게 마침표를 단다"""
    return s if s.endswith((".", "!", "?")) else s + "."


def intro_text(doc: Doc) -> str:
    """질문 없이 장소를 고르면 보여 줄 이야기: 소개 + 이야기 앞부분 (너무 길지 않게)"""
    parts = [doc.intro] if doc.intro else []
    for s in doc.story:
        if sum(len(p) for p in parts) > 260:
            break
        parts.append(s)
    return " ".join(_sentence(p) for p in parts)


# ---------- 규칙 기반 검색 (LLM 없을 때) ----------
_EN_STOP = {
    "a", "an", "the", "is", "are", "was", "were", "do", "does", "did", "of", "to", "in", "on", "at", "for", "and",
    "or", "this", "that", "it", "its", "here", "there", "what", "why", "who", "when", "where", "how", "which",
    "can", "i", "you", "we", "they", "he", "she", "his", "her", "my", "your", "be", "been", "with", "about",
    "place", "please", "tell", "me", "any", "there's", "it's", "so", "as", "by", "from",
}
# 한국어 어미·조사로 생기는 흔한 두 글자 (겹쳐도 의미 없음)
_KO_STOP = {"나요", "어요", "있어", "있나", "인가", "가요", "니까", "습니", "니다", "해요", "세요", "는데", "하나",
            "까요", "었나", "했나", "이에", "에요", "인지", "는지", "건가", "었어", "했어", "되나", "이곳", "여기"}


def _stem(w: str) -> str:
    for suf in ("ing", "ed", "es", "s"):
        if len(w) > len(suf) + 2 and w.endswith(suf):
            return w[: -len(suf)]
    return w


# 어절 끝 조사·어미를 떼야 '백석은'과 '백석과'가 같은 말로 잡힌다 (긴 것부터 시도)
_KO_TAIL = re.compile(
    r"(이에요|예요|에요|인가요|인가|나요|까요|어요|아요|해요|했어|했나|있어|있나|이야|에서|으로|이랑|"
    r"은|는|이|가|을|를|에|의|도|로|와|과|랑|요|야|니)$"
)


def tokens(text: str) -> set[str]:
    """영어는 단어, 한국어는 어절 안의 두 글자씩. 숫자는 그대로."""
    out: set[str] = set()
    for word in re.findall(r"[A-Za-z']+|[0-9]+|[가-힣]+", text.lower()):
        if word[0].isascii() and word[0].isalpha():
            if word not in _EN_STOP:
                out.add(_stem(word))
        elif word.isdigit():
            out.add(word)
        else:
            word = _KO_TAIL.sub("", word) if len(word) > 2 else word
            if len(word) < 2:
                continue
            out.update(b for b in (word[i : i + 2] for i in range(len(word) - 1)) if b not in _KO_STOP)
    return out


def retrieve(doc: Doc, question: str) -> tuple[str | None, float]:
    """질문과 가장 많이 겹치는 조각의 답 문장. 질문-답은 질문 문장과, 나머지는 본문과 비교한다."""
    q = tokens(question)
    if not q:
        return None, 0.0
    # 질문-답은 질문과 답 문장을 함께 본다 (같은 점수면 앞에 있는 질문-답이 이긴다)
    chunks: list[tuple[set[str], str]] = [(tokens(qq) | tokens(a), a) for qq, a in doc.qa]
    chunks += [(tokens(s), s) for s in [doc.intro, *doc.story, *doc.facts, *doc.tips] if s]
    best, best_score = None, 0.0
    for toks, answer in chunks:
        hit = len(q & toks)
        score = hit / len(q)
        if (hit >= 2 or (hit == 1 and len(q) <= 2)) and score > best_score:
            best, best_score = answer, score
    return (best, best_score) if best_score >= 0.5 else (None, best_score)


def fallback_answer(doc: Doc, question: str | None, language: str) -> tuple[str, bool]:
    if doc.empty():
        return NO_STORY[language], False
    if not question:
        return intro_text(doc), True
    hit, _ = retrieve(doc, question)
    return (hit, True) if hit else (NOT_FOUND[language], False)


# ---------- LLM ----------
def llm_prompt(place: Place, story_doc: str, question: str | None, language: str) -> tuple[str, str]:
    lang_name = "Korean" if language == "ko" else "English"
    system = (
        "You are a friendly heritage storyteller for travelers in Seongbuk-dong, Seoul.\n"
        "Rules:\n"
        "- Use ONLY facts written in the DOCUMENT. Never add names, dates, numbers or events that are not in it.\n"
        "- If the DOCUMENT does not answer the question, set grounded to false and say briefly that it is not in the materials.\n"
        f"- Write the answer in {lang_name}, 2 to 5 short sentences, plain words for a tourist.\n"
        '- Reply with JSON only: {"answer": "...", "grounded": true}'
    )
    task = f"Question: {question}" if question else "No question. Introduce this place as a short story for a visitor."
    user = f"Place: {place.name} ({place.name_en})\n\nDOCUMENT:\n{story_doc}\n\n{task}"
    return system, user


_NUM = re.compile(r"\d[\d,.]*")


def validate_llm(raw: dict, story_doc: str) -> tuple[str, bool]:
    """LLM 답 검사. 모양이 틀리거나 문서에 없는 숫자(연도·금액·시간)가 섞이면 ValueError → 규칙 답으로 대신한다."""
    answer, grounded = raw.get("answer"), raw.get("grounded")
    if not isinstance(answer, str) or not answer.strip() or not isinstance(grounded, bool):
        raise ValueError("answer/grounded 형식 오류")
    doc_nums = {n.rstrip(".,").replace(",", "") for n in _NUM.findall(story_doc)}
    for n in _NUM.findall(answer):
        if n.rstrip(".,").replace(",", "") not in doc_nums:
            raise ValueError(f"문서에 없는 숫자: {n}")
    return answer.strip()[:1500], grounded


def clean_doc(story_doc: str | None) -> str:
    """LLM에 줄 문서: 데이터팀 메모를 지운 원문"""
    lines = [_clean(line) for line in (story_doc or "").splitlines()]
    return "\n".join(line for line in lines if not any(w in line for w in _INTERNAL))
