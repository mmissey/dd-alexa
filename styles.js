const stylesheet =
	"<style>" +
		"body { padding : 0 100px; font-family: hevetica; }" +
		".day_marker { text-align: center; width: 100%; }" +
		".day_marker:before, .day_marker:after { content: ''; height: 0px; width: calc(50% - 40px);border-top: 1px solid #CCCCCC;display: inline-block;top: -4px;position: relative; }" +
		".message { margin: 15px 0;min-height: 50px; }" +
		".poster { font-weight: bold; margin-right: 5px;}" +
		".timestamp { font-size: 0.8em; }" +
		".channel_join .poster, .channel_leave .poster, .channel_purpose .poster {display: none;}" +
		".profPic { width: 42px; height:42px; float: left; margin-right: 15px; } " +
		".profPic img { border-radius: 5px; }" +
	"</style>"


module.exports = { stylesheet }