// 이용약관 (공개 페이지 · Google OAuth 동의 화면에 등록)
import type { Metadata } from "next";
import { CONTACT_EMAIL, LegalDoc, Sec } from "@/components/legal/doc";

export const metadata: Metadata = { title: "이용약관 · 성북스테이", description: "성북스테이 이용약관 (Terms of Service)" };

export default function TermsPage() {
  return (
    <LegalDoc title="이용약관" titleEn="Terms of Service">
      <p>이 약관은 성북스테이(이하 &quot;서비스&quot;) 이용에 관한 기본 사항을 정합니다. 서비스는 해커톤 시제품으로 운영되며, 결제는 테스트 환경에서 이뤄집니다.</p>

      <Sec n={1} title="서비스 내용">
        <p>방학 중 개방하는 성북구 대학 기숙사 숙박 예약, 대학생 버디와의 문화교류 동행 예약, 무료 AI 역사 산책 코스를 제공합니다. 숙박은 해당 대학의 승인, 동행은 버디의 수락 후 확정됩니다.</p>
      </Sec>
      <Sec n={2} title="버디의 역할">
        <p>버디는 전문 가이드가 아니라 동네를 함께 걷는 대학생입니다. 버디는 유상 운송이나 가이드 해설을 하지 않습니다.</p>
      </Sec>
      <Sec n={3} title="결제와 환불">
        <p>결제는 토스페이먼츠 또는 PayPal로 합니다. 취소 시 첫 일정 7일 전까지 100%, 3일 전까지 50%, 그 이후에는 환불되지 않습니다. 대학 또는 버디가 거절한 항목은 전액 환불합니다.</p>
      </Sec>
      <Sec n={4} title="이용자의 의무">
        <p>예약 정보는 사실대로 입력해야 하며, 기숙사 이용 규칙과 현지 법령을 지켜야 합니다. 다른 이용자에게 피해를 주는 행위는 이용이 제한될 수 있습니다.</p>
      </Sec>
      <Sec n={5} title="책임의 한계">
        <p>서비스는 숙박 제공자(대학)와 버디를 연결하는 플랫폼이며, 각 제공자가 자신의 서비스에 책임을 집니다. 천재지변 등 불가항력으로 인한 장애에는 책임지지 않습니다.</p>
      </Sec>
      <Sec n={6} title="개인정보">
        <p>개인정보 처리는 <a className="font-semibold text-navy underline" href="/privacy">개인정보처리방침</a>을 따릅니다.</p>
      </Sec>
      <Sec n={7} title="문의">
        <p><a className="font-semibold text-navy underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
      </Sec>
    </LegalDoc>
  );
}
