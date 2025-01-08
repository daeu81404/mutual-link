export interface Approval {
  key: string;
  no: number;
  date: string;
  requestId: string;
  patientName: string;
  content: string;
  sender: {
    hospital: string;
    department: string;
    doctor: string;
  };
  receiver: {
    hospital: string;
    department: string;
  };
  cid: string;
  status: string;
}
