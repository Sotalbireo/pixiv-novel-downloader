import fs from 'fs'
import { homedir } from 'os'
import jsdom from 'jsdom'
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


const items = [...process.argv].slice(2)
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
		.replace(/<br \/>/gi, '\r\n')
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
		// 添え物のような端トリム
		.trim()
}


// DL先フォルダの作成
if (!fs.existsSync(baseDir)) {
	fs.mkdirSync(baseDir, { recursive: true })
}

const virtualConsole = new jsdom.VirtualConsole()

;(async () => {
	for await (let item of items) {

		if (/^https?:\/\/www\.pixiv\.net\/novel\/show.php/.test(item)) {
		} else if (/^\d+$/.test(item)) {
			item = `https://www.pixiv.net/novel/show.php?id=${item}`
		} else {
			continue
		}

		const raw = await JSDOM.fromURL(item, {
			// contentType: 'text/html; charset=utf-8;',
			referrer: 'https://www.pixiv.net/',
			resources: 'usable',
			virtualConsole,
		}).catch(err => {
			console.error(err)
			return null
		})

		if (raw === null) {
			continue
		}

		const dom = raw!.window.document as Document
		const userdata = dom.querySelectorAll('.userdata')[0]
		const title = stylizeLikePath(userdata.querySelector('.title')?.textContent!)
		const author = stylizeLikePath(userdata.querySelector('.name a')?.textContent!)
		const authorId = (userdata.querySelector('.name a')?.getAttribute('href')?.match(/\/(\d+)$/) as any[])[1] as number
		const authorDir = `${authorId}_${author}`
		const articleId = (new URL(item).search.match(/\&?id=(\d+)/) as any[])[1] as number
		const fileName = `${articleId}_${title}`
		const article = dom.querySelector('.novelbody-container noscript')?.textContent!.pixivNovel2AozoraTxt()

		const aozoraTxt = [title, author, item, '\r\n\r\n', article].join('\r\n')

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
