import fs from 'fs'
import { homedir } from 'os'
import jsdom from 'jsdom'
import { resolve } from 'path'
const { JSDOM } = jsdom

declare global {
	interface String {
		pixivNovel2AozoraTxt(): string
	}
}

if (process.argv.length < 3) {
	console.log(process.argv)
	process.exit()
}

const resolveArgv = (argv: string[]): string[] => {
	let indices = []
	let option = ''
	// リストファイルの読み込みと適用
	option = '-a'
	if (argv.includes(option)) {
		let idx = argv.indexOf(option)
		while (idx !== -1) {
			indices.push(idx)
			idx = argv.indexOf(option, idx + 1)
		}
		indices.forEach(i => {
			try {
				const file = resolve(argv[i + 1])
				const importArgv = fs
					.readFileSync(file, 'utf-8')
					.split(/\r?\n/)
					.map(s => s.trim())
				argv.splice(i, 2)
				argv.push(...importArgv)
			} catch (err) {
				console.error(err)
			}
		})
	}
	argv.forEach((arg, idx) => {
		// 小説IDのみを引数にとったやつの対応
		if (/^\d+$/.test(arg)) {
			argv[idx] = `https://www.pixiv.net/novel/show.php?id=${arg}`
		}
	})
	// Pixiv小説のURLのみを返す
	return argv.filter(arg => /^https?:\/\/www\.pixiv\.net\/novel\/show.php/.test(arg))
}

const items = resolveArgv([...process.argv].slice(2))
const baseDir = `${homedir()}/Downloads/pixiv-novel`
const stylizeLikePath = (str: string) => {
	const uselessChar = {
		'\/': '／',
		'\>': '＞',
		'\<': '＜',
		'\?': '？',
		'\:': '：',
		'\"': '”',
		'\\': '＼',
		'\*': '＊',
		'\|': '｜',
		'\;': '；',
		'\~': '〜',
	}
	const re = RegExp(`[${Object.keys(uselessChar).join('')}]`, 'gi')
	return str.replace(re, (m: string) => uselessChar[m as keyof typeof uselessChar])
}
String.prototype['pixivNovel2AozoraTxt'] = function() {
	return this
		// HTML 除去
		.replace(/<\/?div.*?>/gis, '')
		.replace(/<\/h\d.*?>?/gi, '')
		.replace(/<br \/>/gi, '')
		// 改ページ
		.replace(/\[newpage\]/gi, '［＃改ページ］')
		// チャプター
		.replace(/\[chapter:(.*?)\]/gi, '$1［＃「$1」は中見出し］')
		// ルビ
		.replace(/\[\[rb:(.*?)(?:&gt;|>) (.*?)\]\]/gi,
			(_: string, p1: string, p2: string) => {
				const isLatin = /^[A-z\u00C0-\u00ff\s'\.,-\/#!$%\^&\*;:{}=\-_`~()]+$/.test(p1)
				p1 = p1.trim()
				p2 = p2.trim()
				return `｜${p1}《${p2}》${isLatin ? ' ' : ''}`
			}
		)
		// 半角カナの横組み
		.replace(/([….]*(?=[ｦ-ﾝ])[ｦ-ﾝ ]+(?<=[ｦ-ﾝ])[….?!ﾞﾟ]*)/g, '［＃横組み］$1［＃横組み終わり］')
		.replace(/［＃横組み終わり］［＃横組み］/g, '')
		.replace(/^［＃横組み］(.*)［＃横組み終わり］$/gm, '［＃ここから横組み］\r\n$1\r\n［＃ここで横組み終わり］')
		.replace(/^［＃ここで横組み終わり］\r?\n［＃ここから横組み］\r?\n/gm, '')
		// jumpurl
		.replace(/\[\[jumpuri:(.*?) ?(?:&gt;|>) ?(.*?)\]\]/, '$1 <$2>')
		// 各行の行末空白をトリム
		.split(/\r?\n/)
		.map(s => s.trimRight())
		.join('\r\n')
		// 文章先頭は全角スペース以外トリム、終端は通常トリム＋空行挿入
		.replace(/^[\f\n\r\t\v \u00a0\u1680​\u180e\u2028\u2029\u202f\u205f​\ufeff\u{2000}-\u{200a}​]+/u, '')
		.trimRight() + '\r\n'
}
const virtualConsole = new jsdom.VirtualConsole()


// DL先フォルダの作成
if (!fs.existsSync(baseDir)) {
	fs.mkdirSync(baseDir, { recursive: true })
}


;(async () => {
	for await (const item of items) {

		const raw = await JSDOM.fromURL(item, {
			// contentType: 'text/html; charset=utf-8;',
			referrer: 'https://www.pixiv.net/',
			resources: 'usable',
			virtualConsole,
		}).catch(err => {
			const statusCode: number = err.response.statusCode
			if (statusCode === 403) {
				console.error(`> ${item}`)
				console.error(`Error #${statusCode}: URLが間違っていませんか？`)
			} else {
				console.error(`Error #${statusCode}: ${item}`)
			}
			return null
		})

		if (raw === null) {
			continue
		}

		const dom = raw.window.document
		const userdata = dom.querySelector('.userdata')!
		const title = stylizeLikePath(userdata.querySelector('.title')?.textContent ?? '')
		const articleId = new URL(item).search.match(/\&?id=(\d+)/)![1]
		const author = stylizeLikePath(userdata.querySelector('.name a')?.textContent ?? '')
		const authorId = userdata.querySelector('.name a')?.getAttribute('href')?.match(/\/(\d+)$/)![1]
		const authorDir = `${authorId}_${author}`
		const fileName = `${articleId}_${title}`
		const article = dom.querySelector('.novelbody-container noscript')?.textContent?.pixivNovel2AozoraTxt() ?? ''

		const aozoraTxt = [title, author, item, '', '', article].join('\r\n')

		if (!fs.existsSync(`${baseDir}/${authorDir}`)) {
			fs.mkdirSync(`${baseDir}/${authorDir}`, { recursive: true })
		}

		fs.writeFile(`${baseDir}/${authorDir}/${fileName}.txt`,
			aozoraTxt,
			() => {
				console.log(`Download complete: "${baseDir}/${authorDir}/${fileName}.txt"`)
			})

	}
})();
