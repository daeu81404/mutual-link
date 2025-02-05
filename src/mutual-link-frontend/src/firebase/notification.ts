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
const saveNotificationHistory = async (
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
  } catch (error) {
    console.error("[DEBUG] 알림 이력 저장 실패:", error);
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

          // 이미 알림을 보냈는지 확인
          const alreadyNotified = await checkNotificationHistory(
            userEmail,
            referralId
          );

          // status가 PENDING이 아니고, createdAt과 updatedAt이 다르고, 아직 알림을 보내지 않은 경우
          if (
            status !== "PENDING" &&
            referral.createdAt !== referral.updatedAt &&
            !alreadyNotified
          ) {
            console.log("[DEBUG] 상태 변경 감지 (신규):", referralId, status);
            onUpdate(referral);
            await saveNotificationHistory(userEmail, referralId);
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

          // 이전 상태가 PENDING이고 현재 상태가 변경되었을 때
          if (prevStatus === "PENDING" && currentStatus !== "PENDING") {
            // 이미 알림을 보냈는지 확인
            const alreadyNotified = await checkNotificationHistory(
              userEmail,
              referralId
            );

            if (!alreadyNotified) {
              console.log(
                "[DEBUG] 알림 발생 (실시간):",
                referralId,
                currentStatus
              );
              onUpdate(referral);
              await saveNotificationHistory(userEmail, referralId);
            } else {
              console.log("[DEBUG] 이미 알림이 발송된 referral:", referralId);
            }
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
