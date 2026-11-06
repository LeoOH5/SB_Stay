"""v3.7 버디 자격 두 경로(성북구 대학 메일 / 성북구 거주) · 사전 교육 영상 · 승인 조건"""
from app.core import rules
from app.models import BuddyProfile
from app.schemas.ai import MatchIn
from app.services import buddy_quiz, matcher
from tests.conftest import login, upload_png

B = "/api/v1/buddy"


def _new_buddy(client, email):
    r = client.post("/api/v1/auth/signup", json={"name": "거주버디", "email": email, "password": "password1"})
    h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert client.patch("/api/v1/auth/me/role", json={"role": "buddy"}, headers=h).status_code == 200
    return h


def _residence(client, h, **kw):
    body = {"school_name": "서울시립대학교", "residence_proof_url": upload_png(client, h), "enrollment_proof_url": upload_png(client, h),
            "birth_date": "2004-02-01", "korean_national": True} | kw
    return client.post(f"{B}/apply/residence", json=body, headers=h)


def _finish(client, h):
    """약속 · 영상 5개 · 퀴즈 10/10 · 프로필"""
    client.post(f"{B}/apply/agree", headers=h)
    for v in rules.EDUCATION_IDS:
        client.post(f"{B}/apply/education/{v}", headers=h)
    qs = client.get(f"{B}/apply/quiz", headers=h).json()["questions"]
    client.post(f"{B}/apply/quiz", json={"answers": {q["id"]: buddy_quiz.BY_ID[q["id"]]["answer"] for q in qs}}, headers=h)
    client.put(f"{B}/profile", json={"major": "도시공학", "intro": "정릉에 살아요", "languages": ["ko", "en"]}, headers=h)
    return client.get(f"{B}/profile", headers=h).json()["id"]


def test_residence_path(client, operator, db, reset_db):
    h = _new_buddy(client, "res@gmail.com")
    # 사진은 우리 /uploads가 만든 /media 주소만
    r = client.post(f"{B}/apply/residence", json={"school_name": "서울시립대학교", "residence_proof_url": "https://x.com/a.jpg",
                                                   "enrollment_proof_url": "b.jpg", "birth_date": "2004-02-01", "korean_national": True}, headers=h)
    assert r.status_code == 422 and r.json()["error"]["code"] == "PHOTO_URL"
    assert _residence(client, h, korean_national=False).json()["error"]["code"] == "NOT_KOREAN_NATIONAL"
    assert _residence(client, h, birth_date="2009-01-01").json()["error"]["code"] == "TOO_YOUNG"
    s = _residence(client, h).json()
    assert (s["eligibility"], s["eligible"], s["email_verified"], s["university"], s["school_name"]) == ("residence", True, False, "서울시립대학교", "서울시립대학교")
    assert s["residence_proof_url"].startswith("/media/") and s["enrollment_proof_url"].startswith("/media/") and s["status"] == "pending"
    pid = _finish(client, h)
    prof = db.get(BuddyProfile, pid)
    assert prof.university_id is None and prof.eligibility == "residence"  # 성북구 밖 대학 → 대학 없음 (같은 학교 가산점 없음)
    row = next(x for x in client.get("/api/v1/admin/buddies", headers=operator).json()["items"] if x["id"] == pid)
    assert (row["eligibility"], row["university"], row["university_id"], row["videos_watched"]) == ("residence", "서울시립대학교", None, 5)
    assert row["residence_proof_url"].startswith("/media/") and row["school_email_verified"] is False
    # 운영자가 서류 두 장을 보고 승인 = 확인
    r = client.patch(f"/api/v1/admin/buddies/{pid}", json={"action": "approve"}, headers=operator)
    assert r.status_code == 200 and r.json()["status"] == "approved" and r.json()["approved_on"] == "2027-01-14"
    pub = client.get(f"/api/v1/buddies/{pid}").json()
    assert pub["university"] == "서울시립대학교" and pub["verified"] == {"school_email": False, "trained": True, "residence": True}
    # 매칭: 다른 학교 거주 버디도 추천되지만 같은 학교 가산점은 없다
    cands = {c.profile.id: c for c in matcher.candidates(db, MatchIn(language="en", interests=["walking"], university_id=1))}
    assert pid in cands and cands[pid].same_uni is False and cands[31].same_uni is True


def test_residence_seongbuk_school_name_sets_university(client, reset_db):
    """거주 경로라도 학교가 성북구 대학이면 그 대학 (같은 학교 숙소 우선 매칭 그대로)"""
    h = _new_buddy(client, "kmu@gmail.com")
    s = _residence(client, h, school_name="국민대학교").json()
    assert s["university"] == "국민대학교" and s["eligibility"] == "residence"
    assert client.get(f"{B}/profile", headers=h).json()["university_id"] == 2


def test_education_rules(client, reset_db):
    h = _new_buddy(client, "edu@korea.ac.kr")
    assert client.post(f"{B}/apply/education/safety", headers=h).status_code == 409  # 자격 확인 먼저
    client.post(f"{B}/apply/verify", json={"email": "edu@korea.ac.kr", "code": "123456", "birth_date": "2003-01-01", "korean_national": True}, headers=h)
    assert client.post(f"{B}/apply/education/nope", headers=h).status_code == 404
    edu = client.get(f"{B}/apply/education", headers=h).json()
    assert [v["title"] for v in edu["videos"]] == ["성북구 한눈에 보기", "길 안내와 교통", "안전과 응급", "역사 기본 상식", "버디 약속과 하지 말 것"]
    assert "해설이 아니라 기본 상식" in edu["videos"][3]["topics"] and "유료 해설" in edu["videos"][4]["topics"]
    for v in ("promises", "safety", "safety"):  # 순서 상관없고, 두 번 눌러도 한 번
        edu = client.post(f"{B}/apply/education/{v}", headers=h).json()
    assert edu["watched"] == 2 and client.get(f"{B}/apply", headers=h).json()["videos_watched"] == ["safety", "promises"]
    assert client.post(f"{B}/apply/quiz", json={"answers": {}}, headers=h).json()["error"]["code"] == "EDUCATION_NOT_DONE"


def test_quiz_pool_and_scoring():
    assert len(buddy_quiz.QUESTIONS) == 13 and rules.QUIZ_TOTAL == 10 and rules.QUIZ_PASS == 8
    a, b = buddy_quiz.for_user(101), buddy_quiz.for_user(101)
    assert [q["id"] for q in a] == [q["id"] for q in b] and len(a) == 10  # 다시 풀어도 같은 문제
    assert any([q["id"] for q in buddy_quiz.for_user(n)] != [q["id"] for q in a] for n in range(102, 110))  # 사람마다 다름
    assert "역사 해설을 하지 않아요" in " ".join(buddy_quiz.BY_ID["q3"]["options"])  # 무자격 해설 금지 문항 유지
    every = {q["id"]: q["answer"] for q in buddy_quiz.QUESTIONS}
    assert buddy_quiz.grade(every, 101) == 10  # 내지 않은 문제 답은 세지 않음
    shown = {q["id"] for q in a}
    assert buddy_quiz.grade({k: v for k, v in every.items() if k not in shown}, 101) == 0


def test_not_ready_reasons(client, operator, db, reset_db):
    # 시드 가은(38): 성북구 거주 · 서울시립대, 자리 표시 서류 두 장 · 영상 5 · 퀴즈 9 → 승인할 수 있는 상태
    gaeun = db.get(BuddyProfile, 38)
    gaeun.residence_proof_url, gaeun.education_watched = None, ["safety", "promises", "getting_around", "history_basics"]
    db.commit()
    r = client.patch("/api/v1/admin/buddies/38", json={"action": "approve"}, headers=operator)
    msg = r.json()["error"]["message"]
    assert r.status_code == 409 and r.json()["error"]["code"] == "NOT_READY"
    assert "성북구 주소 증빙" in msg and "교육 영상 4/5" in msg and "재학 증명" not in msg and "퀴즈" not in msg
    gaeun.enrollment_proof_url, gaeun.residence_proof_url = None, "residence_proof_gaeun.jpg"
    gaeun.education_watched = list(rules.EDUCATION_IDS)
    db.commit()
    msg = client.patch("/api/v1/admin/buddies/38", json={"action": "approve"}, headers=operator).json()["error"]["message"]
    assert "재학 증명" in msg and "주소" not in msg and "교육 영상" not in msg
    # 메일도 거주 서류도 없으면 자격 확인부터
    harin = db.get(BuddyProfile, 33)
    harin.school_email_verified_at, harin.eligibility = None, None
    db.commit()
    msg = client.patch("/api/v1/admin/buddies/33", json={"action": "approve"}, headers=operator).json()["error"]["message"]
    assert "자격 확인(성북구 대학 메일 또는 성북구 거주)" in msg and "퀴즈" in msg  # 하린 퀴즈 7점


def test_seeded_residence_buddy_pending(client, operator):
    rows = {x["id"]: x for x in client.get("/api/v1/admin/buddies", params={"status": "pending"}, headers=operator).json()["items"]}
    g = rows[38]
    assert (g["name"], g["eligibility"], g["university"], g["university_id"], g["quiz_score"]) == ("가은", "residence", "서울시립대학교", None, 9)
    assert (g["residence_proof_url"], g["enrollment_proof_url"]) == ("residence_proof_gaeun.jpg", "enrollment_gaeun.jpg")  # 화면은 자리 표시 타일
    assert rows[34]["eligibility"] == "school_email"
    s = client.get(f"{B}/apply", headers=login(client, "gaeun@example.com")).json()
    assert s["eligible"] and s["education_done"] and s["quiz_passed"] and s["status"] == "pending"
