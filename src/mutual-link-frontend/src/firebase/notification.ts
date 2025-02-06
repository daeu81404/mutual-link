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
  notifiedReferrals.clear();

  const referralsRef = ref(database, "referrals");

  // 초기 상태 로드 및 PENDING에서 변경된 항목 확인
  get(referralsRef).then(async (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      for (const [referralId, referral] of Object.entries<ReferralNotification>(
        data
      )) {
        // 수신자 또는 송신자인 경우 처리
        if (
          referral.toEmail === userEmail ||
          referral.fromEmail === userEmail
        ) {
          const status = referral.status;

          // 현재 상태만 저장하고 알림은 생성하지 않음
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
        // 수신자 또는 송신자인 경우 처리
        if (
          referral.toEmail === userEmail ||
          referral.fromEmail === userEmail
        ) {
          const prevStatus = previousStates.get(referralId);
          const currentStatus = referral.status;

          // 이전 상태가 있고, 상태가 변경된 경우에만 처리
          if (prevStatus && prevStatus !== currentStatus) {
            // 수신자이고 상태가 PENDING에서 APPROVED로 변경되었을 때
            if (
              referral.toEmail === userEmail &&
              prevStatus === "PENDING" &&
              currentStatus === "APPROVED"
            ) {
              await handleNotification(
                userEmail,
                referralId,
                referral,
                onUpdate
              );
            }
            // 송신자이고 상태가 PENDING에서 REJECTED로 변경되었을 때
            else if (
              referral.fromEmail === userEmail &&
              prevStatus === "PENDING" &&
              currentStatus === "REJECTED"
            ) {
              await handleNotification(
                userEmail,
                referralId,
                referral,
                onUpdate
              );
            }
          }

          // 상태 업데이트
          previousStates.set(referralId, currentStatus);
        }
      }
    },
    (error) => {
      throw error;
    }
  );

  return () => {
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
