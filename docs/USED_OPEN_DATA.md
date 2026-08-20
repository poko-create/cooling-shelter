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
	- 実装箇所: `worker/src/index.ts`, `src/services/openData.ts`, `src/services/routes.ts`, `src/data/mock/kotoTrees.ts`
	- 用途: 緑陰スコア
	- 備考: 実データ接続済み。江東区の街路樹に絞り込み。取得失敗時は同CSV由来の江東区fallbackデータで代替

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
	- URL: https://assets.cms.plateau.reearth.io/assets/4d/ba6c87-3dd2-496e-8091-a1aa32bb83cc/13108_koto-ku_pref_2025_citygml_1_op_bldg_3dtiles_13108_koto-ku_lod1/tileset.json
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
	- 用途: 住所・地名・施設名検索
	- 備考: 無料範囲で利用。入力候補と入力確定時に利用。まず取得済み施設・公園・給水名を検索

- Overpass API
	- 提供元: OpenStreetMap community
	- URL: https://overpass-api.de/
	- 実装箇所: `src/services/places.ts`, `src/services/destinationSearch.ts`
	- 用途: 近隣コンビニ取得、店舗・施設名検索候補
	- 備考: OpenStreetMapデータを利用。検索欄では地図中心から約5km以内の `name` / `brand` を検索

- Open-Meteo
	- 提供元: Open-Meteo
	- URL: https://open-meteo.com/
	- 実装箇所: `src/services/heatRisk.ts`
	- 用途: 気温・湿度取得、簡易WBGT目安算出
	- 備考: 無料・APIキー不要。東京都オープンデータでないため技術補助サービスとして記録

- Google Fonts
	- 提供元: Google
	- URL: https://fonts.google.com/specimen/Inter
	- 実装箇所: `src/styles.css`
	- 用途: UIフォント `Inter` の読み込み
	- 備考: 画面表示用の外部フォント配信サービス

## ローカル開発ポート

- 涼道ナビTOKYO
	- フロントエンド: `5174`
	- API: `8788`
	- 備考: Vite は `strictPort` を有効化。Worker は `wrangler.toml` の `[dev]` で固定
