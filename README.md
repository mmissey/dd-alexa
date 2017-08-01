# Denver Devs Alexa Bot

An Alexa skill to help administration and moderation of the Denver-Devs Slack team (https://denver-devs.slack.com).

## Develop Denver
The secondary purpose of this skill is for a conference talk at Develop Denver 2017 (developdenver.org).
The purpose of the talk is to demonstrate how to make an Alexa skill. We'll use AWS, Serverless, and the Slack API to make a simple chat bot with the main purpose of saving important conversations that take place in our favorate Slack group.

### Technologies demonstrated
* AWS Lambdas with NodeJS
* The Alexa SDK
* Serverless Framework
* AWS Simple Notification Service (SNS)
* AWS Simple Storage Service (S3)
* Slack API

## Skill Commands
* Alexa, ask Denver Devs to make a transcript of #general or [channel].
	* The history of that channel is parsed, converted to html, and uploaded to S3.
	* This is the most useful feature of this skill, since messages in free accounts are limited to a history of 10,000 messages, and Denver Devs is approaching **heat death** - A time when there are so many members chatting that our history gets shorter and shorter until there is none.
* Alexa, ask Denver Devs how many messages I have.
	* The user's channels are examined to reply with a count of unread messages
* Alexa, ask Denver Devs how many members there are.
	* The Slack API is queried to determine how many users the team currently has.
* Alexa, set a reminder for [channel] to [X] at [time]

## Grief Commands
### These commands are a proof of concept. They are potentially annoying and/or destructive. This requires an admin API token.
* Alexa, tell Denver Devs to kick everyone from [channel]
	* All users are removed from specified channel.
* Alexa, tell Denver Devs to cycle everyone in [channel]
	* Kicks all users, and then reinvites them
* Alexa, send an @channel|@here|@everyone to [channel]
	* An alert notification is sent to the channel
* Alexa, tell Denver Devs to start the dumpster fire.
	* ...you'll see