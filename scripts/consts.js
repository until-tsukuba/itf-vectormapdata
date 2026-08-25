// 定義

// Overpass APIのエンドポイント。先頭から順に試行し、失敗したら次にフォールバックする。
// 旧エンドポイントの overpass.openstreetmap.jp はサービスを終了しており、
// DNSがGitHub Pagesを指しているためTLSエラーになる。使用しないこと。
export const PUBLIC_OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
