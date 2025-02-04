import { ref, set } from "firebase/database";
import { database } from "./config";

interface ReferralMetadata {
  referralId: string;
  doctorName: string;
  hospitalName: string;
  department: string;
  patientName: string;
  patientPhone: string;
}

export const saveReferralMetadata = async (metadata: ReferralMetadata) => {
  try {
    const referralRef = ref(database, `referrals/${metadata.referralId}`);
    await set(referralRef, {
      ...metadata,
      status: "PENDING",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    console.error("Error saving referral metadata:", error);
    return { success: false, error };
  }
};
