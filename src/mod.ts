import commander from 'commander'
import fs from 'fs'
import { homedir } from 'os'
import jsdom from 'jsdom'
import { description, version } from '../package.json'
import { resolve } from 'path'
import PixivNovel2AozoraTxt from './PixivNovel2AozoraTxt'
import { getReadableDate, stylizesStr4UsedInFiles, sleep } from './util'
import readlineSync from 'readline-sync'
import Pixiv from 'pixiv.ts'
const program = new commander.Command()
const { writeFile } = fs.promises
const { JSDOM } = jsdom

interface AuthenticationInfo {
	username?: string
	password?: string
}
interface ArgumentsOptions extends AuthenticationInfo {
	version: string
	batchFile?: string
}
interface NovelDetail {
	article?: string
	authorId?: string | number
	authorName?: string
	id: string
	title?: string
	url?: string
}

const authenticationInfo: AuthenticationInfo = {}
const baseUrl = 'https://www.pixiv.net/novel/show.php?id='
const reBaseUrl = /^https?:\/\/www\.pixiv\.net\/novel\/show.php\?id=(\d+)$/

const options: ArgumentsOptions = Object.assign(
	{},
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
		.action(function(self) {
			authenticationInfo.username = self.username || process.env.PIXIV_USERNAME
			authenticationInfo.password = self.password || process.env.PIXIV_PASSWORD
			if (
				authenticationInfo.username !== undefined &&
				authenticationInfo.password === undefined
			) {
				authenticationInfo.password = readlineSync.question(
					'What is your password? ',
					{
						hideEchoBack: true,
						min: 1,
						max: Infinity
					}
				)
			}
		})
		.parse(process.argv)
		.opts(),
	authenticationInfo
)

function resolveArgv(opts: ArgumentsOptions, args: string[], useAPI: boolean) {
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

	if (useAPI) {
		// APIでは作品IDしか使わないので排外処理
		args = args
			.map(arg => arg.replace(reBaseUrl, '$1'))
			.filter(arg => /^\d+$/.test(arg))
	} else {
		args = args
			.map(arg =>
				// 小説IDのみを引数にとってる場合の対応
				/^\d+$/.test(arg) ? `${baseUrl}${arg}` : arg
			)
			// Pixiv小説のURLのみを返す
			.filter(arg => reBaseUrl.test(arg))
	}

	// unique(args)
	return args.filter((arg, i) => args.indexOf(arg) === i)
}

const useAPI = options.username !== undefined
const items = resolveArgv(options, program.args, useAPI)
const baseDir = `${homedir()}/Downloads/pixiv-novel`
const jsdomOption = !useAPI
	? {
			// contentType: 'text/html; charset=utf-8;',
			referrer: 'https://www.pixiv.net/',
			resources: 'usable' as 'usable',
			// runScripts: 'dangerously' as 'dangerously',
			virtualConsole: new jsdom.VirtualConsole()
	  }
	: null

// DL先フォルダの作成
if (!fs.existsSync(baseDir)) {
	fs.mkdirSync(baseDir, { recursive: true })
}

if (useAPI) {
	console.log('Use API mode.')
} else {
	console.log('Use plain mode.')
}

;(async () => {
	// 走るたびにリログするのもなァだが、トークン管理は無限にハゲそうなので見なかったことに。
	const pixiv = useAPI
		? await Pixiv.login(options.username!, options.password!).catch(
				e => (
					console.log(
						`Error #${e.response.status}: "${e.response.statusText}". maybe login failed.`
					),
					null
				)
		  )
		: null
	const itemsNum = items.length
	const itemsDigit = itemsNum.toString().length
	let completedNum = 1

	if (useAPI && pixiv === null) {
		process.exit(1)
	}

	for await (const item of items) {
		const novelDetail: NovelDetail = {
			id: useAPI ? item : new URL(item).search.match(/\&?id=(\d+)/)![1],
			url: useAPI ? `${baseUrl}${item}` : item
		}
		if (useAPI) {
			const { title, user } = await pixiv!.novel.detail({
				novel_id: Number(item)
			})
			const { novel_text } = await pixiv!.novel.text({ novel_id: Number(item) })
			novelDetail.title = title
			novelDetail.authorId = user.id
			novelDetail.authorName = user.name
			novelDetail.article = novel_text

			// APIはあまり頻繁に叩きたくない
			await sleep(2000)
		} else {
			const raw = await JSDOM.fromURL(item, jsdomOption!).catch(err => {
				const statusCode: number = err.response.statusCode
				if (statusCode === 403) {
					console.error(`> ${item}`)
					console.error(`Error #${statusCode}: Is URL correct?`)
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
			novelDetail.title = stylizesStr4UsedInFiles(
				userdata.querySelector('.title')?.textContent ?? ''
			)

			// R-18 checker
			if (
				dom
					.querySelector('div.r18-image')
					?.textContent?.includes('Join pixiv today and enjoy R-18 novels!')
			) {
				console.log(
					`"${novelDetail.title}" is R-18 content. Please login and use API mode.`
				)
				continue
			}

			novelDetail.authorName = stylizesStr4UsedInFiles(
				userdata.querySelector('.name a')?.textContent ?? ''
			)
			novelDetail.authorId = userdata
				.querySelector('.name a')
				?.getAttribute('href')
				?.match(/\/(\d+)$/)![1]
			novelDetail.article =
				dom.querySelector('.novelbody-container noscript')?.textContent || ''
		}

		const aozoraTxt = [
			novelDetail.title,
			novelDetail.authorName,
			'\r\n\r\n',
			PixivNovel2AozoraTxt(novelDetail.article!),
			'\r\n',
			`底本：「${novelDetail.title}」`,
			`　　　${novelDetail.url}`,
			`${getReadableDate()}作成`,
			''
		].join('\r\n')
		const targetDir = `${baseDir}/${novelDetail.authorId}_${novelDetail.authorName}`
		const fileName = `${novelDetail.id}_${novelDetail.title}`

		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true })
		}

		writeFile(`${targetDir}/${fileName}.txt`, aozoraTxt).then(() => {
			console.log(
				`Download complete [${completedNum
					.toString()
					.padStart(
						itemsDigit,
						'0'
					)}/${itemsNum}]: "${targetDir}/${fileName}.txt"`
			)
			completedNum++
		})
	}
})()
