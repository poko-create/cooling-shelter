# 使用データ・サービス

実装に組み込んだデータのみを記録します。モック代替している項目は備考で明記します。

## オープンデータ

- クーリングシェルター一覧
	- 提供元: 江東区 / 東京都オープンデータ
	- URL: https://www.opendata.metro.tokyo.lg.jp/koto/131083_202_cooling_shelter.csv
	- 実装箇所: `worker/src/index.ts`, `src/services/openData.ts`
	- 用途: シェルターピン、施設詳細
	- 備考: 実データ接続済み。取得失敗時のみモック代替

- 都道の街路樹
	- 提供元: 東京都建設局
	- URL: https://www.opendata.metro.tokyo.lg.jp/kensetsu/tokyo_gairoju.csv
	- 実装箇所: `worker/src/index.ts`, `src/services/openData.ts`, `src/services/routes.ts`
	- 用途: 緑陰スコア
	- 備考: 実データ接続済み。江東区周辺に絞り込み。取得失敗時のみモック代替

- 区立公園
	- 提供元: 江東区 / 東京都オープンデータ
	- URL: https://www.city.koto.lg.jp/012107/documents/131083_kotocity_public_facility-17_parks.csv
	- 実装箇所: `worker/src/index.ts`, `src/services/openData.ts`, `src/services/routes.ts`
	- 用途: 緑陰公園、休憩スポット
	- 備考: 実データ接続済み。取得失敗時のみモック代替

- Tokyowater Drinking Station一覧
	- 提供元: 東京都水道局
	- URL: https://www.opendata.metro.tokyo.lg.jp/suidou/R7/tokyowaterdrinkingstation_250917.csv
	- 実装箇所: `worker/src/index.ts`, `src/services/openData.ts`, `src/services/routes.ts`
	- 用途: 給水スポット、休憩スポット
	- 備考: 実データ接続済み。江東区周辺に絞り込み。取得失敗時のみモック代替

- 暑さ指数（WBGT）
	- 提供元: 環境省 熱中症予防情報サイト
	- URL: https://www.wbgt.env.go.jp/data_service.php
	- 実装箇所: `src/services/heatRisk.ts`
	- 用途: 熱中症リスク表示
	- 備考: 直接接続は未実装。取得失敗時のフォールバック値として使用

- 3D都市モデル/建物データ
	- 提供元: PLATEAU
	- URL: https://api.plateauview.mlit.go.jp/datacatalog/3dtiles/13108-bldg-lod1-texture-latest/tileset.json
	- 実装箇所: `scripts/extract-plateau-buildings.mjs`, `src/data/plateau/kotoDemoBuildings.json`, `src/services/buildingShade.ts`, `src/features/map/MapView.tsx`
	- 用途: 建物日陰の参考レイヤー
	- 備考: 実データ接続済み。東陽町〜木場〜南砂周辺の建物矩形・高さを抽出し、固定日時の影ポリゴンを生成

## 利用API/サービス

- OpenStreetMap タイル
	- 提供元: OpenStreetMap Foundation
	- URL: https://operations.osmfoundation.org/policies/tiles/
	- 実装箇所: `src/features/map/MapView.tsx`
	- 用途: 地図表示
	- 備考: attribution表示必須

- OpenRouteService Directions API
	- 提供元: HeiGIT gGmbH
	- URL: https://openrouteservice.org/restrictions/
	- 実装箇所: `worker/src/index.ts`, `src/services/routes.ts`
	- 用途: 徒歩ルート取得
	- 備考: APIキーはWorker環境変数。未設定時はフォールバックルート

- Nominatim
	- 提供元: OpenStreetMap Foundation
	- URL: https://operations.osmfoundation.org/policies/nominatim/
	- 実装箇所: `src/services/destinationSearch.ts`
	- 用途: 住所・地名検索
	- 備考: 無料範囲で利用。入力確定時のみ。まず取得済み施設・公園・給水名を検索

- Open-Meteo
	- 提供元: Open-Meteo
	- URL: https://open-meteo.com/
	- 実装箇所: `src/services/heatRisk.ts`
	- 用途: 気温・湿度取得、簡易WBGT目安算出
	- 備考: 無料・APIキー不要。東京都オープンデータでないため技術補助サービスとして記録

## ローカル開発ポート

- 涼道ナビTOKYO
	- フロントエンド: `5174`
	- API: `8788`
	- 備考: Vite は `strictPort` を有効化。Worker は `wrangler.toml` の `[dev]` で固定
