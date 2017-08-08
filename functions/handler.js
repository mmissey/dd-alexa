'use strict';
let utils = require('./utils.js');
let isoDuration = require('iso8601-duration');

module.exports.handleEvent = (event, context, callback) => {
    try {
        console.log(event);
        console.log(`event.session.application.applicationId=${event.session.application.applicationId}`);

        if(event.session.new){
            utils.onSessionStarted({ requestId: event.request.requestId }, event.session);
        }

        if(event.request.type === 'LaunchRequest') {
            utils.onLaunch(event.request,
                event.session,
                (sessionAttributes, speechletResponse) => {
                    callback(null, utils.buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === 'IntentRequest') {
            onIntent(event.request,
                event.session,
                (sessionAttributes, speechletResponse) => {
                    callback(null, utils.buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === 'SessionEndedRequest') {
            utils.onSessionEnded(event.request, event.session);
            callback();
        }
    } catch (err) {
        callback(err);
    }
};

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback) {
    console.log(`onIntent requestId=${intentRequest.requestId}, sessionId=${session.sessionId}`);

    const intent = intentRequest.intent;
    const intentName = intent.name;
    console.log(intent);
    // Dispatch to your skill's intent handlers
    try{
        switch(intentName) {
            case 'SendMessage':
                handleSendMessage(intent, session, callback);
                break;
            case 'memberCount':
                handleMemberCount(intent, session, callback);
                break;
            case 'unreadCount':
                handleUnreadCount(intent, session, callback);
                break;
            case 'kickUsers': 
                handleKickUsers(intent, session, callback);
                break;
            case 'saveTranscript':
                handleSaveTranscript(intent, session, callback);
                break;
            case 'setDnd':
                handleDnd(intent, session, callback);
                break;
            case 'burnItDown':
                handleTheBurn(intent, session, callback);
            case 'AMAZON.HelpIntent':
                utils.listCommands(intent, session, callback);
                break;
            case 'AMAZON.StopIntent':
            case 'AMAZON.CancelIntent':
                utils.handleSessionEndRequest(callback);
                break;
            default:
                throw new Error('Invalid intent');
        }
    }catch(e) {
        console.log("ERROR:", e)
        return utils.handleError(intent, session, callback);
    }
}

function handleSendMessage(intent, session, callback) {
    let message;
    let channel;
    const repromptText = null;
    let shouldEndSession = false;
    let speechOutput = '';

    if (intent && intent.slots) {
        message = utils.getSlotFromResponse(intent.slots, 'message')
        channel = utils.getSlotFromResponse(intent.slots, 'channelName')
        message = message ? message.name : message;
    }
    shouldEndSession = true;
    console.log(channel, message)
    if (channel && message) {
        //wrap special commands
        if(['channel', 'here'].indexOf(message) > -1){
            message = '<!'+message+'>';
        }
        sendSlackMessage(message, channel.name, process.env.SLACK_USERNAME).then((res) => {
            if(res.ok){
                speechOutput = `Message Sent to ${channel.name}`;
            }else{
                speechOutput = `Message Failed`;
            }
            callback(null,
                utils.buildSpeechletResponse("Send Message", speechOutput, repromptText, shouldEndSession));
        })
    }else{
        callback(null, {
            "directives": [ { "type": "Dialog.Delegate", } ]
        });
    }
}

function sendSlackMessage(text, channel, username){
    channel = '#'+channel //.replace(' ', '-').toLowerCase();

    return utils.fetchSlackEndpoint('chat.postMessage', {
        text,
        channel,
        username
    }).then((json) => {
        console.log(json);
        return json;
    });
}

function handleMemberCount(intent, session, callback) {

    return utils.fetchSlackEndpoint('channels.list', {
        exclude_members: true
    }).then((json) => {
        let announcements = json.channels.find((channel) => {
            return channel.name === "announcements";
        })
        if(announcements && announcements.num_members){
            let outputText = `Denver Devs has ${announcements.num_members} members.`
            console.log(outputText)
            callback(null, utils.buildSpeechletResponse("Member Count", outputText, null, true));
        }
    }).catch(() => {
        return utils.handleError(intent, session, callback);
    });
}

function handleUnreadCount(intent, session, callback) {
    let promises = [];

    return utils.fetchSlackEndpoint('channels.list', {
        exclude_members: true
    }).then((json) => {
        if(json.channels){
            json.channels.forEach((channel) => {
                if(channel.is_member){
                    promises.push(utils.fetchSlackEndpoint('channels.info', {
                        channel: channel.id
                    }).then((channelInfo) => {
                        if(channelInfo.channel.unread_count_display > 0){
                            console.log(channelInfo.channel.unread_count_display, channelInfo.channel.name)
                        }
                        return (channelInfo.channel && channelInfo.channel.unread_count_display) || 0;
                    }));
                }
            })
        }
        return Promise.all(promises).then((promiseData) => {
            let unreadCount = promiseData.reduce((a,b) => {
                return parseInt(a)+parseInt(b);
            });
            let outputText = `You have ${unreadCount} unread public channel messages.`;
            callback(null, utils.buildSpeechletResponse("Unread Messages", outputText, null, true));
        })
    }).catch(() => {
        return utils.handleError(intent, session, callback);
    });;
}

function handleTheBurn(intent, session, callback){
    let promises = [];
    let channelsToBurn = {
        "topic-marc": "C643L9WG6",
        "topic-marc2": "C6JSHQ1MF"
    };
    Object.keys(channelsToBurn).forEach((channel) => {
        let channelId = channelsToBurn[channel];
        sendSlackMessage(":fire::fire::fire::fire::fire::fire::fire::fire::fire:", channel, process.env.SLACK_USERNAME);
        sendSlackMessage("http://www.allgeektome.net/wp-content/uploads/2016/06/Game-of-Thrones-1467044371.gif\n" +
        ":spacer::spacer::fire::fire::fire::fire::fire: <!channel> :fire::fire::fire::fire::fire:\n" +
        ":spacer::fire::fire::fire::fire::fire::fire::fire::fire::fire::fire::fire::fire::fire::fire::fire:\n" +
        ":fire::fire::fire::fire:*This channel is going down!!!!*:fire::fire::fire::fire:\n" +
        ":spacer::fire::fire::fire::fire::fire::fire::fire::fire::fire::fire::fire::fire::fire::fire::fire:\n" +
        ":spacer::spacer::fire::fire::fire::fire::fire::fire::fire::fire::fire::fire::fire::fire::fire:", channel, process.env.SLACK_USERNAME).then(() => {
            performOnAllUsersInChannel(channelId, kickUserFromChannel.bind(this, channelId));
        }).then(()=> {
            archiveChannel(channelId);
        });
    });

    callback(null, utils.secretResponse());
}

function handleDnd(intent, session, callback) {
    let turnOn, onOffRes, method, body = {}, outputText;
    if (intent && intent.slots) {
        onOffRes = utils.getSlotFromResponse(intent.slots, 'onOff');
        turnOn = onOffRes ? onOffRes.id : null;
    }
    console.log("turn on", turnOn)
    if(turnOn === null){
        callback(null, {
            "directives": [ { "type": "Dialog.Delegate", } ]
        });
        return;
    }
    turnOn = turnOn == true;
    if(turnOn){
        method = "dnd.setSnooze";
        body = {
            num_minutes: 60*8
        }
    }else{
        method = "dnd.endDnd";
    }

    return utils.fetchSlackEndpoint(method, body).then((res) => {
        if(!res.ok){
            return utils.handleError(intent, session, callback);
        }else{
            if(res.snooze_enabled){
                let remaining = Math.floor(res.snooze_remaining/3600);
                outputText = `Do not disturb turned on for ${remaining} hours`;
            }else{
                outputText = "Do not disturb off";
            }
       callback(null, utils.buildSpeechletResponse("Do-Not-Disturb", outputText, null, true)); 
        }
    }).catch((data) => {
        return utils.handleError(intent, session, callback);
    })
}

function handleKickUsers(intent, session, callback) {
    let channel, channelId;
    if (intent && intent.slots) {
        channel = utils.getSlotFromResponse(intent.slots, 'channelName');
        channelId = channel ? channel.id : null;
    }
    if(!channelId){
        callback(null, {
            "directives": [ { "type": "Dialog.Delegate", } ]
        });
        return;
    }
    return performOnAllUsersInChannel(channelId, kickUserFromChannel.bind(this, channelId)).then((numberAffected) => {
        let outputText = `You kicked all ${numberAffected} users from ${channel.name}`;
        callback(null, utils.buildSpeechletResponse("Kick Users", outputText, null, true));
    }).catch(() => {
        return utils.handleError(intent, session, callback);
    });
}

function handleSaveTranscript(intent, session, callback){
    let oldest = 0, channel, channelId, duration;
    if (intent && intent.slots) {
        channel = utils.getSlotFromResponse(intent.slots, 'channelName');
        channelId = channel ? channel.id : null;
        duration = utils.getSlotFromResponse(intent.slots, 'duration');
        duration = duration.name || null;
        console.log("duration", duration)
        console.log("channelId", channelId)
    }
    if(!channelId){
        callback(null, {
            "directives": [ { "type": "Dialog.Delegate", } ]
        });
        return;
    }
    if(duration){
        let durSeconds = isoDuration.toSeconds(isoDuration.parse(duration));
        let startTime = utils.convertUTCtoMountain(Date.now()-(durSeconds*1000)).getTime();  //UTC time
        oldest = startTime/1000 // Slack epoch timestamp
        console.log("oldest", oldest);
    }else{
        callback(null, {
            "directives": [ { "type": "Dialog.Delegate", } ]
        });
        return;
    }

    return utils.sendSns({
        channel_id: channelId,
        oldest_ts: oldest
    }).then((data) => {
        let outputText = "The transcription has been started for " + channel.name;
        callback(null, utils.buildSpeechletResponse("DD Transcription", outputText, null, true));
    }).catch(() => {
        return utils.handleError(intent, session, callback);
    });

}


function shutDownChannel(channelId){
    return performOnAllUsersInChannel(channelId, kickUserFromChannel.bind(channelId)).then(archiveChannel(channelId));
}


function kickAndBringBack(channelId, user) {
    return kickUserFromChannel(channelId, user).then((data) => {
        return inviteUserToChannel(data.channelId, data.user);
    });
}

function archiveChannel(channelId) {
    return utils.fetchSlackEndpoint("channels.archive", {
        channel: channelId
    }).then((res) => {
        return res.ok;
    });
}

// Get's the user list for a channel, and performs an action on each user
function performOnAllUsersInChannel(channelId, action) {
    let userPromises = [];
    return utils.fetchSlackEndpoint("channels.info", {
        channel: channelId
    }).then((res) => {
        if(!res.ok){ return; }
        console.log('IN CASE SOMETHING GOES WRONG, HERE ARE THE AFFECTED USERS: ', action.name, channelId, JSON.stringify(res.channel.members))
        userPromises = res.channel.members.map(action);
        return Promise.all(userPromises).then(() => {
            return userPromises.length;
        });
    })
}

function kickUserFromChannel(channelId, user) {
    console.log("kicking", user, "from", channelId)
    return utils.fetchSlackEndpoint("channels.kick", {
        channel: channelId,
        user
    }).then((res) => {
        return {
            channelId,
            user
        }
    });
}

function inviteUserToChannel(channelId, user) {
    console.log("inviting", user, "to", channelId)
    return utils.fetchSlackEndpoint("channels.invite", {
        channel: channelId,
        user
    }).then((res) => {
        return res.ok
    });
}

function inviteFromList(channelId, users){
    users.forEach((user) => {
        inviteUserToChannel(channelId, user);
    })
}


// module.exports.handleEvent({
//   "session": {
//     "sessionId": "SessionId.a7612dd2-5527-4e08-aac5-2ae3f6c5e754",
//     "application": {
//       "applicationId": "amzn1.ask.skill.ba02be6b-3519-489e-a6ff-eb4627767ffe"
//     },
//     "attributes": {},
//     "user": {
//       "userId": "amzn1.ask.account.AFSYWLP2TUINA7XH2IDT33YKZ5SNPBPFHFZ7CGPKE7APFKW6ZPNFR5QWX2BNCK5QGIISUV4A4HZGF4OZSQXDS5ZPIRINVJVKP7VVSECFKPOC46AKJ6BWSGPKRNC32GEGYQH77EWDCLMAAUMNVT5YK3PLPABC3AXFL5ZI35RQULSWACKJRGTQBTPUOAZOPQW65TRHQI4YQSJACZY"
//     },
//     "new": true
//   },
//   "request": {
//     "type": "IntentRequest",
//     "requestId": "EdwRequestId.3fb00342-a409-4684-984d-24fe7636165b",
//     "locale": "en-US",
//     "timestamp": "2017-08-02T02:09:23Z",
//     "intent": {
//       "name": "saveTranscript",
//       "slots": {
//         "duration": {
//           "name": "duration",
//           "value": "PT15M"
//         },
//         "channelName": {
//           "name": "channelName",
//           "value": "topic-general"
//         }
//       }
//     }
//   },
//   "version": "1.0"
// }, {}, (data) => {})