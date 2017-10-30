const facebook = require("facebook-chat-api");
const Slack = require("slack-node");
const Slackhook = require('slackhook');
const express = require("express")

// I'm learning this as I go. Here are the packages I've used so far.
// https://www.npmjs.com/package/slack-node
// https://www.npmjs.com/package/facebook-chat-api
// https://www.npmjs.com/package/express
// https://github.com/Joezo/node-slackhook
// https://www.npmjs.com/package/body-parser



// For now it's one to one. There will be a single FB Messenger group that the bot will be invited to
// and there will be a single lead room

var port = parseInt(process.env.PORT);

if(typeof(port) != "number") {
	console.log("Please specify the port to bind to as an environment variable (PORT)");
	process.exit(1)
}

if(!process.env.KEY) {
	console.log("Please specify the key location on disk as an environment variable (KEY)");
	process.exit(1);
}

if(!process.env.CERT) {
	console.log("Please specify the cert location on disk as an environment variable (CERT)");
	process.exit(1);
}

/*
if(!process.env.SLACKHOOK) {
	console.log("Please specify the Slack webhook as an environment variable (SLACKHOOK)");
	process.exit(1);
}
*/

if(!process.env.SLACKDOMAIN) {
	console.log("Please specify the Slack domain as an environment variable (SLACKDOMAIN)");
	process.exit(1);
}

if(!process.env.SLACKTOKEN) {
	console.log("Please specify the Slack token as an environment variable (SLACKTOKEN)");
	process.exit(1);
}


if(!process.env.FBUSER) {
	console.log("Please specify the Facebook username as an environment variable (FBUSER)");
	process.exit(1);
}

if(!process.env.FBPASS) {
	console.log("Please specify the Facebook password as an environment variable (FBPASS");
	process.exit(1);
}



var fs = require('fs');
var http = require('http');
var https = require('https');


var privateKey;
var certificate;

try {
	privateKey  = fs.readFileSync(process.env.KEY, 'utf8');
	certificate = fs.readFileSync(process.env.CERT, 'utf8');
} catch(e) {
	console.log(e);
	process.exit(1);
}

var credentials = {key: privateKey, cert: certificate};

// Keeps track of any incoming FB threads (Chats)
var FBChatThreadIDs = [];
var FBApi;


// Keeps track of any incoming Slack Channels
var SlackChannelIDs = [];

// Messenger login
facebook({email: process.env.FBUSER, password: process.env.FBPASS}, (err, api) => {
    
    if(err) { 
    	return console.error(err);
    }

    // Save a reference for the Slack webhook to use
    FBApi = api;
 
 	// Any conversation that the bot has been joined to
    api.listen((err, message) => {
    	// TODO look up sender name
    	// These are all superfluous.. it's just so I know the 
    	// key names for now
    	var sender = message.senderID;
    	var timeStamp = message.timestamp;
    	var msg = message.body;
    	var isGroup = message.isGroup;
    	
    	console.log("threadID in message = " + ('threadID' in message));
    	console.log("isGroup in message = " + ('isGroup' in message));

    	if((('threadID' in message) && message.threadID) && ('isGroup' in message) && message.isGroup) {
    		console.log('Found a group');
    		FBChatThreadIDs.push(message.threadID);
    	}


    	console.log(message);

    	// TODO get the facebook user name
        // api.sendMessage(message.body, message.threadID);

        // TODO send to Slack
    });
});

var app = express();
var bodyParser = require('body-parser')

app.use(bodyParser.urlencoded({
  extended: true
}));

var httpsServer = https.createServer(credentials, app);


var slackhook = new Slackhook({
    domain: process.env.SLACKDOMAIN,
    token: process.env.SLACKTOKEN
});


// From Slack to the the webhook receiver (this code)
app.post('/webhook', function(req, res){

	if(!('body' in req)) {
		console.log("body isn't present in the request.. why");
	}

	var hook = slackhook.respond(req.body);
	console.log("Slack webhook received from " + hook.user_name + " message = " + hook.text);


	// If we want to respond back to Slack just respond to the response param
	// res.json({text: 'Hi ' + hook.user_name, username: 'Dr. Nick'});

	if(FBChatThreadIDs.length > 0) {
		// Send to FB messenger
		FBChatThreadIDs.forEach(function(threadID) {
			FBApi.sendMessage(hook.text, threadID);
		});
	} else {
		console.log("No FB chats open. Not sending");
	}


});

try {
	httpsServer.listen(port);
	console.log("Slack webhook listening on port " + port);
} catch(err) {
	console.log(err);
	process.exit(1);
}
