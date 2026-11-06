// 개인정보처리방침 (공개 페이지 · Google OAuth 동의 화면에 등록)
import type { Metadata } from "next";
import { CONTACT_EMAIL, LegalDoc, Sec } from "@/components/legal/doc";

export const metadata: Metadata = { title: "개인정보처리방침 · 성북스테이", description: "성북스테이 개인정보처리방침 (Privacy Policy)" };

export default function PrivacyPage() {
  return (
    <LegalDoc title="개인정보처리방침" titleEn="Privacy Policy">
      <p>성북스테이(이하 &quot;서비스&quot;)는 방학 중 성북구 대학 기숙사 숙박과 대학생 버디 동행, 역사 산책 코스를 연결하는 서비스입니다. 서비스는 이용자의 개인정보를 필요한 만큼만 수집하고, 아래 목적 외로는 쓰지 않습니다.</p>

      <Sec n={1} title="수집하는 정보">
        <ul className="list-disc space-y-1 pl-5">
          <li><b>계정</b>: 이름, 이메일, 비밀번호(암호화 저장), 선호 언어. 구글 로그인을 쓰면 구글이 제공하는 이름·이메일·프로필 식별자만 받습니다.</li>
          <li><b>예약</b>: 여행자 이름, 국적, 이메일, 비상연락처, 인원, 요청 사항. 숙박이 포함된 예약에 한해 여권번호를 예약 시점에만 받습니다.</li>
          <li><b>결제</b>: 결제는 토스페이먼츠·PayPal이 처리하며, 서비스는 카드번호를 받거나 저장하지 않습니다. 결제 금액, 결제 수단 종류, 결제사 거래번호, 영수증 링크만 저장합니다.</li>
          <li><b>버디·지원자</b>: 학교 메일, 전공·학년, 언어, 관심사, 소개, 프로필 사진, 자격 확인 서류(재학·거주 증명).</li>
          <li><b>구글 캘린더(버디만, 선택)</b>: 버디가 직접 연동한 경우에만 확정된 동행 일정을 그 버디의 캘린더에 추가·삭제합니다. 캘린더의 다른 일정은 읽지 않습니다.</li>
        </ul>
      </Sec>

      <Sec n={2} title="이용 목적">
        <p>회원 식별과 로그인, 숙박·동행 예약과 승인, 결제와 환불, 체크인 안내, 알림, 버디 자격 확인과 정산, 부정 이용 방지에만 씁니다. 광고 목적으로 제3자에게 판매하지 않습니다.</p>
      </Sec>

      <Sec n={3} title="제3자 제공">
        <ul className="list-disc space-y-1 pl-5">
          <li>숙박 승인을 위해 해당 대학 담당자에게 여행자 이름·국적·여권번호·숙박 일정을 제공합니다.</li>
          <li>동행 진행을 위해 수락한 버디에게 여행자 이름과 동행 일정을 제공합니다. 연락처는 노출하지 않고 서비스 안에서만 대화합니다.</li>
          <li>결제 처리를 위해 토스페이먼츠, PayPal에 결제에 필요한 정보가 전달됩니다.</li>
        </ul>
      </Sec>

      <Sec n={4} title="보관 기간">
        <p>회원 정보는 탈퇴 시까지 보관합니다. 여권번호는 숙박 승인과 체크인에만 쓰며, 정식 운영 시에는 숙박 종료 후 30일 안에 지웁니다(현재 시제품 단계에서는 요청 시 즉시 삭제). 결제·환불 기록은 관련 법령(전자상거래법)에 따라 5년간 보관합니다.</p>
      </Sec>

      <Sec n={5} title="이용자의 권리">
        <p>이용자는 언제든 자신의 정보 열람, 정정, 삭제, 처리 정지와 탈퇴를 요청할 수 있습니다. 구글 계정 연결은 구글 계정 설정의 &quot;타사 액세스&quot;에서 직접 해제할 수 있습니다.</p>
      </Sec>

      <Sec n={6} title="안전 조치">
        <p>비밀번호는 단방향 암호화로 저장하고, 구글 캘린더 연동 토큰은 암호화해 저장합니다. 모든 통신은 HTTPS로 암호화합니다.</p>
      </Sec>

      <Sec n={7} title="문의">
        <p>개인정보 관련 문의: <a className="font-semibold text-navy underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
      </Sec>

      <hr className="border-line" />
      <section className="space-y-2 text-[13px] text-muted">
        <h2 className="text-[14px] font-bold text-ink">Summary in English</h2>
        <p>Seongbuk Stay collects only what is needed to run bookings: account name and email (from Google Sign-In if used), traveler details, and a passport number only for dorm stays at booking time. Payments are processed by Toss Payments and PayPal; we never store card numbers. Buddies may optionally connect Google Calendar so confirmed walks are added to their own calendar; we do not read other events. Data is shared only with the hosting university, the matched buddy, and the payment processor. Contact: {CONTACT_EMAIL}.</p>
      </section>
    </LegalDoc>
  );
}
