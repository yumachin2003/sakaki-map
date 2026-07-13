FROM python:3.13-slim

# コンパイルに必要なパッケージをインストール
RUN apt-get update && apt-get install -y \
    gcc \
    python3-dev \
    libffi-dev \
    libssl-dev \
    nginx \
    && rm -rf /var/lib/apt/lists/*

# コンテナ内の作業ディレクトリを設定
WORKDIR /app

# pipenvとGunicornをインストール
RUN pip install pipenv gunicorn

# 依存関係ファイルをコピーし、システム全体にインストール
COPY Pipfile Pipfile.lock ./
RUN pipenv install --system --deploy

# アプリケーションのコードとフロントエンドのビルド結果(dist)をすべてコピー
COPY . .

# Flaskアプリケーションが使用する5001番ポートを開放
EXPOSE 5001

# Gunicornを使用してアプリケーションを起動
# アプリケーションの構成に合わせてポート5001にバインドし、app.pyのappオブジェクトを指定
CMD ["gunicorn", "--bind", "0.0.0.0:5001", "--workers", "4", "app:app"]