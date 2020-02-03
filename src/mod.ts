import fs from 'fs'
import { homedir } from 'os'
import jsdom from 'jsdom'
const { JSDOM } = jsdom

if (process.argv.length < 3) {
	console.log(process.argv)
	process.exit()
}


const items = [...process.argv].filter(arg => /^https?:\/\//.test(arg))
const baseDir = `${homedir()}/Downloads/pixiv-novel`
const fixDirectoryLikeString = (str: string) => {
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
const pixivNovel2AozoraTxt = (str: string) => {
	return str
		.replace(/<\/?div.*?>/gim, '')
		.replace(/<\/h\d.*?>?/gi, '')
		.replace(/<br \/>/gi, '\r\n')
		.replace(/\[newpage\]/gi, '［＃改ページ］')
		.replace(/\[chapter:(.*?)\]/gi, '$1［＃「$1」は中見出し］')
		.replace(/\[\[rb:(.*?)(?:&gt;|>) (.*?)\]\]/gi, '｜$1《$2》')
		.trim()
}


if (!fs.existsSync(baseDir)) {
	fs.mkdirSync(baseDir, { recursive: true })
}

const virtualConsole = new jsdom.VirtualConsole()

;(async () => {
	for await (const item of items) {

		if (!/^https?:\/\/www\.pixiv\.net\/novel\/show.php/.test(item)) {
			continue
		}

		const raw = await JSDOM.fromURL(item, {
			// contentType: 'text/html; charset=utf-8;',
			referrer: 'https://www.pixiv.net/',
			resources: 'usable',
			virtualConsole,
		})
		const dom = raw.window.document as Document
		const userdata = dom.querySelectorAll('.userdata')[0]
		const title = fixDirectoryLikeString(userdata.querySelector('.title')?.textContent!)
		const author = fixDirectoryLikeString(userdata.querySelector('.name a')?.textContent!)
		const authorId = (userdata.querySelector('.name a')?.getAttribute('href')?.match(/\/(\d+)$/) as any[])[1] as number
		const authorDir = `${authorId}_${author}`
		const articleId = (new URL(item).search.match(/\&?id=(\d+)/) as any[])[1] as number
		const fileName = `${articleId}_${title}`
		const article = dom.querySelector('.novelbody-container noscript')?.textContent!

		const aozoraTxt = [title, author, item, '\r\n\r\n', pixivNovel2AozoraTxt(article)].join('\r\n')

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
