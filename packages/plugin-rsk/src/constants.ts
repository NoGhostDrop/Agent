export const DEFAULT_RPC_URL = "https://public-node.testnet.rsk.co";

// 시빌 공격 탐지를 위한 임계값 설정
export const SYBIL_DETECTION = {
  // 최소 트랜잭션 수
  MIN_TRANSACTIONS: 5,
  // 최소 고유 주소 수 (상호작용한 다른 지갑 주소)
  MIN_UNIQUE_ADDRESSES: 3,
  // 지갑 최소 나이 (일)
  MIN_WALLET_AGE_DAYS: 7,
  // 최소 잔액 (RSK 단위)
  MIN_BALANCE: 0.01
}; 