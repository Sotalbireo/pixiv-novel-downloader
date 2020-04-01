import Pixiv from 'pixiv.ts'

;(async () => {
	const pixiv = await Pixiv.login(
		process.env.PIXIV_USERNAME || '',
		process.env.PIXIV_PASSWORD || ''
	)

	const pixivNovel = await pixiv.novel
		.detail({ novel_id: 129 })

	const pixivNovelText = await pixiv.novel
		.text({ novel_id: 129 })


	console.log(pixivNovel)
	console.log(pixivNovelText)
})()
