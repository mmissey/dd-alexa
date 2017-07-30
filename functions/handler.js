'use strict';
let utils = require('./utils.js');

module.exports.handleEvent = (event, context, callback) => {
    try {
        console.log(event);
        console.log(`event.session.application.applicationId=${event.session.application.applicationId}`);

        /**
         * Uncomment this if statement and populate with your skill's application ID to
         * prevent someone else from configuring a skill that sends requests to this function.
         */
        /*
        if (event.session.application.applicationId !== 'amzn1.echo-sdk-ams.app.[unique-value-here]') {
             callback('Invalid Application ID');
        }
        */

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
        case 'kickUsers': {
            handleKickUsers(intent, session, callback);
        }
        case 'AMAZON.HelpIntent':
            utils.getWelcomeResponse(callback);
            break;
        case 'AMAZON.StopIntent':
        case 'AMAZON.CancelIntent':
            utils.handleSessionEndRequest(callback);
            break;
        default:
            throw new Error('Invalid intent');
    }
}

function handleSendMessage(intent, session, callback) {
    let message;
    let channel;
    const repromptText = null;
    const sessionAttributes = {};
    let shouldEndSession = false;
    let speechOutput = '';
    let slotToElicit = null;

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
                speechOutput = `Message Sent`;
            }else{
                speechOutput = `Message Failed`;
            }
            callback(sessionAttributes,
                utils.buildSpeechletResponse(intent.name, speechOutput, repromptText, shouldEndSession));
        })
    }else{
        callback(sessionAttributes, {
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
            callback({}, utils.buildSpeechletResponse(intent.name, outputText, null, true));
        }
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
            callback({}, utils.buildSpeechletResponse(intent.name, outputText, null, true));
        })
    });
}

function handleKickUsers(intent, session, callback){
    let channel, channelId;
    if (intent && intent.slots) {
        channel = utils.getSlotFromResponse(intent.slots, 'channelName');
        channelId = channel ? channel.id : null;
    }
    if(!channelId){
        callback({}, {
            "directives": [ { "type": "Dialog.Delegate", } ]
        });
        return;
    }
    return performOnAllUsersInChannel(channelId, kickUserFromChannel.bind(this, channelId)).then((data) => {
        let outputText = `You kicked all ${userPromises.length} users from ${channel.name}`;
        callback({}, utils.buildSpeechletResponse(null, outputText, null, true));
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
    return utils.fetchSlackEndpoint("/channels.archive", {
        channel: channelId
    }).then((res) => {
        return res.ok;
    });
}

// Get's the user list for a channel, and performs an action on each user
function performOnAllUsersInChannel(channelId, action) {
    let userPromises = [];
    return utils.fetchSlackEndpoint("/channels.info", {
        channel: channelId
    }).then((res) => {
        if(!res.ok){ return; }
        userPromises = res.channel.members.map(action);
        return Promise.all(userPromises);
    })
}

function kickUserFromChannel(channelId, user) {
    console.log("kicking", user, "from", channelId)
    return utils.fetchSlackEndpoint("/channels.kick", {
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
    return utils.fetchSlackEndpoint("/channels.invite", {
        channel: channelId,
        user
    }).then((res) => {
        return res.ok
    });
}


// module.exports.handleEvent({
//     version: '1.0',
//     session: {
//         new: true,
//         sessionId: 'amzn1.echo-api.session.995e248a-89b9-42d9-99b1-f6b1c0e2df35',
//         application: { applicationId: 'amzn1.ask.skill.ba02be6b-3519-489e-a6ff-eb4627767ffe' },
//         user: { userId: 'amzn1.ask.account.AFSYWLP2TUINA7XH2IDT33YKZ5SNPBPFHFZ7CGPKE7APFKW6ZPNFR5QWX2BNCK5QGIISUV4A4HZGF4OZSQXDS5ZPIRINVJVKP7VVSECFKPOC46AKJ6BWSGPKRNC32GEGYQH77EWDCLMAAUMNVT5YK3PLPABC3AXFL5ZI35RQULSWACKJRGTQBTPUOAZOPQW65TRHQI4YQSJACZY' } 
//     },
//     context: {
//         AudioPlayer: { playerActivity: 'IDLE' }
//     },
//     request: { 
//         type: 'IntentRequest',
//         requestId: 'amzn1.echo-api.request.ad41b3c8-6277-4473-a59b-f4032de30989',
//         timestamp: '2017-07-30T17:20:43Z',
//         locale: 'en-US',
//         intent: { name: 'memberCount', confirmationStatus: 'NONE' },
//         dialogState: 'STARTED'
//     }
// }, null, (data, output) => {console.log(output)})
