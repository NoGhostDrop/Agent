import type { Plugin } from "@elizaos/core";
import { walletProvider } from "./providers/wallet";
import analyzeSybil from "./actions/analyzeSybil";

// 직접 액션을 export합니다 (Solana 플러그인과 유사한 패턴)
export { walletProvider };

// 플러그인 정의
export const rskPlugin: Plugin = {
  name: "rsk",
  description: "RSK 블록체인 지갑 분석을 위한 ElizaOS 플러그인",
  actions: [analyzeSybil],  // analyzeSybil 액션을 직접 배열에 추가
  providers: [walletProvider],
  evaluators: [],
};

// default export 사용 (ElizaOS에서 플러그인을 로드하는 표준 방식)
export default rskPlugin; 