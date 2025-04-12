import {
  elizaLogger,
  type ActionExample,
  type Content,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelClass,
  type State,
  composeContext,
  generateObject,
  type Action,
} from "@elizaos/core";
import { getRskConfig } from "../environment";
import { Web3 } from "web3";
import { SYBIL_DETECTION } from "../constants";
import NodeCache from "node-cache";

// 캐시 생성 (1시간 TTL)
const walletDataCache = new NodeCache({ stdTTL: 3600 });

// 분석 결과 인터페이스
export interface SybilAnalysisResult {
  isSybil: boolean;
  confidence: number; // 0-100
  reasons: string[];
  walletData: {
    address: string;
    balance: string;
    transactions: number;
    uniqueInteractions: number;
    walletAgeInDays: number | null;
  };
}

// 지갑 데이터 가져오기
async function getWalletData(address: string, rpcUrl: string) {
  // 캐시된 데이터 확인
  const cacheKey = `wallet_${address}`;
  const cachedData = walletDataCache.get(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  const web3 = new Web3(rpcUrl);
  
  try {
    // 지갑 잔액 확인
    const balanceWei = await web3.eth.getBalance(address);
    const balance = Web3.utils.fromWei(balanceWei, "ether");
    
    // 지갑 거래 내역 가져오기
    const latestBlockNumber = await web3.eth.getBlockNumber();
    
    let transactions = 0;
    let uniqueAddresses = new Set<string>();
    let firstTransactionBlock = null;
    
    // 실제 구현에서는 블록 탐색기 API 사용 권장
    const startBlock = Math.max(0, Number(latestBlockNumber) - 1000);
    
    for (let i = startBlock; i <= latestBlockNumber; i += 10) {
      try {
        const block = await web3.eth.getBlock(i, true);
        if (block && block.transactions) {
          for (const tx of block.transactions) {
            if (typeof tx === 'object') {
              if (tx.from && tx.from.toLowerCase() === address.toLowerCase()) {
                transactions++;
                if (tx.to) uniqueAddresses.add(tx.to.toLowerCase());
                if (!firstTransactionBlock || i < firstTransactionBlock) {
                  firstTransactionBlock = i;
                }
              }
              
              if (tx.to && tx.to.toLowerCase() === address.toLowerCase()) {
                transactions++;
                if (tx.from) uniqueAddresses.add(tx.from.toLowerCase());
                if (!firstTransactionBlock || i < firstTransactionBlock) {
                  firstTransactionBlock = i;
                }
              }
            }
          }
        }
      } catch (error) {
        elizaLogger.error(`Error fetching block ${i}:`, error);
      }
    }
    
    // 첫 트랜잭션 날짜 및 지갑 나이 계산
    let walletAgeInDays = null;
    
    if (firstTransactionBlock) {
      try {
        const block = await web3.eth.getBlock(firstTransactionBlock);
        if (block && block.timestamp) {
          const blockTimestamp = Number(block.timestamp) * 1000; // to milliseconds
          const now = Date.now();
          walletAgeInDays = Math.floor((now - blockTimestamp) / (1000 * 60 * 60 * 24));
        }
      } catch (error) {
        elizaLogger.error("Error getting first transaction date:", error);
      }
    }
    
    const walletData = {
      address,
      balance,
      transactions,
      uniqueInteractions: uniqueAddresses.size,
      walletAgeInDays,
    };
    
    // 데이터 캐싱
    walletDataCache.set(cacheKey, walletData);
    
    return walletData;
  } catch (error) {
    elizaLogger.error("Error fetching wallet info:", error);
    throw error;
  }
}

// LLM 분석 템플릿
const sybilAnalysisTemplate = `
당신은 블록체인 지갑 분석 전문가입니다. 다음 지갑 정보를 바탕으로 이 지갑이 시빌 공격에 사용되는 가짓 지갑(Sybil wallet)인지 분석해주세요.

지갑 정보:
{{walletInfo}}

시빌 공격 판단 기준:
1. 트랜잭션 수가 적음 (${SYBIL_DETECTION.MIN_TRANSACTIONS}개 미만)
2. 상호작용한 고유 주소 수가 적음 (${SYBIL_DETECTION.MIN_UNIQUE_ADDRESSES}개 미만)
3. 지갑 생성 기간이 짧음 (${SYBIL_DETECTION.MIN_WALLET_AGE_DAYS}일 미만)
4. 잔액이 매우 적음 (${SYBIL_DETECTION.MIN_BALANCE} RSK 미만)

이 정보를 바탕으로 해당 지갑이 시빌 공격에 이용되는 지갑인지 판단하고, 그 이유를 자세히 설명해주세요.
결과는 반드시 다음 JSON 형식으로 제공해주세요:

{
  "isSybil": true/false,
  "confidence": 0-100, // 확신도 (0-100 사이 숫자)
  "reasons": ["판단 이유 1", "판단 이유 2", ...]
}

참고: 분석 시 트랜잭션 패턴, 상호작용 유형, 지갑 나이, 잔액을 종합적으로 고려하세요.
`;

// 분석 결과 스키마
const analysisResultSchema = {
  type: "object",
  properties: {
    isSybil: { type: "boolean" },
    confidence: { type: "number", minimum: 0, maximum: 100 },
    reasons: { type: "array", items: { type: "string" } },
  },
  required: ["isSybil", "confidence", "reasons"],
};

// 분석 액션
const analyzeSybil: Action = {
  name: "ANALYZE_SYBIL",
  similes: ["CHECK_SYBIL", "SYBIL_DETECTION", "WALLET_ANALYSIS"],
  description: "지갑 주소를 분석하여 시빌 공격에 사용되는 가짓 지갑인지 확인합니다.",
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    elizaLogger.log("Validating ANALYZE_SYBIL action...");
    return true;
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<boolean> => {
    elizaLogger.log("ANALYZE_SYBIL handler called with message:", message.content.text);

    // 지갑 주소 추출 (0x로 시작하는 42자리 16진수)
    const addressMatch = message.content.text.match(/0x[a-fA-F0-9]{40}/);
    const walletAddress = addressMatch ? addressMatch[0] : null;

    if (!walletAddress) {
      if (callback) {
        callback({
          text: `지갑 주소를 찾을 수 없습니다. 0x로 시작하는 이더리움 주소를 입력해주세요.`,
          content: { },
        });
      }
      return true;
    }

    if (callback) {
      callback({
        text: `지갑 주소 '${walletAddress}'를 분석 중입니다. 이 기능은 현재 개발 중입니다.`,
        content: { walletAddress },
      });
    }
    
    return true;
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "0x1234567890abcdef1234567890abcdef12345678 이 지갑이 시빌인지 확인해줘",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "지갑을 분석하고 있습니다...",
          action: "ANALYZE_SYBIL",
        },
      },
    ]
  ] as ActionExample[][],
};

export default analyzeSybil; 