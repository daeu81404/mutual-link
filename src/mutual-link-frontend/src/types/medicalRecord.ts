export interface MedicalRecord {
  key: string;
  no: number;
  date: string;
  phone: string;
  patientName: string;
  title: string;
  sender: {
    hospital: string;
    department: string;
    doctor: string;
  };
  receiver: {
    hospital: string;
    department: string;
    doctor: string;
  };
  cid: string;
  status: string;
}
