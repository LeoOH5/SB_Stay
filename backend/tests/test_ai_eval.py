"""v3.9 AI 품질 평가 세트 (scripts/eval_ai.py) — 규칙 기반 경로가 기준선 아래로 떨어지지 않게 막는다.
기준선(2026-11-07 측정): 근거 일치 99.0% · 자료에 없음 95.8% · 숫자 차단 100% · 정상 답 통과 100% · AI-05 100%"""
from scripts import eval_ai


def test_eval_set_meets_baseline():
    res = eval_ai.run()
    rates = {k.split(" (")[0]: s.rate for k, s in res.items()}
    assert rates["AI-02 근거 일치율"] >= 0.95
    assert rates["AI-02 '자료에 없음' 정확도"] >= 0.95
    assert rates["AI-02 숫자 차단율"] == 1.0
    assert rates["AI-02 정상 답 통과율"] == 1.0
    assert rates["AI-05 숫자 누락 경고 정확도"] == 1.0


def test_eval_set_size():
    """평가 세트가 줄어들어 점수가 부풀지 않게: 자료 질문 90개 이상, 자료 밖 질문 384개 이상"""
    res = eval_ai.run()
    assert res["AI-02 근거 일치율 (자료 질문 → 자료 답)"].total >= 90
    assert res["AI-02 '자료에 없음' 정확도 (자료 밖 질문)"].total >= 384
