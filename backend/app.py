import os
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS

app = Flask(__name__)


# --- CORS設定（Viteの5173ポートからアクセスできるようにする） ---
CORS(
    app,
    resources={r"/api/*": {"origins": "*"}}, # どの端末からでもアクセスできるように変更
    allow_headers=["Content-Type"],
    methods=["GET", "POST", "OPTIONS"],
)


# --- SQLiteデータベースの設定 ---
base_dir = os.path.abspath(os.path.dirname(__file__))   # 現在のディレクトリを取得し、ベースディレクトリ（base_dir）に指定
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(base_dir, 'sakaki_map.db')}"  # データベースの指定
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False    # 変更追跡機能を無効化（メモリ消費を抑えるため）

db = SQLAlchemy(app)


# --- データベースのモデル定義 ---
class Memory(db.Model):
    __tablename__ = 'memories'
    id = db.Column(db.Integer, primary_key=True) # 班番号(例: 101)が入る想定
    name = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(200))
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    detail = db.Column(db.String(500))
    imageUrl = db.Column(db.String(500))

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'location': self.location,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'detail': self.detail,
            'imageUrl': self.imageUrl,
        }

# アプリ起動時にテーブルを自動作成
with app.app_context():
    db.create_all()


# --- APIの定義 ---

# GET /api/memories : 保存されている全員の思い出データを取得する
@app.route('/api/memories', methods=['GET'])
def get_memories():
    memories = Memory.query.all()
    return jsonify([m.to_dict() for m in memories]), 200

# POST /api/memories : 子供たちがLv.4で送信するJSONを受け取る
@app.route('/api/memories', methods=['POST'])
def upload_memories():
    data = request.get_json()

    if not data or not isinstance(data, list):
        return jsonify({'error': 'データはJSONの配列（リスト）形式である必要があります'}), 400

    # 送られてきた配列（班の思い出リスト）をループ処理
    try:
        for item in data:
            memory_id = item.get('id')
            if not memory_id:
                continue # IDがないデータはスキップ

            # 既に同じID（例: 2班の1つ目 = 201）が存在するかチェック
            existing_memory = db.session.get(Memory, memory_id)
            # 存在する場合は上書き
            if existing_memory:
                existing_memory.name = item.get('name', existing_memory.name)
                existing_memory.location = item.get('location', existing_memory.location)
                existing_memory.latitude = item.get('latitude', existing_memory.latitude)
                existing_memory.longitude = item.get('longitude', existing_memory.longitude)
                existing_memory.detail = item.get('detail', existing_memory.detail)
                existing_memory.imageUrl = item.get('imageUrl', existing_memory.imageUrl)

            # 存在しない場合は新規作成
            else:
                name = item.get('name')
                lat = item.get('latitude')
                lon = item.get('longitude')

                # 必須項目が欠けている場合は400エラーで教えてあげる
                if name is None or lat is None or lon is None:
                    return jsonify({'error': f'ID {memory_id} のデータ保存に失敗しました。「name」「latitude」「longitude」は必須項目です。'}), 400

                new_memory = Memory(
                    id=memory_id,
                    name=name,
                    location=item.get('location'),
                    latitude=lat,
                    longitude=lon,
                    detail=item.get('detail'),
                    imageUrl=item.get('imageUrl')
                )
                db.session.add(new_memory)
                
        db.session.commit()
        return jsonify({'message': 'サーバーへのデプロイに成功しました'}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error saving memories: {e}")
        # 予期せぬエラーが起きた場合でも、何が原因か詳細をフロントに返す
        return jsonify({'error': f'保存エラー: 入力データを確認してください。詳細: {str(e)}'}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)