# pixiv-novel-downloader

## これは何

Pixiv小説を青空小説風にコンバートしつつダウンロードするやつ（あくまで「風」）

そのうち他の形式にも対応するかもしれないし、しないかもしれない

## 使い方

```shell
Usage: pixiv-novel-downloader [options] urls...

Download Pixiv novels as format like Aozora-bunko

Options:
  -v, --version              output the current version
  -a, --batch-file <FILE>    File containing URLs to download, one URL per line. Lines starting with '#', ';'
                             or ']' are considered as comments and ignored.
  -u, --username <USERNAME>  Login with this account ID
  -p, --password <PASSWORD>  Account password. If this option is left out, I will ask interactively.
  -h, --help                 output usage information
```

バージョン2系（プレリリース中）から単独で動くようになりました（なったはず）。
コンソールから通常コマンド同様に叩いてみてください。

`-u` と `-p` オプションに関しては、環境変数 `PIXIV_USERNAME`、 `PIXIV_PASSWORD` で代替できます（オプション引数と環境変数がどちらも存在した場合はオプション引数を優先します）。

### リリース版を使う

1. リリースページから最新版を落とす
1. コンソールから実行する

### 開発版を使う

Nodeの実行環境が必要です。依存パッケージの<s>アホのせい</s>兼ね合いで v10 系限定になりました。

`/.node-version` を同梱しましたので、 `nodenv` などを使われていると手間なくバージョン管理できるかと思います。かしこ。

1. GitHubから任意の方法でクローンして依存パッケージをインストールする
1. `yarn dev ******` でコンパイルせずに実行する
1. `yarn compile` で依存ライブラリ全てをバンドルしたファイルを作成する
	- その場合、`yarn start ******`でも実行できる

## 既知の不具合

### すべてのバージョン

- 他ページへのリンク記法（`[jump]`）が機能しない
	- 青空文庫には固定されたページの概念がないため
  - あんま対応する気がない
- イラストの挿入（`[pixivimage]`）が機能しない
  - そこまで対応する気がない

### ^1.0.0

- 「R-18」タグ付き作品のDLができない
	- ログイン機構がないため

## 開発環境

- Ubuntu 18.04.4 LTS (WSL)
  - Node: v10.19.0
- macOS Catalina 10.15.3
  - Node: v10.19.0
