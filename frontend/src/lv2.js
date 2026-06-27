/* 【Lv.2 ルール】
 *  ① 機能を有効にする時は true（トゥルー）、無効にする時は false（フォールス）と書く。
 *  ② true / false は "" で囲まない。
 *  ③ 一つずつどの機能が増えているかを確認しながら書き換える。
 *  ④ 最終的には全て true の状態にする。
 */

import { IconTipJarEuro } from "@tabler/icons-react";

export const useSatellite = false;      // マップのレイヤー切り替えボタンを表示する
export const useCurrentButton = false;  // 現在地ボタンを表示する
export const useSearchBar = false;      // 検索ボックスを表示する
export const useDetailCard = false;     // 思い出の詳細カードを有効にする
export const useUploadPage = false;     // データ送信ページを有効にする