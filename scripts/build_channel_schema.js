const utils = require('../functions/utils');

utils.fetchSlackEndpoint("/channels.list").then((itemData) => {
    if(!itemData.ok || !itemData.channels.length){
        return;
    }
    let values = itemData.channels.map((item) => {
        return {
            "id": item.id,
            "name": {
                "value": item.name,
                "synonyms": [item.name.replace(/-/g, ' '), item.name.replace(/help-|topic-/g, "")]
            }
        }
    });
    console.log(JSON.stringify(values, null, 2));
    
});
