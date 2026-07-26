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

## 環境変数

- `VITE_API_BASE_URL`
- `ORS_API_KEY`
- `STAFF_UPDATE_TOKEN`
- `AI_API_KEY`

APIキーはリポジトリにコミットしません。
