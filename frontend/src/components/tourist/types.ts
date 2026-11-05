// 목 핸들러 응답 중 src/lib/types.ts 에 정의가 없는 목업 응답 형태 (BK-07 체크인 안내, BK-09 채팅)
export interface CheckinGuide {
  building: string; address: string; checkin: string; checkout: string; wifi: string; steps: string[]; emergency: string[];
}
export interface ChatMessage {
  id: number; sender: "buddy" | "tourist"; text: string; translated_text: string; created_at: string;
}
