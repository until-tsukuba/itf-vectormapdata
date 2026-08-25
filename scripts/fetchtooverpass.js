import { writeFile } from 'fs/promises'; // 非同期でファイルを書き込むために必要
import osmtogeojson from 'osmtogeojson';
import { PUBLIC_OVERPASS_URLS } from './consts.js';

const OUTPUT_PATH = 'public/itfvectormap.geojson';
const ATTEMPTS_PER_URL = 3; // 1エンドポイントあたりの試行回数
const RETRY_WAIT_MS = 30000; // リトライ間隔。Overpassの混雑時は待たないと弾かれる

// 実行したいOverpassクエリ
const overpassQuery = `
[out:json][timeout:180];
way(id:183555029, 183555030) -> .target_ways;
.target_ways map_to_area -> .target_areas;
(
  nwr(area.target_areas);
);
out geom;
`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 1エンドポイントへ1回問い合わせる。失敗時は例外を投げる
async function requestOverpass(url) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // Overpassは匿名の大量アクセスを制限するため、識別できるUAを送る
      'User-Agent': 'itf-vectormapdata (https://github.com/until-tsukuba/itf-vectormapdata)',
    },
    body: `data=${encodeURIComponent(overpassQuery)}`,
  });

  // レスポンスが成功したかチェック (HTTPステータスが200-299でない場合)
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`APIリクエストが失敗しました: ${response.status} ${response.statusText}\n${errorText.slice(0, 500)}`);
  }

  const data = await response.json();

  // Overpassは過負荷時などに200のまま空の結果を返すことがあるため中身を確認する
  if (!Array.isArray(data.elements) || data.elements.length === 0) {
    throw new Error('地物が0件でした。空のデータで上書きしないため失敗として扱います。');
  }

  return data;
}

// エンドポイントを順に、それぞれ複数回試す
async function fetchOverpassData() {
  for (const url of PUBLIC_OVERPASS_URLS) {
    for (let attempt = 1; attempt <= ATTEMPTS_PER_URL; attempt++) {
      console.log(`fetchtooperpass: Overpass API（ ${url} ）にクエリを送信しています（${attempt}/${ATTEMPTS_PER_URL}回目）`);

      try {
        const data = await requestOverpass(url);
        console.log(`fetchtooperpass: 取得に成功しました。合計で${data.elements.length}件の地物を取得しました。`);
        return data;
      } catch (error) {
        console.error(`fetchtooperpass: 失敗しました（ ${url} ）:`, error.message ?? error);

        // 同じエンドポイントで再試行する場合のみ待つ
        if (attempt < ATTEMPTS_PER_URL) {
          console.log(`fetchtooperpass: ${RETRY_WAIT_MS / 1000}秒待ってから再試行します`);
          await sleep(RETRY_WAIT_MS);
        }
      }
    }
  }

  return null;
}

const data = await fetchOverpassData();

// 全エンドポイントで失敗した場合は異常終了する。
// ここで正常終了すると後続のtippecanoeが入力ファイル無しで動き、
// 最終的に空のサイトをデプロイして既存データを壊してしまう。
if (data === null) {
  console.error('fetchtooperpass: すべてのエンドポイントで取得に失敗しました。処理を中止します。');
  process.exit(1);
}

// osmtogeojsonを使ってOverPassから得られたJSONをGeoJSONに変換
const geoJsonData = osmtogeojson(data);

if (!geoJsonData.features || geoJsonData.features.length === 0) {
  console.error('fetchtooperpass: GeoJSONへの変換結果が空でした。処理を中止します。');
  process.exit(1);
}

// 取得したデータをGeoJSONファイルとしてきれいにフォーマットして保存
await writeFile(OUTPUT_PATH, JSON.stringify(geoJsonData, null, 4));

console.log(`fetchtooperpass: ${geoJsonData.features.length}件のフィーチャを '${OUTPUT_PATH}' に保存しました。`);
