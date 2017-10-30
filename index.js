const login = require("facebook-chat-api");
const Slack = require("slack-node"); 
const express = require("express")

// https://www.npmjs.com/package/slack-node
// https://www.npmjs.com/package/facebook-chat-api
// https://www.npmjs.com/package/express


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

if(!process.env.SLACKHOOK) {
	console.log("Please specify the Slack webhook as an environment variable (SLACKHOOK)");
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

// Messenger login
/*
login({email: "tripsharebota@gmail.com", password: "Tripshareabc123A"}, (err, api) => {
    if(err) { 
    	return console.error(err);
    }
 
 	// Any conversation that the bot has been joined to
    api.listen((err, message) => {
    	// TODO look up sender name
    	// These are all superfluous.. it's just so I know the 
    	// key names for now
    	var sender = message.senderID;
    	var timeStamp = message.timestamp;
    	var msg = message.body;
    	var isGroup = message.isGroup;

    	console.log(message);
        // api.sendMessage(message.body, message.threadID);
    });
});
*/
var app = express()
var httpsServer = https.createServer(credentials, app);

var slack = new Slack();

// From Slack to the the webhook receiver (this code)
app.post('/webhook', function(req, res){
	console.log("Slack webhook received");
	console.log(req);
	var hook = slack.respond(req.body);
	res.json({text: 'Hi ' + hook.user_name, username: 'Dr. Nick'});
});

try {
	httpsServer.listen(port);
	console.log("Slack webhook listening on port " + port);
} catch(err) {
	console.log(err);
	process.exit(1);
}
