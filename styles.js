const stylesheet =
	"<style>" +
		"body { padding : 0 100px; font-family: 'Slack-Lato,appleLogo,sans-serif'; }" +
		".day_marker { text-align: center; width: 100%; }" +
		".day_marker:before, .day_marker:after { content: ''; height: 0px; width: calc(50% - 40px);border-top: 1px solid #CCCCCC;display: inline-block;top: -4px;position: relative; }" +
		".message { margin-bottom: 10px;min-height: 36px; }" +
		".message:hover { background:#f9f9f9; }" +
		"a, a:link, a:visited { color: #007AB8; text-decoration: none;}" +
		".poster { font-weight: bold; margin-right: 5px;}" +
		".timestamp { font-size: 0.8em; }" +
		"img.inline-img { max-width: 500px; width: 100%; }" +
		".mention { font-weight: bold; background-color: #FFF3B8;}" +
		".channel_join .content, .channel_leave .content, .channel_purpose .content { color: #cdcdd1; font-style: italic; }" +
		".channel_join .poster, .channel_leave .poster, .channel_purpose .poster {display: none;}" +
		".profPic { width: 42px; height:42px; float: left; margin-right: 5px; } " +
		".profPic img { border-radius: 5px; width: 36px; height: 36px;}" +
	"</style>"


module.exports = { stylesheet }