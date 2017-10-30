const facebook = require("facebook-chat-api");
const Slack = require("slack-node");
const Slackhook = require('slackhook');
const express = require("express")
const botname = "FBSlackConnector";

// When a slack webhook is fired, we need to get the trigger automatically and remove it from outgoing messages to Messenger
// This will do for now.
const hookTrigger = 'fb';

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

// TODO use something like Redis or another simple store so we can have persistance

// Keeps track of FB State
var FBChatThreadIDs = [];
var FBUserData = {};
var FBApi;

// Used for sending to Slack
var slack = new Slack(process.env.SLACKTOKEN);

// Used for outgoing web hooks
var slackhook = new Slackhook({
    domain: process.env.SLACKDOMAIN,
    token: process.env.SLACKTOKEN
});

// Keeps track of any incoming Slack Channels
var SlackChannels = {};

function SendToSlackChannels(from, message) {
	console.log("Sending message from " + from + " to Slack channels. Message = " + message);
	if(Object.keys(SlackChannels).length > 0) {
		Object.keys(SlackChannels).forEach(function(channelID) {
			try {
				slack.api('chat.postMessage', {
	  				text: botname + " (" + from + ") - " +  message,
	  				channel: channelID
				}, function(err, response){
			  		console.log(response);
				});
			} catch(err) {
				// No idea .. this is a quick hack with tight deadlines. Figure out why later and add robust error handling
				console.log(err + " perhaps channel " + channelID + " doesn't exist anymore.");
			}
		});
	}
}

// Messenger login
facebook({email: process.env.FBUSER, password: process.env.FBPASS}, (err, api) => {
    
    if(err) { 
    	return console.error(err);
    }

    // Save a reference for the Slack webhook to use
    FBApi = api;
 
 	// Any conversation that the bot has been joined to
    api.listen((err, message) => {

    	if((('threadID' in message) && message.threadID) && ('isGroup' in message) && message.isGroup && !(message.threadID in FBChatThreadIDs)) {
    		console.log('Found a group chat');
    		// TODO change the collection to an object and save more info
    		FBChatThreadIDs.push(message.threadID);
    		console.log("Sending FB chat join message to Slack");
    		SendToSlackChannels(botname, 'FB Messenger Chat ' + message.threadID + " just joined");
    	}

    	console.log(message);

    	var name = '';
    	if(!(message.senderID in FBUserData)) {
			api.getUserInfo([message.senderID], (err, userInfo) => {
		        if(err) return console.error(err);

		        name = userInfo[message.senderID].name;
		        // Keep a reference to any user data we care about (at least the name for now so we can post to Slack)
		        console.log(userInfo);
		        FBUserData[userInfo.senderID] = {
		        	name: name
		        };
		        console.log("name is " + name);
		        SendToSlackChannels(name, message.body);
    		});
    	} else {
    		SendToSlackChannels(FBUserData[message.senderID].name, message.body);
    	}

    	//console.log(message);
    });
});

var app = express();
var bodyParser = require('body-parser')

app.use(bodyParser.urlencoded({
  extended: true
}));

var httpsServer = https.createServer(credentials, app);

// From Slack to the the webhook receiver (this code)
app.post('/webhook', function(req, res){

	if(!('body' in req)) {
		console.log("body isn't present in the request.. why");
	}

	var hook = slackhook.respond(req.body);
	console.log("Slack webhook received from " + hook.user_name + " message = " + hook.text);
	
	if((('channel_id' in hook) && hook.channel_id && !(hook.channel_id in SlackChannels))){
		console.log('');
		SlackChannels[hook.channel_id] = {
			name: hook.channel_name,
			channel_hook_registed_by: hook.user_name
		}
		res.json({text: 'This channel has been registed with the ' + botname + " for communication between FB Messenger and Slack"})
	}

	console.log(hook);

	// If we want to respond back to Slack just respond to the response param
	// res.json({text: 'Hi ' + hook.user_name, username: 'Dr. Nick'});

	if(FBChatThreadIDs.length > 0) {
		try {
			// Send to FB messenger
			FBChatThreadIDs.forEach(function(threadID) {
				// Trim off the hook trigger
				FBApi.sendMessage(hook.text.substr(hookTrigger.length), threadID);
			});
		} catch(err) {
			// No idea .. this is a quick hack with tight deadlines. Figure out why later and add robust error handling
    		console.log(err + " perhaps chat " + threadID + " doesn't exist anymore.");
		}
	} else {
		console.log("No FB chats open. Not sending");
		res.json({text: 'No FB Chats have registed yet - Not sending to FB Messenger'});
	}
});

try {
	httpsServer.listen(port);
	console.log("Slack webhook listening on port " + port);
} catch(err) {
	console.log(err);
	process.exit(1);
}
