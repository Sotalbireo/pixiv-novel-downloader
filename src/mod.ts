import commander from 'commander'
import fs from 'fs'
import { homedir } from 'os'
import jsdom from 'jsdom'
import { description, version } from '../package.json'
import { resolve } from 'path'
const program = new commander.Command()
const { writeFile } = fs.promises
const { JSDOM } = jsdom

declare global {
	interface String {
		pixivNovel2AozoraTxt(): string
	}
}
type ArgumentsOptions = {
	'version': string
	'A': string
}

program
	.name('pixiv-novel-downloader.js')
	.description(description)
	.usage('[options] urls...')
	.version(version, '-v, --version', 'output the current version')
	.option('-a, --batch-file <FILE>', `File containing URLs to download, one URL per line. Lines starting with '#', ';' or ']' are considered as comments and ignored.`)
	.parse(process.argv)

function getReadableDate() {
	const now = new Date()
	return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
}
function resolveArgv(opts: ArgumentsOptions, args: string[]) {
	// リストファイルの読み込みと適用
	if (opts.A) {
		const file = resolve(opts.A)
		const importItems = fs
			.readFileSync(file, 'utf-8')
			.split(/\r?\n/)
			.map(s => s.trim())
			.filter(s => /^[^#;\]]/.test(s))
		args.push(...importItems)
	}
	args.forEach(async (arg, idx) => {
		// 小説IDのみを引数にとってる場合の対応
		if (/^\d+$/.test(arg)) {
			args[idx] = `https://www.pixiv.net/novel/show.php?id=${arg}`
		}
	})
	// Pixiv小説のURLのみを返す
	return args.filter(arg => /^https?:\/\/www\.pixiv\.net\/novel\/show.php\?id=\d+$/.test(arg))
}
function stylizeLikePath(str: string): string {
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
		.replace(/<\/h\d.*?>/gi, '')
		.replace(/<br \/>/gi, '')
		// [TODO] 「ルビ記号など、特別な役割を与えられた文字」への対応
		// 《》［］〔〕｜＃※
		// ref: https://www.aozora.gr.jp/annotation/extra.html#special_character
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
		.replace(/\[\[jumpuri:(.*?) ?(?:&gt;|>) ?(.*?)\]\]/g, '$1 <$2> ')
		// 各行の行末空白をトリム
		.split(/\r?\n/)
		.map(s => s.trimRight())
		.join('\r\n')
		// 文章先頭は全角スペース以外トリム、終端は通常トリム＋空行挿入
		.replace(/^[\f\n\r\t\v \u00a0\u1680​\u180e\u2028\u2029\u202f\u205f​\ufeff\u{2000}-\u{200a}​]+/u, '')
		.trimRight() + '\r\n'
}


const items = resolveArgv(<ArgumentsOptions>program.opts(), program.args)
const baseDir = `${homedir()}/Downloads/pixiv-novel`
const jsdomOption = {
	// contentType: 'text/html; charset=utf-8;',
	referrer: 'https://www.pixiv.net/',
	resources: 'usable' as 'usable',
	// runScripts: 'dangerously' as 'dangerously',
	virtualConsole: new jsdom.VirtualConsole(),
}


// DL先フォルダの作成
if (!fs.existsSync(baseDir)) {
	fs.mkdirSync(baseDir, { recursive: true })
}


;(async () => {
	for await (const item of items) {

		const raw = await JSDOM.fromURL(item, jsdomOption).catch(err => {
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

		// R-18 checker
		if (dom.querySelector('div.r18-image')?.textContent?.includes('Join pixiv today and enjoy R-18 novels!')) {
			console.log(`"${title}" is R-18 content. It cannot download yet, sorry.`)
			continue
		}

		const articleId = new URL(item).search.match(/\&?id=(\d+)/)![1]
		const author = stylizeLikePath(userdata.querySelector('.name a')?.textContent ?? '')
		const authorId = userdata.querySelector('.name a')?.getAttribute('href')?.match(/\/(\d+)$/)![1]
		const authorDir = `${authorId}_${author}`
		const fileName = `${articleId}_${title}`
		const article = [
			dom
				.querySelector('.novelbody-container noscript')
				?.textContent?.pixivNovel2AozoraTxt(),
				'',
				'',
				`底本：「${title}」`,
				`　　　${item}`,
				`${getReadableDate()}作成`,
				''
			].join('\r\n')

		const aozoraTxt = [title, author, item, '', '', article].join('\r\n')
		const targetDir = `${baseDir}/${authorDir}`

		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true })
		}

		writeFile(`${targetDir}/${fileName}.txt`, aozoraTxt)
			.then(() => {
				console.log(`Download complete: "${targetDir}/${fileName}.txt"`)
			})

	}
})();
