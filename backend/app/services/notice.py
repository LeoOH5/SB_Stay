"""AI-05 다국어 안내문 초안 (A 담당, 명세상 '제외'였지만 운영자 도구로 둔다).

운영자가 한국어 안내문을 넣으면 LLM이 언어별 초안을 만든다. 저장·게시는 운영자가 따로 한다.
번역은 AI 없이는 할 수 없어서, 키가 없으면 원문을 그대로 돌려주고 ai=false로 알린다.
숫자(시간·금액·호실)는 사실이라 원문 숫자가 초안에 모두 있는지 확인해 빠진 것을 warnings로 알린다.
"""
import re

LANG_NAMES = {"ko": "Korean", "en": "English", "ja": "Japanese", "zh": "Simplified Chinese"}
_NUM = re.compile(r"\d+(?:[:.,]\d+)*")


def llm_prompt(text: str, targets: list[str]) -> tuple[str, str]:
    keys = ", ".join(f'"{t}"' for t in targets)
    system = (
        "You translate notices for foreign guests staying in a Korean university dormitory.\n"
        "Rules:\n"
        "- Translate faithfully. Keep every time, date, price, room number and phone number exactly as written.\n"
        "- Do not add or remove rules. Use a polite, clear tone.\n"
        f"- Reply with JSON only, one key per language code ({keys}): " + '{"en": "..."}'
    )
    langs = ", ".join(f"{t} = {LANG_NAMES[t]}" for t in targets)
    return system, f"Languages: {langs}\n\nNotice (Korean):\n{text}"


def numbers(text: str) -> set[str]:
    return set(_NUM.findall(text))


def check(text: str, drafts: dict[str, str]) -> list[str]:
    """원문 숫자가 빠진 초안을 찾는다. 예: 'ja: 15:00 없음'"""
    want = numbers(text)
    return [f"{lang}: {', '.join(sorted(want - numbers(d)))} 없음" for lang, d in drafts.items() if want - numbers(d)]
