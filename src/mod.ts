import commander from 'commander'
import fs from 'fs'
import { homedir } from 'os'
import jsdom from 'jsdom'
import { description, version } from '../package.json'
import { resolve } from 'path'
import PixivNovel2AozoraTxt from './PixivNovel2AozoraTxt'
import { getReadableDate, stylizesStr4UsedInFiles } from './util'
// const ask: any = require('async-prompt')
import readlineSync from 'readline-sync';
const program = new commander.Command()
const { writeFile } = fs.promises
const { JSDOM } = jsdom


interface AuthenticationInfo {
	username: string | undefined
	password: string | undefined
}
interface ArgumentsOptions extends AuthenticationInfo {
	version: string
	batchFile: string | undefined
}

const authenticationInfo: AuthenticationInfo = {
	username: undefined,
	password: undefined
}

const options: ArgumentsOptions = Object.assign({},
	<ArgumentsOptions>program
		.name('pixiv-novel-downloader.js')
		.description(description)
		.usage('[options] urls...')
		.version(version, '-v, --version', 'output the current version')
		.option(
			'-a, --batch-file <FILE>',
			`File containing URLs to download, one URL per line. Lines starting with '#', ';' or ']' are considered as comments and ignored.`
		)
		.option('-u, --username <USERNAME>', 'Login with this account ID')
		.option(
			'-p, --password <PASSWORD>',
			'Account password. If this option is left out, I will ask interactively.'
		)
		.action(function(self){
			authenticationInfo.username = self.username || process.env.PIXIV_USERNAME
			authenticationInfo.password = self.password || process.env.PIXIV_PASSWORD
			if (
				authenticationInfo.username !== undefined
				&& authenticationInfo.password === undefined
			) {
				authenticationInfo.password = readlineSync.question('What is your password? ',
				{
					hideEchoBack: true,
					min: 1,
					max: Infinity
				})
			}
		})
		.parse(process.argv)
		.opts(),
	authenticationInfo
)

function resolveArgv(opts: ArgumentsOptions, args: string[]) {
	// リストファイルの読み込みと適用
	if (opts.batchFile) {
		const file = resolve(opts.batchFile)
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
	return args.filter(arg =>
		/^https?:\/\/www\.pixiv\.net\/novel\/show.php\?id=\d+$/.test(arg)
	)
}

// const options = program.opts() as ArgumentsOptions

// TODO u/pオプションの存在判定
// upあればpixiv.ts利用ルート
// uだけならパスワード入力待機
// どっちもなしならスクレイピング利用ルート
console.log(options)

// const useAPI = options.username !== undefined


process.exit()

const items = resolveArgv(options, program.args)
const baseDir = `${homedir()}/Downloads/pixiv-novel`
const jsdomOption = {
	// contentType: 'text/html; charset=utf-8;',
	referrer: 'https://www.pixiv.net/',
	resources: 'usable' as 'usable',
	// runScripts: 'dangerously' as 'dangerously',
	virtualConsole: new jsdom.VirtualConsole()
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
		const title = stylizesStr4UsedInFiles(
			userdata.querySelector('.title')?.textContent ?? ''
		)

		// R-18 checker
		if (
			dom
				.querySelector('div.r18-image')
				?.textContent?.includes('Join pixiv today and enjoy R-18 novels!')
		) {
			console.log(`"${title}" is R-18 content. It cannot download yet, sorry.`)
			continue
		}

		const articleId = new URL(item).search.match(/\&?id=(\d+)/)![1]
		const author = stylizesStr4UsedInFiles(
			userdata.querySelector('.name a')?.textContent ?? ''
		)
		const authorId = userdata
			.querySelector('.name a')
			?.getAttribute('href')
			?.match(/\/(\d+)$/)![1]
		const authorDir = `${authorId}_${author}`
		const fileName = `${articleId}_${title}`
		const novelArticle = dom
			.querySelector('.novelbody-container noscript')
			?.textContent
			|| ''
		const aozoraTxt = [
			title,
			author,
			'\r\n',
			PixivNovel2AozoraTxt(novelArticle),
			'\r\n',
			`底本：「${title}」`,
			`　　　${item}`,
			`${getReadableDate()}作成`,
			''
		].join('\r\n')
		const targetDir = `${baseDir}/${authorDir}`

		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true })
		}

		writeFile(`${targetDir}/${fileName}.txt`, aozoraTxt).then(() => {
			console.log(`Download complete: "${targetDir}/${fileName}.txt"`)
		})
	}
})()
