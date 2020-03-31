import Pixiv from 'pixiv.ts'
import fs from 'fs'

const { writeFile } = fs.promises

;(async () => {
	const pixiv = await Pixiv.login(
		process.env.PIXIV_USERNAME || '',
		process.env.PIXIV_PASSWORD || ''
	)

	const novel = await pixiv.novel
		.detail({ novel_id: 129 })
		.then(n => n)

	const text = await pixiv.novel
		.text({ novel_id: 129 })
		.then(n => n.novel_text)

	writeFile('./novel.txt', JSON.stringify(novel), 'utf8')
	writeFile('./text.txt', text, 'utf8')
})()
