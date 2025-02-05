import {
  ref,
  onValue,
  query,
  orderByChild,
  equalTo,
  update,
  get,
  set,
} from "firebase/database";
import { database } from "./config";
import { getAuth } from "firebase/auth";
import { ReferralStatus } from "./referral";
import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "../../../declarations/mutual-link-backend/mutual-link-backend.did.js";

interface ReferralNotification {
  referralId: string;
  status: ReferralStatus;
  doctorName: string;
  hospitalName: string;
  department: string;
  patientName: string;
  patientPhone: string;
  createdAt: string;
  updatedAt: string;
  fromEmail: string;
  toEmail: string;
}

// 이전 상태를 저장하기 위한 Map
const previousStates = new Map<string, ReferralStatus>();
// 알림 발생 여부를 추적하기 위한 Set
const notifiedReferrals = new Set<string>();

// 진료의뢰 상태 변경 함수
export const updateReferralStatus = async (
  referralId: string,
  status: ReferralStatus
) => {
  try {
    const referralRef = ref(database, `referrals/${referralId}`);
    await update(referralRef, {
      status,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error updating referral status:", error);
    return { success: false, error };
  }
};

// 알림 데이터 유효성 검사
const isValidNotification = (data: any): data is ReferralNotification => {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof data.referralId === "string" &&
    typeof data.status === "string" &&
    typeof data.doctorName === "string" &&
    typeof data.hospitalName === "string" &&
    typeof data.department === "string" &&
    typeof data.patientName === "string" &&
    typeof data.patientPhone === "string" &&
    typeof data.createdAt === "string" &&
    typeof data.updatedAt === "string" &&
    typeof data.fromEmail === "string" &&
    typeof data.toEmail === "string"
  );
};

// 알림 이력 저장 함수
export const saveNotificationHistory = async (
  userEmail: string,
  referralId: string
) => {
  try {
    const historyRef = ref(
      database,
      `notification_history/${userEmail.replace(/\./g, "_")}/${referralId}`
    );
    await set(historyRef, {
      notifiedAt: new Date().toISOString(),
    });
    console.log("[DEBUG] 알림 이력 저장 성공:", referralId);
  } catch (error) {
    console.error("[DEBUG] 알림 이력 저장 실패:", error);
    throw error;
  }
};

// 알림 이력 확인 함수
const checkNotificationHistory = async (
  userEmail: string,
  referralId: string
): Promise<boolean> => {
  try {
    const historyRef = ref(
      database,
      `notification_history/${userEmail.replace(/\./g, "_")}/${referralId}`
    );
    const snapshot = await get(historyRef);
    return snapshot.exists();
  } catch (error) {
    console.error("[DEBUG] 알림 이력 확인 실패:", error);
    return false;
  }
};

const initActor = async () => {
  try {
    const currentHost = window.location.hostname;
    const host = currentHost.includes("localhost")
      ? `http://${currentHost}:4943`
      : "http://127.0.0.1:4943";

    const agent = new HttpAgent({ host });

    if (host.includes("localhost") || host.includes("127.0.0.1")) {
      await agent.fetchRootKey();
    }

    const canisterId = "bkyz2-fmaaa-aaaaa-qaaaq-cai";

    return Actor.createActor(idlFactory, {
      agent,
      canisterId,
    });
  } catch (error) {
    console.error("Actor 초기화 실패:", error);
    throw error;
  }
};

// 의료기록 상태 업데이트 함수
const updateMedicalRecordStatus = async (
  referralId: string,
  status: string
) => {
  try {
    const actor = await initActor();
    await actor.updateMedicalRecordStatus(Number(referralId), status);
    console.log("[DEBUG] 의료기록 상태 업데이트 완료:", referralId);
  } catch (error) {
    console.error("[DEBUG] 의료기록 상태 업데이트 실패:", error);
  }
};

// 알림 처리 함수
const handleNotification = async (
  userEmail: string,
  referralId: string,
  referral: ReferralNotification,
  onUpdate: (data: any) => void
) => {
  // notification_history에 없는 경우에만 알림 생성
  const alreadyChecked = await checkNotificationHistory(userEmail, referralId);
  if (!alreadyChecked) {
    console.log("[DEBUG] 상태 변경 감지:", referralId, referral.status);
    onUpdate(referral);

    // 의료기록 상태 자동 업데이트
    if (referral.status === "APPROVED") {
      await updateMedicalRecordStatus(referralId, "APPROVED");
    }
  }
};

export const subscribeToReferralUpdates = (
  userEmail: string,
  onUpdate: (data: any) => void
) => {
  console.log("[DEBUG] 알림 구독 시작 ====");
  console.log("[DEBUG] 구독 이메일:", userEmail);

  const referralsRef = ref(database, "referrals");

  // 초기 상태 로드 및 PENDING에서 변경된 항목 확인
  get(referralsRef).then(async (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      for (const [referralId, referral] of Object.entries<ReferralNotification>(
        data
      )) {
        if (referral.toEmail === userEmail) {
          const status = referral.status;
          console.log("[DEBUG] 초기 데이터 확인:", {
            referralId,
            status,
            createdAt: referral.createdAt,
            updatedAt: referral.updatedAt,
          });

          // status가 APPROVED인 경우 알림 생성 및 의료기록 상태 업데이트
          if (status === "APPROVED") {
            await handleNotification(userEmail, referralId, referral, onUpdate);
          }

          // 현재 상태 저장
          previousStates.set(referralId, status);
        }
      }
    }
  });

  // 실시간 업데이트 구독
  const unsubscribe = onValue(
    referralsRef,
    async (snapshot) => {
      if (!snapshot.exists()) return;

      const data = snapshot.val();
      for (const [referralId, referral] of Object.entries<ReferralNotification>(
        data
      )) {
        if (referral.toEmail === userEmail) {
          const prevStatus = previousStates.get(referralId);
          const currentStatus = referral.status;

          console.log("[DEBUG] 실시간 상태 변경 감지:", {
            referralId,
            prevStatus,
            currentStatus,
            createdAt: referral.createdAt,
            updatedAt: referral.updatedAt,
          });

          // 상태가 PENDING에서 APPROVED로 변경되었을 때
          if (prevStatus === "PENDING" && currentStatus === "APPROVED") {
            await handleNotification(userEmail, referralId, referral, onUpdate);
          }

          // 상태 업데이트
          previousStates.set(referralId, currentStatus);
        }
      }
    },
    (error) => {
      console.error("[DEBUG] 구독 에러:", error);
    }
  );

  return () => {
    console.log("[DEBUG] 알림 구독 종료 ====");
    previousStates.clear();
    unsubscribe();
  };
};
