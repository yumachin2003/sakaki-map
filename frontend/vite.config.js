import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import fs from 'fs';
import { exec } from 'child_process';

// === HMRをフックするカスタムプラグイン ===
function autoDeployAndDbUpdatePlugin() {
  return {
    name: 'auto-deploy-and-db-update',
    
    // ホットリロード時のフック
    async handleHotUpdate({ file, server }) {
      // 監視対象を lv3.js に絞る
      if (file.endsWith('lv3.js')) {

        try {
          const content = fs.readFileSync(file, 'utf-8');

          // 1. 正規表現で lv3.js の中身からIDと画像配列、フラグを抽出する
          const idMatch = content.match(/export const lv3PinId\s*=\s*(\d+)/);
          const uriMatch = content.match(/export const lv3ImageURI\s*=\s*(\[.*?\])/);
          const serverImgMatch = content.match(/export const useServerImg\s*=\s*(true|false)/);

          // 全てマッチして、かつ useServerImg が true の時だけ動かす
          if (idMatch && uriMatch && serverImgMatch && serverImgMatch[1] === 'true') {
            const id = parseInt(idMatch[1], 10);
            
            // シングルクォートをダブルクォートに変換してJSONパース（配列として取得）
            const arrayString = uriMatch[1].replace(/'/g, '"');
            const uris = JSON.parse(arrayString);

            if (uris.length === 0) return;

            // === サーバー情報の設定（sekilab.orgなどの環境に合わせて書き換えてね） ===
            const REMOTE_USER = 'ubuntu'; 
            const REMOTE_HOST = '153.126.153.105'; 
            const REMOTE_BASE_DIR = '/home/ubuntu/sakaki-map'; // サーバー側のプロジェクトルート
            const API_ENDPOINT = 'http://127.0.0.1:5001/api/update-path'; // DB更新用のAPI

            // 2. 抽出したURIごとにSCPコマンドを実行する
            uris.forEach(uri => {
              // ローカルの相対パスを作成（vite.config.jsから見たパスに調整）
              // ※ public/ や src/ の中にある場合はパスを書き換える
              const localPath = `./${uri}`; 
              const remotePath = `${REMOTE_BASE_DIR}/${uri}`;

              // scpコマンドの組み立て
              const scpCommand = `scp ${localPath} ${REMOTE_USER}@${REMOTE_HOST}:${remotePath}`;
              
              exec(scpCommand, (error, stdout, stderr) => {
                if (error) {
                  console.error(`❌ [SCP Error] ${uri} の転送に失敗:`, error.message);
                  return;
                }
                console.log(`✅ [SCP Success] ${uri} をサーバーに転送完了！`);
              });
            });

            // 3. Node.js側から直接バックエンドのAPIを叩いてDBを更新する
            console.log('🔍 [Debug] 送信先のAPI_ENDPOINT:', API_ENDPOINT);
            console.log('📡 [DB Update] データベースの更新リクエストを送信中...');

            fetch(API_ENDPOINT, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: id,
                // ▼ データベースのString型に合わせて、配列をJSON文字列に変換して送る！
                image_path: JSON.stringify(uris) 
              })
            })
            .then(async (res) => {
              // サーバーから 200 OK 以外が返ってきた時の処理
              if (!res.ok) {
                // エラー時はHTMLが返ってきているはずなので、その中身を見る！
                const errorText = await res.text();
                console.error(`❌ [DB Error] サーバーからエラー応答 (${res.status}):\n`, errorText.slice(0, 200));
                return;
              }
              return res.json();
            })
            .then(data => {
              if (data) console.log('✅ [DB Success] データベースのImageURI更新を完了した。', data);
            })
            .catch(err => {
              console.error('❌ [DB Error] 通信エラーが発生した:', err);
            });
          }
        } catch (error) {
          console.error('❌ [Plugin Error] lv3.jsのパース中にエラーが発生したよ:', error);
        }
      }
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl(), autoDeployAndDbUpdatePlugin()],
  base: '/sakaki-map/',
  server: {
    open: true,
    host: true,
    proxy: {
      '/sakaki-map/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
