//saveTranscript.js
'use strict';
const utils = require('./utils.js');
const AWS = require('aws-sdk');
const styles = require('./styles.js').stylesheet
let userLookup = {};
let stats = {
	users: 0
};
function handleEvent (event, context, callback) {
	const channelId = event.channel_id;
	const oldestTimestamp = event.oldest_ts || 0;
	const latestTimestamp = event.latest_ts || Date.now();
	const numOfMessages = event.message_count || 1000;

	if(channelId){
		getChannelMessages({
			channel : channelId,
			oldest  : oldestTimestamp, 
			latest  : latestTimestamp,
			count   : numOfMessages
		});
	}

};


function getChannelMessages(options) {
	utils.fetchSlackEndpoint("/channels.history", Object.assign(options, {
		inclusive: true
	})).then((data) => {
		console.log("<html>");
		console.log("<head>"+ styles +"</head>");
		console.log(parseMessages(data && data.messages));
		console.log("</html>");
	}).catch((err) => {
		console.log(err);
	});
}

function getUserInfo(userId){
	if(userLookup[userId]){
		return Promise.resolve(userLookup[userId])
	}else {
		stats.users++;
		return userLookup[userId] = utils.fetchSlackEndpoint("/users.info", {
			user: userId
		}).then((data) => {
			if(data.ok){
				userLookup[userId] = data.user;
				return data.user;
			}
			return null;
		});
	}
}


function parseMessages(messages) {
	let messagesHTML = [];
	if(!messages) {
		return;
	}
	let currentDay = new Date(messages[0].ts*1000).toLocaleDateString('en-US');
	messages.forEach((message) => {
		let text = parseUsernames(message.text);
		text = parseCommands(text);
		let subtype = message.subtype || '';
		let date = new Date(message.ts*1000)
		let time = date.toLocaleTimeString()
		if(date.toLocaleDateString('en-US') != currentDay){
			messagesHTML.unshift("<div class='day_marker'>" + currentDay + "</div>");
			currentDay = date.toLocaleDateString('en-US');
		}
		let html = 	"<div class='message " + subtype + "'>" +
						"<div class='profPic'>" +
							"<img src='https://placekitten.com/42/42' />" + 
						"</div>" +
						"<div class='info'>" +
				   			"<div>" +
				   				"<span class='poster'>"+(message.user || message.username)+"</span>" +
				   				"<span class='timestamp'>"+time+"</span>" +
				   			"</div>" +
				   			"<div class='content'>"+text+"</div>" +
				   		"</div>" +
				   	"</div>";
		messagesHTML.unshift(html);
	});
	let firstTime = messages[messages.length-1].ts;
	messagesHTML.unshift("<div class='day_marker'>" + new Date(firstTime*1000).toLocaleDateString('en-US') + "</div>");
	return "<body>" + messagesHTML.join("\n") + "</body>";
}

function parseUsernames(text) {
	let retText = text.substr(0);
	let regex = /<@[A-Z0-9]+[|]([a-zA-Z0-9\.\-_]+)>/g;
	let match;
	while((match = regex.exec(text)) !== null){
		retText = retText.replace(match[0], "<span class='username'>@"+match[1]+"</span>");
	}
	return retText;
}

function parseCommands(text) {
	let retText = text.substr(0);
	let regex = /<!([a-zA-Z0-9]+)>/g;
	let match;
	while((match = regex.exec(text)) !== null){
		retText = retText.replace(match[0], "`@"+match[1]+"`");
	}
	return retText;
}

module.exports = {
	handleEvent
}

handleEvent({
	channel_id: "C643L9WG6"
})