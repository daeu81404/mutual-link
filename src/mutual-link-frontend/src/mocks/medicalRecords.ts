import { MedicalRecord } from "@/types/medicalRecord";

export const medicalRecords: MedicalRecord[] = [
  {
    key: "1",
    no: 1,
    date: "24.12.09 10:45",
    phone: "010-2620-1964",
    patientName: "홍길동",
    title: "테스트",
    sender: {
      hospital: "서울대병원",
      department: "정형외과",
      doctor: "김창남",
    },
    receiver: {
      hospital: "서울대병원",
      department: "이강희",
      doctor: "정신과",
    },
    cid: "QmXoTMCDgP...",
    status: "전송완료",
  },
  {
    key: "2",
    no: 2,
    date: "24.12.09 10:44",
    phone: "010-2620-1964",
    patientName: "홍길동",
    title: "테스트",
    sender: {
      hospital: "연대세브란스병원",
      department: "소아응급실",
      doctor: "테이먼",
    },
    receiver: {
      hospital: "서울대병원",
      department: "정신과",
      doctor: "김창남",
    },
    cid: "QmXoTMCDgP...",
    status: "전송완료",
  },
  {
    key: "3",
    no: 3,
    date: "24.12.08 15:30",
    phone: "010-1234-5678",
    patientName: "김철수",
    title: "MRI 검사 결과",
    sender: {
      hospital: "서울대병원",
      department: "영상의학과",
      doctor: "박영희",
    },
    receiver: {
      hospital: "연대세브란스병원",
      department: "신경과",
      doctor: "이민수",
    },
    cid: "QmAbCdEfG...",
    status: "전송완료",
  },
];
