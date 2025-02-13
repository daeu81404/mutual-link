import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "../../../declarations/mutual-link-backend/mutual-link-backend.did.js";
import type { _SERVICE } from "../../../declarations/mutual-link-backend/mutual-link-backend.did";

interface ErrorWithDetails extends Error {
  stack?: string;
  name: string;
}

export const createActor = async () => {
  try {
    console.log("=== Actor 생성 시작 ===");
    console.log("현재 시간:", new Date().toISOString());

    // 환경 변수 접근 시도 (여러 방법)
    console.log("=== 환경 변수 접근 시도 ===");
    const envVars = {
      BASE_URL: import.meta.env.BASE_URL,
      MODE: import.meta.env.MODE,
      DEV: import.meta.env.DEV,
      PROD: import.meta.env.PROD,
      SSR: import.meta.env.SSR,
      DFX_NETWORK: import.meta.env.DFX_NETWORK,
      CANISTER_ID_MUTUAL_LINK_BACKEND: import.meta.env
        .CANISTER_ID_MUTUAL_LINK_BACKEND,
    };

    console.log("환경 변수:", envVars);
    console.log("window.__DFX_NETWORK__:", (window as any).__DFX_NETWORK__);
    console.log(
      "window.__CANISTER_ID_MUTUAL_LINK_BACKEND__:",
      (window as any).__CANISTER_ID_MUTUAL_LINK_BACKEND__
    );

    const currentHost = window.location.hostname;
    const currentProtocol = window.location.protocol;
    const currentPort = window.location.port;
    const currentPathname = window.location.pathname;
    const currentSearch = window.location.search;
    const currentHash = window.location.hash;

    // IC 메인넷 도메인 체크 (canister ID를 포함한 도메인)
    const isIcMainnet =
      /[a-z0-9-]+\.icp0\.io/.test(currentHost) ||
      /[a-z0-9-]+\.ic0\.app/.test(currentHost);

    // 네트워크 설정
    const network = isIcMainnet ? "ic" : envVars.DFX_NETWORK || "local";
    const isLocal = network === "local";

    console.log("=== 도메인 체크 정보 ===");
    console.log(
      "도메인 정규식 테스트 (icp0.io):",
      /[a-z0-9-]+\.icp0\.io/.test(currentHost)
    );
    console.log(
      "도메인 정규식 테스트 (ic0.app):",
      /[a-z0-9-]+\.ic0\.app/.test(currentHost)
    );
    console.log("전체 도메인:", currentHost);
    console.log("도메인 파트:", currentHost.split("."));

    console.log("=== 환경 정보 ===");
    console.log("현재 네트워크:", network);
    console.log("로컬 환경?:", isLocal);
    console.log("IC 메인넷?:", isIcMainnet);
    console.log("현재 호스트:", currentHost);
    console.log("현재 프로토콜:", currentProtocol);
    console.log("현재 포트:", currentPort || "(없음)");
    console.log("현재 경로:", currentPathname);
    console.log("현재 쿼리스트링:", currentSearch);
    console.log("현재 해시:", currentHash);
    console.log("전체 URL:", window.location.href);

    // 프론트엔드 canister를 통해 접근하는지 확인
    const isFrontendCanister =
      isIcMainnet ||
      currentHost.includes(".localhost") ||
      currentHost.includes("127.0.0.1");

    console.log("=== Canister 접근 정보 ===");
    console.log("프론트엔드 canister 접근?:", isFrontendCanister);
    console.log(
      "Canister ID 쿼리 파라미터 존재?:",
      currentSearch.includes("canisterId")
    );
    console.log(
      "URL에서 canister ID 추출:",
      new URLSearchParams(currentSearch).get("canisterId")
    );

    let host;
    if (isIcMainnet) {
      host = "https://icp0.io";
      console.log("IC 메인넷 호스트 설정:", host);
    } else {
      host = "http://127.0.0.1:4943";
      console.log("로컬 개발 서버 호스트 설정:", host);
    }

    console.log("=== Agent 설정 정보 ===");
    console.log("설정된 호스트:", host);
    console.log("현재 location:", window.location.toString());
    console.log("Agent 설정 옵션:", { host });

    console.log("Agent 생성 시작");
    try {
      const agent = new HttpAgent({ host });
      console.log("Agent 생성 완료");

      // 로컬 환경에서만 root key를 가져옴
      if (isLocal && !isIcMainnet) {
        console.log("=== Root Key 가져오기 ===");
        console.log("로컬 환경 - root key 가져오기 시도");
        try {
          await agent.fetchRootKey();
          console.log("root key 가져오기 성공");
        } catch (error) {
          const err = error as ErrorWithDetails;
          console.error("root key 가져오기 실패:", err);
          console.error("에러 상세 정보:", {
            name: err.name,
            message: err.message,
            stack: err.stack,
          });
          throw err;
        }
      }

      const canisterId =
        import.meta.env.CANISTER_ID_MUTUAL_LINK_BACKEND ||
        (window as any).__CANISTER_ID_MUTUAL_LINK_BACKEND__;

      console.log("=== Canister 정보 ===");
      console.log("최종 선택된 network:", network);
      console.log("최종 선택된 Canister ID:", canisterId);
      console.log("IDL Factory 존재 여부:", !!idlFactory);

      console.log("Actor 생성 시작");
      try {
        const actor = Actor.createActor<_SERVICE>(idlFactory, {
          agent,
          canisterId,
        });
        console.log("Actor 생성 성공");

        // 백엔드 연결 테스트
        try {
          console.log("=== 백엔드 연결 테스트 ===");
          console.log("백엔드 연결 테스트 시작");
          // 테스트용 이메일로 의사 정보 조회
          const testResult = await actor.getDoctorByEmail("test@example.com");
          console.log("백엔드 응답:", testResult);
          console.log("백엔드 연결 테스트 성공");
        } catch (error) {
          const err = error as ErrorWithDetails;
          console.error("백엔드 연결 테스트 실패:", err);
          console.error("에러 상세 정보:", {
            name: err.name,
            message: err.message,
            stack: err.stack,
          });
          throw err;
        }

        console.log("=== Actor 생성 완료 ===");
        return actor;
      } catch (error) {
        const err = error as ErrorWithDetails;
        console.error("Actor 생성 실패:", err);
        console.error("에러 상세 정보:", {
          name: err.name,
          message: err.message,
          stack: err.stack,
        });
        throw err;
      }
    } catch (error) {
      const err = error as ErrorWithDetails;
      console.error("Agent 생성 실패:", err);
      console.error("에러 상세 정보:", {
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
      throw err;
    }
  } catch (error) {
    const err = error as ErrorWithDetails;
    console.error("=== Actor 생성 중 에러 발생 ===");
    console.error("에러 타입:", err.constructor.name);
    console.error("에러 메시지:", err.message);
    console.error("에러 스택:", err.stack);
    console.error("전체 에러 객체:", err);
    throw new Error("시스템에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
  }
};
