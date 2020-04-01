
/**
 * リーダブル年月日.jp
 * @param timestamp
 * @returns YYYY年M月D日
 */
export function getReadableDate(timestamp = Date.now()) {
	const now = new Date(timestamp)
	return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
}

/**
 * いつもの
 * @param msec 停止させたいミリ秒
 */
export function sleep(msec: number) {
	return new Promise(resolve => setTimeout(resolve, msec))
}


/**
 * フォルダ・ファイル名に使えない文字列を差し替える
 * @param str フォルダ・ファイル名文字列
 * @return 差し替え文字列
 */
export function stylizesStr4UsedInFiles(str: string): string {
	const dict = {
		'/': '／',
		'>': '＞',
		'<': '＜',
		'?': '？',
		':': '：',
		'"': '”',
		'\\': '＼',
		'*': '＊',
		'|': '｜',
		';': '；',
		'~': '〜'
	}
	const re = RegExp(`[${Object.keys(dict).join('')}]`, 'gi')
	return str.replace(
		re,
		(m: string) => dict[m as keyof typeof dict]
	)
}
