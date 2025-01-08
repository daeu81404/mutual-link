import { Approval } from "@/types/approval";

export const approvals: Approval[] = [
  {
    key: "1",
    no: 1,
    date: "25.01.08 13:30",
    requestId: "0100000000",
    patientName: "홍길동",
    content: "긴급 - 심장 이식",
    sender: {
      hospital: "서울대병원",
      department: "정신과",
      doctor: "김창남",
    },
    receiver: {
      hospital: "서울대병원",
      department: "소아응급실",
    },
    cid: "QmRcU2AeE...",
    status: "승인대기중",
  },
  {
    key: "2",
    no: 2,
    date: "24.12.08 10:30",
    requestId: "0100000002",
    patientName: "김철수",
    content: "응급 - 호흡 곤란",
    sender: {
      hospital: "연세대병원",
      department: "내과",
      doctor: "최철수",
    },
    receiver: {
      hospital: "백석대병원",
      department: "소아응급실",
    },
    cid: "AbeE2AeE...",
    status: "승인대기중",
  },
  // 필요한 만큼 더미 데이터 추가
];
