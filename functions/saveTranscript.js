//saveTranscript.js
'use strict';
const utils = require('./utils.js');

const s3Bucket = "https://s3.amazonaws.com/dd-transcripts";
let userLookup = {};
let stats = {
	users: 0
};
function handleEvent (event, context, callback) {
	console.log(event)
	let options = utils.parseSns(event) || event;
	console.log(options);
	const channelId = options.channel_id;
	const oldestTimestamp = options.oldest_ts || 0;
	const latestTimestamp = options.latest_ts || Date.now();
	const numOfMessages = options.message_count || 1000;

	if(channelId){
		return getChannelMessages({
			channel : channelId,
			oldest  : oldestTimestamp, 
			latest  : latestTimestamp,
			count   : numOfMessages
		});
	}

};


function getChannelMessages(options) {
	return utils.fetchSlackEndpoint("/channels.history", Object.assign(options, {
		inclusive: true
	})).then((data) => {
		return parseMessages(data && data.messages).then((messagesHTML) => {
			let htmlString = 	"<html>" +
									"<head><link rel='stylesheet' type='text/css' href='styles.css'></head>" +
										messagesHTML +
								"</html>";

			let filename = `${options.channel}_${options.oldest}_${options.latest}.html`;
			utils.writeHTMLtoS3(filename, htmlString).then(() => {
				sendTranscriptReceipt(options.channel, filename);
			});
		});
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
	// Set a starting date. Most resent message timestamp
	let currentDay = new Date(messages[0].ts*1000).toLocaleDateString('en-US');
	let messagePromises = [];
	messages.forEach((message, index) => {
		let subtype = message.subtype || '';
		let date = new Date(message.ts*1000)
		let time = date.toLocaleTimeString();
		let html = "";
		// When the day changes. Place a timestamp
		if(date.toLocaleDateString('en-US') != currentDay){
			html += "<div class='day_marker'>" + currentDay + "</div>";
			currentDay = date.toLocaleDateString('en-US');
		}
		if(message.user){
			messagePromises.push(
				getUserInfo(message.user).then((author) => {  // First get author info
					return parseUsernames(message.text) // Get info for any user mentioned in the message
					.then(parseMentions)				//Pull out @channel, @here, etc
					.then(parseChannels)				//Convert to link to channel
					.then(parseLinks)					//show inline images
					.then((text) => {					// then html
					return html + buildMessageHTML(author.name, author.profile.image_72, subtype, time, text);
				});
			}));
		}else if(message.username){
			messagePromises.push(
				parseUsernames(message.text)
				.then(parseMentions)
				.then(parseChannels)
				.then(parseLinks)
				.then((text) => {
					return html + buildMessageHTML(message.username, getBotImage(), subtype, time, text);
				})
			);
		}
	});

	let firstTime = messages[messages.length-1].ts;
	messagePromises.push(Promise.resolve(("<div class='day_marker'>" + new Date(firstTime*1000).toLocaleDateString('en-US') + "</div>")));
	return Promise.all(messagePromises).then((messages) => {
		return "<body>" +
			"<div className='main'>" +
				messages.reverse().join('\n') + 
			"</div>" +
			stats.users +
		"</body>";
	});
}

function buildMessageHTML(username, img, type, time, text ){
//build the message html
 	return "<div class='message " + type + "'>" +
				"<div class='profPic'>" +
					"<img src='" + img + "' />" +
				"</div>" +
				"<div class='info'>" +
		   			"<div>" +
		   				"<span class='poster'>" + username + "</span>" +
		   				"<span class='timestamp'>" + time + "</span>" +
		   			"</div>" +
		   			"<div class='content'>" + text + "</div>" +
		   		"</div>" +
		   	"</div>";
}

function getBotImage(userId){
	return "https://placekitten.com/42/42";
}

function parseLinks(text) {
	let retText = text.substr(0);
	let regex = /<(https?:\/\/.*)>/g;
	let match;
	let imgFormat = /\.(gif|jpg|jpeg|tiff|png)/;
	while((match = regex.exec(retText)) !== null){
		if(imgFormat.test(match[1])){
			let index = match[1].indexOf("|");
			if(index !== -1){
				match[1] = match[1].substr(0, index).replace(" ", "_"); //remove image title
				match[1] = match[1].replace(".png", "_360.png");
			}
			retText = retText.replace(match[0], "<a href='"+match[1]+"'>"+match[1]+"</a><br><img class='inline-img' src='"+match[1]+"'/>");

		}else{
			retText = retText.replace(match[0], "<a href='"+match[1]+"'>"+match[1]+"</a>");
		}
	}
	return Promise.resolve(retText);
}


function parseUsernames(text) {
	let retText = text.substr(0);
	let regex = /<@([A-Z0-9]+)\|?([a-zA-Z0-9\.\-_]+)?>/g;
	let match;
	let usernameRequests = [];
	while((match = regex.exec(retText)) !== null){
		if(match[2]){
			usernameRequests.push(Promise.resolve({
				replace: match[0],
				username: match[2]
			}));
		}else{
			let replace = match[0];
			usernameRequests.push(getUserInfo(match[1]).then((userInfo) => {
				return {
					replace,
					username: userInfo.name
				}
			}))
		}
	}
	return Promise.all(usernameRequests).then((resolvedUsernames) => {
		for(let i=0;i<resolvedUsernames.length;i++){
			retText = retText.replace(resolvedUsernames[i].replace, getUsernameLink(resolvedUsernames[i].username));
		};
		return retText;
	});
}

function sendTranscriptReceipt(channelId, filename){
	let text = `A transcript of this chat has been archived here: ${s3Bucket}/${filename}`;
	return utils.fetchSlackEndpoint('chat.postMessage', {
		channel: channelId,
		text,
		username: "DD-ALEXA"
	})
}


function parseMentions(text) {
	let retText = text.substr(0);
	let regex = /<!([a-zA-Z0-9]+)>/g;
	let match;
	while((match = regex.exec(retText)) !== null){
		retText = retText.replace(match[0], "<span class='mention'>@"+match[1]+"</span>");
	}
	return Promise.resolve(retText);
}

function parseChannels(text) {
	let retText = text.substr(0);
	let regex = /<#([A-Z0-9]+)\|([a-zA-Z0-9\.\-_]+)?>/g;
	let match;
	while((match = regex.exec(retText)) !== null){
		retText = retText.replace(match[0], getChannelLink(match[1], match[2]));
	}
	return Promise.resolve(retText);
}

function getChannelInfo(channelId){
	return utils.fetchSlackEndpoint('channels.info', {
        channel: channelId
    }).then((res) => {
    	if(!res.ok){
    		return Promise.reject();
    	}
    	return res.channel;
    });
}

function getChannelLink(channelId, channelName){
	return "<a class='channel' target='_blank' href='https://denver-devs.slack.com/messages/"+channelId+"'>#"+channelName+"</a>"
}

function getUsernameLink(username){
	return "<a class='username' target='_blank' href='https://denver-devs.slack.com/team/"+username+"'>@"+username+"</a>"
}
module.exports = {
	handleEvent
}

// handleEvent({
// 	channel_id: "C040F1EV7"//"C643L9WG6"//"C040F1EV5"//
// })