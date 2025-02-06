import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "../../../declarations/mutual-link-backend/mutual-link-backend.did.js";
import type { _SERVICE } from "../../../declarations/mutual-link-backend/mutual-link-backend.did";

export const createActor = async () => {
  try {
    const currentHost = window.location.hostname;
    const host = currentHost.includes("localhost")
      ? `http://${currentHost}:4943`
      : "http://127.0.0.1:4943";

    const agent = new HttpAgent({ host });

    if (host.includes("localhost") || host.includes("127.0.0.1")) {
      await agent.fetchRootKey();
    }

    const canisterId = import.meta.env.VITE_BACKEND_CANISTER_ID;

    const actor = Actor.createActor<_SERVICE>(idlFactory, {
      agent,
      canisterId,
    });

    return actor;
  } catch (error) {
    throw new Error("시스템에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
  }
};
