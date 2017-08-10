const utils = require('../functions/utils');

const channels = {"C6JSHQ1MF":{"users":["U0F9TFK7T"]}}



Object.keys(channels).forEach((channelId) => {

    utils.fetchSlackEndpoint("/channels.unarchive", {
        channel: channelId
    }).then(() => {
        console.log("channel unarchived:", channelId);
        channels[channelId].users.forEach((user) => {
            utils.fetchSlackEndpoint("channels.invite", {
                channel: channelId,
                user: user
            }).then(()=>{
                console.log("user", user, "invited to channel", channelId);
            });
        })
    });

});

