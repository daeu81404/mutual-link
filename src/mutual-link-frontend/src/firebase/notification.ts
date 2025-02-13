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
    throw error;
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
  } catch (error) {
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
    throw error;
  }
};

const initActor = async () => {
  try {
    const currentHost = window.location.hostname;
    const isIcMainnet =
      /[a-z0-9-]+\.icp0\.io/.test(currentHost) ||
      /[a-z0-9-]+\.ic0\.app/.test(currentHost);

    const host = isIcMainnet ? "https://icp0.io" : "http://127.0.0.1:4943";

    const agent = new HttpAgent({ host });

    if (!isIcMainnet) {
      await agent.fetchRootKey();
    }

    const canisterId =
      import.meta.env.CANISTER_ID_MUTUAL_LINK_BACKEND ||
      (window as any).__CANISTER_ID_MUTUAL_LINK_BACKEND__;

    console.log("=== Notification Actor 초기화 ===");
    console.log("현재 호스트:", currentHost);
    console.log("IC 메인넷?:", isIcMainnet);
    console.log("설정된 호스트:", host);
    console.log("Canister ID:", canisterId);

    return Actor.createActor(idlFactory, {
      agent,
      canisterId,
    });
  } catch (error) {
    console.error("Actor 초기화 중 에러:", error);
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
  } catch (error) {
    throw error;
  }
};

// 알림 처리 함수
const handleNotification = async (
  userEmail: string,
  referralId: string,
  referral: ReferralNotification,
  onUpdate: (data: any) => void
) => {
  // 이미 알림을 보낸 경우 중복 처리 방지
  const notificationKey = `${referralId}-${referral.status}`;

  if (notifiedReferrals.has(notificationKey)) {
    return;
  }

  // notification_history에 없는 경우에만 알림 생성
  const alreadyChecked = await checkNotificationHistory(userEmail, referralId);

  if (!alreadyChecked) {
    notifiedReferrals.add(notificationKey);

    // 의료기록 상태 자동 업데이트 및 알림 생성
    if (referral.status === "APPROVED" || referral.status === "REJECTED") {
      await updateMedicalRecordStatus(referralId, referral.status);
      // saveNotificationHistory는 여기서 호출하지 않음
      onUpdate(referral);
    }
  }
};

export const subscribeToReferralUpdates = (
  userEmail: string,
  onUpdate: (data: any) => void
) => {
  console.log("=== 알림 구독 시작 ===");
  console.log("사용자 이메일:", userEmail);

  notifiedReferrals.clear();
  previousStates.clear(); // 명시적으로 이전 상태 초기화

  const referralsRef = ref(database, "referrals");
  let isInitialized = false; // 초기화 상태 추적

  // 초기 상태 로드
  const loadInitialState = async () => {
    try {
      console.log("초기 상태 로드 시작");
      const snapshot = await get(referralsRef);

      if (snapshot.exists()) {
        const data = snapshot.val();
        for (const [
          referralId,
          referral,
        ] of Object.entries<ReferralNotification>(data)) {
          if (
            referral.toEmail === userEmail ||
            referral.fromEmail === userEmail
          ) {
            console.log(
              `초기 상태 설정 - ID: ${referralId}, 상태: ${referral.status}`
            );
            previousStates.set(referralId, referral.status);
          }
        }
      }

      isInitialized = true;
      console.log("초기 상태 로드 완료");
    } catch (error) {
      console.error("초기 상태 로드 실패:", error);
      throw error;
    }
  };

  // 실시간 업데이트 구독
  const unsubscribe = onValue(
    referralsRef,
    async (snapshot) => {
      if (!isInitialized) {
        console.log("초기화 대기 중...");
        await loadInitialState();
        return;
      }

      if (!snapshot.exists()) return;

      const data = snapshot.val();
      for (const [referralId, referral] of Object.entries<ReferralNotification>(
        data
      )) {
        if (
          referral.toEmail === userEmail ||
          referral.fromEmail === userEmail
        ) {
          const prevStatus = previousStates.get(referralId);
          const currentStatus = referral.status;

          console.log(`
=== 상태 변경 감지 ===
Referral ID: ${referralId}
이전 상태: ${prevStatus}
현재 상태: ${currentStatus}
현재 사용자: ${userEmail}
송신자: ${referral.fromEmail}
수신자: ${referral.toEmail}
`);

          // 상태 변경 처리
          if (prevStatus && prevStatus !== currentStatus) {
            // 수신자의 승인 처리
            if (
              referral.toEmail === userEmail &&
              prevStatus === "PENDING" &&
              currentStatus === "APPROVED"
            ) {
              console.log("수신자의 승인 처리 시작");
              await handleNotification(
                userEmail,
                referralId,
                referral,
                onUpdate
              );
              console.log("수신자의 승인 처리 완료");
            }
            // 송신자의 상태 변경 처리
            else if (
              referral.fromEmail === userEmail &&
              prevStatus === "PENDING" &&
              (currentStatus === "APPROVED" || currentStatus === "REJECTED")
            ) {
              console.log(`송신자의 ${currentStatus} 상태 변경 처리 시작`);
              await handleNotification(
                userEmail,
                referralId,
                referral,
                onUpdate
              );
              console.log(`송신자의 ${currentStatus} 상태 변경 처리 완료`);
            }
          }

          // 상태 업데이트
          previousStates.set(referralId, currentStatus);
        }
      }
    },
    (error) => {
      console.error("Firebase 실시간 업데이트 에러:", error);
      throw error;
    }
  );

  // 클린업 함수
  return () => {
    console.log("=== 알림 구독 정리 ===");
    previousStates.clear();
    notifiedReferrals.clear();
    unsubscribe();
  };
};

// 알림 이력 조회 함수 추가
export const getUnreadNotifications = async (
  userEmail: string,
  referralsRef = ref(database, "referrals")
): Promise<ReferralNotification[]> => {
  try {
    // 모든 referral 데이터 가져오기
    const referralsSnapshot = await get(referralsRef);
    if (!referralsSnapshot.exists()) return [];

    const referrals = referralsSnapshot.val();
    const unreadNotifications: ReferralNotification[] = [];

    // notification_history 조회
    const historyRef = ref(
      database,
      `notification_history/${userEmail.replace(/\./g, "_")}`
    );
    const historySnapshot = await get(historyRef);
    const readHistory = historySnapshot.exists() ? historySnapshot.val() : {};

    // 각 referral에 대해 처리
    for (const [referralId, referral] of Object.entries<ReferralNotification>(
      referrals
    )) {
      // 이미 읽은 알림은 제외
      if (readHistory[referralId]) continue;

      // 수신자이고 APPROVED 상태인 경우
      if (referral.toEmail === userEmail && referral.status === "APPROVED") {
        unreadNotifications.push({ ...referral, referralId });
      }
      // 송신자이고 REJECTED 상태인 경우
      else if (
        referral.fromEmail === userEmail &&
        referral.status === "REJECTED"
      ) {
        unreadNotifications.push({ ...referral, referralId });
      }
    }

    return unreadNotifications;
  } catch (error) {
    throw error;
  }
};
