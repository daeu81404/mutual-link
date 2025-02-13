import { ref, set } from "firebase/database";
import { database } from "./config";

export type ReferralStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "TRANSFERRED"
  | "EXPIRED";

interface ReferralMetadata {
  referralId: string;
  fromEmail: string; // 송신자 이메일
  toEmail: string; // 수신자 이메일
  doctorName: string;
  hospitalName: string;
  department: string;
  patientName: string;
  patientPhone: string;
  status: ReferralStatus;
  createdAt: string;
  updatedAt: string;
}

export const saveReferralMetadata = async (metadata: ReferralMetadata) => {
  try {
    const referralRef = ref(database, `referrals/${metadata.referralId}`);
    await set(referralRef, {
      ...metadata,
      status: "PENDING" as ReferralStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    console.error("Error saving referral metadata:", error);
    return { success: false, error };
  }
};
