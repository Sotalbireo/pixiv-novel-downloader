export { PixivNovel2AozoraTxt as default }

/**
 * @param str Pixiv小説フォーマット文字列
 * @return 青空文庫風フォーマット文字列
 */
const PixivNovel2AozoraTxt = (str: string) => str
	// HTML 除去
	.replace(/<\/?div.*?>/gis, "")
	.replace(/<\/h\d.*?>/gi, "")
	.replace(/<br \/>/gi, "")
	// [TODO] 「ルビ記号など、特別な役割を与えられた文字」への対応
	// 《》［］〔〕｜＃※
	// ref: https://www.aozora.gr.jp/annotation/extra.html#special_character
	// 改ページ
	.replace(/\[newpage\]/gi, "［＃改ページ］")
	// チャプター
	.replace(/\[chapter:(.*?)\]/gi, "$1［＃「$1」は中見出し］")
	// ルビ
	.replace(
		/\[\[rb:(.*?)(?:&gt;|>) (.*?)\]\]/gi,
		(_: string, p1: string, p2: string) => {
			const isLatin = /^[A-z\u00C0-\u00ff\s'\.,-\/#!$%\^&\*;:{}=\-_`~()]+$/.test(
				p1
			);
			p1 = p1.trim();
			p2 = p2.trim();
			return `｜${p1}《${p2}》${isLatin ? " " : ""}`;
		}
	)
	// 半角カナの横組み
	.replace(
		/([….]*(?=[ｦ-ﾝ])[ｦ-ﾝ ]+(?<=[ｦ-ﾝ])[….?!ﾞﾟ]*)/g,
		"［＃横組み］$1［＃横組み終わり］"
	)
	.replace(/［＃横組み終わり］［＃横組み］/g, "")
	.replace(
		/^［＃横組み］(.*)［＃横組み終わり］$/gm,
		"［＃ここから横組み］\r\n$1\r\n［＃ここで横組み終わり］"
	)
	.replace(/^［＃ここで横組み終わり］\r?\n［＃ここから横組み］\r?\n/gm, "")
	// jumpurl
	.replace(/\[\[jumpuri:(.*?) ?(?:&gt;|>) ?(.*?)\]\]/g, "$1 <$2> ")
	// 各行の行末空白をトリム
	.split(/\r?\n/)
	.map(s => s.trimRight())
	.join("\r\n")
	// 文章先頭は全角スペース以外トリム、終端は通常トリム＋空行挿入
	.replace(
		/^[\f\n\r\t\v \u00a0\u1680​\u180e\u2028\u2029\u202f\u205f​\ufeff\u{2000}-\u{200a}​]+/u,
		""
	)
	.trimRight() + "\r\n"
