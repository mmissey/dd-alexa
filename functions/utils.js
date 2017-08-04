//utils.js

// SLACK UTILS
const fetch = require('node-fetch');
const AWS = require('aws-sdk');
const SLACK_API = "https://slack.com/api/";
const sns = new AWS.SNS();
const TIMEZONE_MS_OFFSET = 6*60*60*1000;

function fetchSlackEndpoint(endpoint, body){
    let bodyData = [
        `token=${process.env.SLACK_API_KEY}`
    ];
    if(typeof body === "object"){
        Object.keys(body).forEach((key) => {
            bodyData.push(key + "=" + body[key])
        });
        bodyData = bodyData.join("&");
    }
    return fetch(`${SLACK_API}/${endpoint}`, {
        body: bodyData,
        headers: {
            "content-type": "application/x-www-form-urlencoded"
        },
        method: "POST"
    }).then((res) => {
        if(res && res.json){
            return res.json();
        }else{
            console.log(JSON.stringify(res));
        }
    }).then((json)=>{
        if(!json.ok){
            return Promise.reject(json);
        }else{
            return json;
        }
    }).catch((err) => {
        console.log("SLACK API ERROR:", JSON.stringify(err));
    });
}

function convertUTCtoMountain(utcTimestamp){
    return new Date(utcTimestamp-TIMEZONE_MS_OFFSET);
}

const SUCCESS = "ER_SUCCESS_MATCH";
const NOT_FOUND = "ER_SUCCESS_NO_MATCH";

function getSlotFromResponse(slots, key){
    if(slots[key]){
        if(slots[key].resolutions &&  slots[key].resolutions.resolutionsPerAuthority){
            let resolution = slots[key].resolutions.resolutionsPerAuthority[0];
            if(resolution && resolution.status){
                if(resolution.status.code === SUCCESS){
                    return resolution.values[0].value;
                }else if(resolution.status.code === NOT_FOUND){
                    return {
                        id: null,
                        name: slots[key].value
                    }
                }
            }
        }else{
            return {
                id: null,
                name: slots[key].value
            }  
        }
    }
    return null;
}

// AWS HELPERS
function sendSns(options) {
    console.log('sending: ', JSON.stringify(options));
    return new Promise((resolve, reject) => {
        const params = {
            TopicArn: process.env.SNS_TOPIC,
            MessageAttributes: {
                Source: {
                    DataType: 'String',
                    StringValue: 'DD-ALEXA'
                }
            }
        };

        params.Message = JSON.stringify({ default: JSON.stringify(options) });
        params.MessageStructure = 'json';

        sns.publish(params, (err, data) => {
            if (err) {
                console.log(`failed message send. error = ${err}`);
                return reject(err);
            }
            console.log(`sent message. data = ${JSON.stringify(data)}`);
            return resolve();
        });
    });
}

function writeHTMLtoS3(filename, html) {
    const bucket = process.env.S3_BUCKET;
    console.log(`Uploading ${filename} to S3: ${bucket}`);
    const s3 = new AWS.S3({
        params: {
            Bucket: bucket
        }
    });
    return new Promise((resolve, reject) => {
        s3.upload({
            Key: filename,
            ContentType: 'text/html',
            Body: html,
            ACL: 'public-read'
        }, (err, data) => {
            if (err) {
                console.log(`Error uploading ${filename} to S3. ${JSON.stringify(err)}`);
                reject();
            } else {
                console.log(`Uploaded ${filename} to S3.`);
                resolve();
            }
        });
    });
}

function parseSns(event) {
    return event.Records && event.Records[0] && event.Records[0].Sns && event.Records[0].Sns.Message && JSON.parse(event.Records[0].Sns.Message);
}


// ALEXA UTILS 

// --------------- Helpers that build all of the responses -----------------------

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: 'PlainText',
            text: output,
        },
        card: {
            type: 'Simple',
            title: `Denver Devs - Alexa`,
            content: output,
        },
        reprompt: {
            outputSpeech: {
                type: 'PlainText',
                text: repromptText,
            },
        },
        shouldEndSession,
    };
}



function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: '1.0',
        sessionAttributes,
        response: speechletResponse,
    };
}

function getWelcomeResponse(callback) {
    // If we wanted to initialize the session to have some attributes we could add those here.
    const sessionAttributes = {};
    const cardTitle = 'Welcome';
    const speechOutput = 'Welcome to Denver Devs Alexa, say help for a list of commands';
    // If the user either does not reply to the welcome message or says something that is not
    // understood, they will be prompted again with this text.
    const repromptText = 'Please give me a command, ' +
        'You can say: Send a Message, Get Channel Info, Do not disturb on, or Do not disturb off';
    const shouldEndSession = false;

    callback(sessionAttributes,
        buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

function handleSessionEndRequest(callback) {
    const cardTitle = 'Session Ended';
    const speechOutput = 'Thank you for trying Denver Devs Alexa';
    // Setting this to true ends the session and exits the skill.
    const shouldEndSession = true;

    callback({}, buildSpeechletResponse(cardTitle, speechOutput, null, shouldEndSession));
}


function handleError(intent, session, callback) {
    let outputText = "There was a problem the request. Please Try Again";
    callback({}, buildSpeechletResponse(intent.name, outputText, null, true));
    return Promise.reject();
}


// --------------- Events -----------------------

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
    console.log(`onSessionStarted requestId=${sessionStartedRequest.requestId}, sessionId=${session.sessionId}`);
}

/**
 * Called when the user launches the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
    console.log(`onLaunch requestId=${launchRequest.requestId}, sessionId=${session.sessionId}`);

    // Dispatch to your skill's launch.
    getWelcomeResponse(callback);
}

function listCommands(callback) {
    let outputText = "You can say 'Send an at channel', 'How many members are there', 'How many unread messages do I have', 'save a transcript', or 'kick everyone from channel'";
    callback({}, buildSpeechletResponse(intent.name, outputText, null, true));
}
/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
    console.log(`onSessionEnded requestId=${sessionEndedRequest.requestId}, sessionId=${session.sessionId}`);
    // Add cleanup logic here
}

module.exports = {
    fetchSlackEndpoint,
    onLaunch,
    onSessionStarted,
    getWelcomeResponse,
    buildResponse,
    buildSpeechletResponse,
    handleSessionEndRequest,
    listCommands,
    onSessionEnded,
    handleError,
    writeHTMLtoS3,
    sendSns,
    parseSns,
    getSlotFromResponse,
    convertUTCtoMountain    
}