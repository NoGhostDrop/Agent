# ElizaOS Wallet Analyzer 플러그인

ElizaOS 에이전트에서 RSK 블록체인을 활용한 지갑 분석 기능을 제공하는 플러그인입니다. 이 플러그인은 지갑 분석 및 시빌 감지 기능을 제공합니다.

## 기능

- 지갑 주소 온체인 데이터 수집
- LLM을 활용한 시빌 계정 분석
- 블록체인 트랜잭션 및 상호작용 분석

## 설치

1. 플러그인을 ElizaOS packages 디렉토리에 복사합니다:
```bash
cd Agent/packages
# 플러그인이 이미 있는지 확인
ls plugin-rsk
```

2. 플러그인을 빌드합니다:
```bash
cd plugin-rsk
pnpm build
```

## 사용 방법

### 1. Character 파일에 플러그인 추가

이 플러그인은 기본 캐릭터 파일(`defaultCharacter.ts`)에 이미 포함되어 있으며, 다음과 같이 설정되어 있습니다:

```typescript
export const defaultCharacter: Character = {
    name: "Eliza",
    // @ts-ignore - 런타임에 문자열에서 플러그인으로 변환됩니다
    plugins: ["@elizaos/plugin-wallet-analyzer"],
    modelProvider: ModelProviderName.OPENAI,
    settings: {
        // @ts-ignore - 커스텀 플러그인 설정
        "wallet-analyzer": {
            "RPC_URL": "https://public-node.testnet.rsk.co"
        }
    },
    // ... 다른 설정들 ...
};
```

### 2. 분석 액션 사용하기

RSK 지갑을 분석하려면 다음과 같은 메시지를 보내세요:

```
0x1234567890abcdef1234567890abcdef12345678 이 지갑이 시빌인지 확인해줘
```

또는 데이터를 포함한 요청:

```json
{
  "text": "이 지갑이 시빌인지 분석해줘",
  "walletAddress": "0x1234567890abcdef1234567890abcdef12345678"
}
```

### 3. 응답 형식

액션은 다음과 같은 JSON 형식으로 응답합니다:

```json
{
  "isSybil": true,
  "confidence": 85,
  "reasons": ["트랜잭션 수가 적음", "지갑 나이가 너무 짧음"],
  "walletData": {
    "address": "0x1234567890abcdef1234567890abcdef12345678",
    "balance": "0.005",
    "transactions": 2,
    "uniqueInteractions": 1,
    "walletAgeInDays": 3
  }
}
```

## 프로바이더

### 지갑 프로바이더 (walletProvider)

지갑 주소의 온체인 정보를 가져오는 프로바이더입니다.

```
지갑 정보:
- 주소: 0x1234567890abcdef1234567890abcdef12345678
- 잔액: 0.005 RSK
- 트랜잭션 수: 2
- 고유 상호작용 수: 1
- 첫 트랜잭션 날짜: 2023-05-01T12:34:56.789Z
- 지갑 나이: 3일
```

## 액션

### ANALYZE_SYBIL

지갑 주소를 분석하여 시빌 계정인지 판단하는 액션입니다.

**예시:**

입력:
```
0x1234567890abcdef1234567890abcdef12345678 이 지갑이 시빌인지 확인해줘
```

출력:
```
## 지갑 분석 결과

### 기본 정보
- 주소: 0x1234567890abcdef1234567890abcdef12345678
- 잔액: 0.005 RSK
- 트랜잭션 수: 2
- 고유 상호작용 수: 1
- 지갑 나이: 3일

### 시빌 공격 분석
- 시빌 지갑 여부: 예
- 신뢰도: 85%

### 분석 이유
- 트랜잭션 수가 적음 (기준: 5개 이상)
- 고유 상호작용 수가 적음 (기준: 3개 이상)
- 지갑 나이가 7일 미만
```

## 설정 파라미터

| 파라미터 | 설명 | 기본값 |
| --- | --- | --- |
| RPC_URL | RSK 블록체인 RPC URL | https://public-node.testnet.rsk.co |

## 라이센스

MIT 