"""AI-02 근거 보강: TourAPI 개요가 story_doc·sources 에 붙고, 이야기 검색의 근거로 쓰이는지"""
from app.seeds import overviews
from app.services import story

PLACE = {
    "id": 999,
    "name": "테스트 옛집",
    "story_doc": "# 테스트 옛집\n\n## 한 줄 소개\n오래된 한옥이다.\n\n## English\nIntro: An old hanok.\n",
    "sources": [{"title": "성북구청 자료", "url": "https://www.sb.go.kr/"}],
}
OV = {
    "ko": {"contentid": "12345", "title": "테스트 옛집",
           "overview": "1930년대에 지은 집으로<br>정원에는 <b>모란</b>과 감나무가 있다.&nbsp;"},
    "en": {"contentid": "67890", "title": "Test House", "overview": "The garden has peonies and a persimmon tree."},
}


def test_clean_overview_strips_html():
    assert overviews.clean_overview(OV["ko"]["overview"]) == "1930년대에 지은 집으로\n\n정원에는 모란 과 감나무가 있다."
    assert overviews.clean_overview(None) == ""


def test_merge_adds_paragraph_and_sources_once():
    once = overviews.merge(PLACE, OV)
    twice = overviews.merge(once, OV)
    assert once == twice  # 두 번 돌려도 같다
    assert once["story_doc"].count(overviews.KO_HEAD) == 1
    titles = [s["title"] for s in once["sources"]]
    assert titles[0] == "성북구청 자료"
    assert any("TourAPI 국문" in t and "12345" in t for t in titles)
    assert any("TourAPI 영문" in t and "67890" in t for t in titles)
    assert PLACE["sources"] == [{"title": "성북구청 자료", "url": "https://www.sb.go.kr/"}]  # 원본은 그대로


def test_overview_becomes_grounding():
    docs = story.parse(overviews.merge(PLACE, OV)["story_doc"])
    assert docs["ko"].intro == "오래된 한옥이다."  # 소개는 그대로
    assert any("감나무" in s for s in docs["ko"].story)
    assert any("persimmon" in s for s in docs["en"].story)
    ans, grounded = story.fallback_answer(docs["ko"], "정원에 감나무가 있나요?", "ko")
    assert grounded and "감나무" in ans


def test_no_overview_keeps_place():
    assert overviews.merge(PLACE, None) is PLACE
    only_ko = overviews.merge(PLACE, {"ko": OV["ko"]})
    assert "Story:" not in only_ko["story_doc"]
