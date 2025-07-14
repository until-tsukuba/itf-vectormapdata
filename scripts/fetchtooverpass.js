import { writeFile } from 'fs/promises'; // 非同期でファイルを書き込むために必要
import osmtogeojson from 'osmtogeojson';
import { PUBLIC_OVERPASS_URL } from './consts.js'; 

// Overpass APIのエンドポイント
const overpassUrl = PUBLIC_OVERPASS_URL;

// 実行したいOverpassクエリ
const overpassQuery = `
[out:json][timeout:25];
way(id:183555029, 183555030) -> .target_ways;
.target_ways map_to_area -> .target_areas;
(
  nwr(area.target_areas);
);
out geom;
`;

// データを取得してファイルに保存する非同期関数
async function fetchOverpassData() {
  console.log('fetchtooperpass: Overpass API（ ' + overpassUrl + ' ）にクエリを送信しています');

  try {
    // fetch APIを使ってPOSTリクエストを送信
    const response = await fetch(overpassUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(overpassQuery)}`,
    });

    // レスポンスが成功したかチェック (HTTPステータスが200-299でない場合)
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`fetchtooperpass: APIリクエストが失敗しました: ${response.status} ${response.statusText}\n${errorText}`);
    }

    // レスポンスをJSONとしてパース
    const data = await response.json();
    console.log(`fetchtooperpass: 取得に成功しました。合計で${data.elements.length}件の地物を取得しました。`);

    // osmtogeojsonを使ってOverPassから得られたJSONをGeoJSONに変換
    const geoJsonData = osmtogeojson(data);

    // 取得したデータをGeoJSONファイルとしてきれいにフォーマットして保存
    await writeFile('public/itfvectormap.geojson', JSON.stringify(geoJsonData, null, 4));

    console.log("fetchtooperpass: 結果を 'public/itfvectormap.geojson' に保存しました。");

  } catch (error) {
    console.error('fetchtooperpass: エラーが発生しました:', error);
  }
}

fetchOverpassData();
