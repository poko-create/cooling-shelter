# 涼道ナビTOKYO

都知事杯オープンデータ・ハッカソン2026向けのMVPです。

## 起動

```bash
npm install
npm run dev
```

## 主な機能

- 現在地モード / デモ保証エリア（江東区）モードの手動切り替え
- クーリングシェルターの地図表示
- 東京都オープンデータからのシェルター・街路樹・公園・給水スポット取得
- 施設スタッフ用の空き状況更新画面
- 任意目的地へのルート比較
- 街路樹・公園・給水スポットを使った緑陰スコア
- WBGTを想定した熱中症リスク表示

## スタッフ更新画面

```text
/staff/koto-001
/staff/koto-002
/staff/koto-003
```

現時点ではローカルデモ用にブラウザ内状態で更新します。Cloudflare Workers + D1 用のAPIとスキーマも用意しています。

## オープンデータ

Worker の `/api/open-data/:kind` が東京都系CSVを取得し、Shift_JISからUTF-8へ変換してフロントへ返します。対応する `kind` は `shelters`, `trees`, `parks`, `water` です。取得できない場合はデモ用データにフォールバックします。

## 歩行ルート

本番想定では `VITE_API_BASE_URL` と Worker 側の `ORS_API_KEY` を設定すると、OpenRouteService Directions API の `foot-walking` で実際の歩行ルートを取得します。

ローカル検証を簡単にする場合は、`.env.local` に `VITE_ORS_API_KEY` を設定すると、Workerを起動せずにブラウザからOpenRouteServiceへ直接問い合わせます。これはデモ検証用で、公開環境ではAPIキー保護のためWorker経由にしてください。

未設定時はデモ用の参考ルートにフォールバックし、画面にもその旨を表示します。

## 環境変数

- `VITE_API_BASE_URL`
- `VITE_ORS_API_KEY`
- `ORS_API_KEY`
- `STAFF_UPDATE_TOKEN`
- `AI_API_KEY`

APIキーはリポジトリにコミットしません。
