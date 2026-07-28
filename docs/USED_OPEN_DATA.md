# 使用データ・サービス

実装に組み込んだデータのみを記録します。モック代替している項目は備考で明記します。

## オープンデータ

| データ名 | 提供元 | URL | 実装箇所（ファイル/機能） | 用途 | 備考 |
|---|---|---|---|---|---|
| クーリングシェルター一覧 | 江東区 / 東京都オープンデータ | https://www.opendata.metro.tokyo.lg.jp/koto/131083_202_cooling_shelter.csv | `worker/src/index.ts`, `src/services/openData.ts` | シェルターピン、施設詳細 | 実データ接続済み。取得失敗時のみモック代替 |
| 都道の街路樹 | 東京都建設局 | https://www.opendata.metro.tokyo.lg.jp/kensetsu/tokyo_gairoju.csv | `worker/src/index.ts`, `src/services/openData.ts`, `src/services/routes.ts` | 緑陰スコア | 実データ接続済み。江東区周辺に絞り込み。取得失敗時のみモック代替 |
| 区立公園 | 江東区 / 東京都オープンデータ | https://www.city.koto.lg.jp/012107/documents/131083_kotocity_public_facility-17_parks.csv | `worker/src/index.ts`, `src/services/openData.ts`, `src/services/routes.ts` | 緑陰公園、休憩スポット | 実データ接続済み。取得失敗時のみモック代替 |
| Tokyowater Drinking Station一覧 | 東京都水道局 | https://www.opendata.metro.tokyo.lg.jp/suidou/R7/tokyowaterdrinkingstation_250917.csv | `worker/src/index.ts`, `src/services/openData.ts`, `src/services/routes.ts` | 給水スポット、休憩スポット | 実データ接続済み。江東区周辺に絞り込み。取得失敗時のみモック代替 |
| 暑さ指数（WBGT） | 環境省 熱中症予防情報サイト | https://www.wbgt.env.go.jp/data_service.php | `src/services/heatRisk.ts` | 熱中症リスク表示 | 直接接続は未実装。取得失敗時のフォールバック値として使用 |
| 3D都市モデル/建物データ | PLATEAU | https://api.plateauview.mlit.go.jp/datacatalog/3dtiles/13108-bldg-lod1-texture-latest/tileset.json | `scripts/extract-plateau-buildings.mjs`, `src/data/plateau/kotoDemoBuildings.json`, `src/services/buildingShade.ts`, `src/features/map/MapView.tsx` | 建物日陰の参考レイヤー | 実データ接続済み。東陽町〜木場〜南砂周辺の建物矩形・高さを抽出し、固定日時の影ポリゴンを生成 |

## 利用API/サービス

| サービス名 | 提供元 | URL | 実装箇所（ファイル/機能） | 用途 | 備考 |
|---|---|---|---|---|---|
| OpenStreetMap タイル | OpenStreetMap Foundation | https://operations.osmfoundation.org/policies/tiles/ | `src/features/map/MapView.tsx` | 地図表示 | attribution表示必須 |
| OpenRouteService Directions API | HeiGIT gGmbH | https://openrouteservice.org/restrictions/ | `worker/src/index.ts`, `src/services/routes.ts` | 徒歩ルート取得 | APIキーはWorker環境変数。未設定時はフォールバックルート |
| Nominatim | OpenStreetMap Foundation | https://operations.osmfoundation.org/policies/nominatim/ | `src/services/destinationSearch.ts` | 住所・地名検索 | 無料範囲で利用。入力確定時のみ。まず取得済み施設・公園・給水名を検索 |
| Open-Meteo | Open-Meteo | https://open-meteo.com/ | `src/services/heatRisk.ts` | 気温・湿度取得、簡易WBGT目安算出 | 無料・APIキー不要。東京都オープンデータでないため技術補助サービスとして記録 |
